import json
import math
from pathlib import Path

import numpy as np
import pandas as pd


DATA_DIR = Path(__file__).resolve().parents[1] / "data"

DEFAULT_RATING = 1500.0
FIFA_WEIGHT = 0.32
NATIONAL_ELO_WEIGHT = 0.26
FORM_WEIGHT = 0.10
SQUAD_WEIGHT = 0.32

HALF_LIFE_DAYS = 365 * 2.5
HOME_ADVANTAGE = 55
MAX_K = 26
MIN_K = 0.25
MODEL_AS_OF_DATE = pd.Timestamp("2026-06-01")


def tournament_k(tournament):
    name = str(tournament).lower()
    if "fifa world cup" in name and "qualification" not in name:
        return 26
    if "uefa euro" in name or "copa america" in name or "africa cup" in name:
        return 22
    if "asian cup" in name or "gold cup" in name or "nations league" in name:
        return 18
    if "qualification" in name or "qualifier" in name:
        return 14
    if "friendly" in name:
        return 6
    return 10


def expected_score(rating_a, rating_b):
    return 1 / (1 + 10 ** ((rating_b - rating_a) / 400))


def result_score(goals_a, goals_b):
    if goals_a > goals_b:
        return 1.0
    if goals_a < goals_b:
        return 0.0
    return 0.5


def parse_bool(value):
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() in {"true", "1", "yes", "y"}


def margin_multiplier(goals_a, goals_b):
    diff = abs(goals_a - goals_b)
    if diff == 0:
        return 1.0
    return min(1.75, 1.0 + math.log(diff + 1) / 2.2)


def recency_weight(match_date, as_of):
    age_days = max(0, (as_of - match_date).days)
    return 0.5 ** (age_days / HALF_LIFE_DAYS)


def normalize_series_to_rating(values, center=DEFAULT_RATING, spread=115):
    series = pd.Series(values, dtype="float64")
    if series.std(ddof=0) == 0 or series.isna().all():
        return pd.Series(center, index=series.index)
    z = (series - series.mean()) / series.std(ddof=0)
    return center + z.clip(-2.8, 2.8) * spread


def load_manual_ratings():
    path = DATA_DIR / "elo_ratings.json"
    if not path.exists():
        return {}
    with path.open() as f:
        return {team: float(value) for team, value in json.load(f).items()}


def load_latest_fifa_points(teams):
    path = DATA_DIR / "fifa_mens_rank.csv"
    if not path.exists():
        return {}

    fifa = pd.read_csv(path)
    fifa = fifa.sort_values(["date", "semester"])
    latest = fifa.groupby("team").tail(1)
    return {
        row["team"]: float(row["total.points"])
        for _, row in latest.iterrows()
        if row["team"] in teams and not pd.isna(row["total.points"])
    }


def calculate_national_elo(teams):
    path = DATA_DIR / "results.csv"
    ratings = {team: DEFAULT_RATING for team in teams}
    form = {team: [] for team in teams}

    if not path.exists():
        return ratings, {team: 0.0 for team in teams}

    matches = pd.read_csv(path)
    matches["date"] = pd.to_datetime(matches["date"])
    matches = matches.dropna(subset=["home_score", "away_score"])
    matches["home_score"] = matches["home_score"].astype(int)
    matches["away_score"] = matches["away_score"].astype(int)
    matches = matches[matches["date"] >= "2014-01-01"].sort_values("date")
    if matches.empty:
        return ratings, {team: 0.0 for team in teams}

    as_of = max(matches["date"].max(), MODEL_AS_OF_DATE)

    for _, row in matches.iterrows():
        home = row["home_team"]
        away = row["away_team"]
        if home not in ratings and away not in ratings:
            continue

        home_rating = ratings.get(home, DEFAULT_RATING)
        away_rating = ratings.get(away, DEFAULT_RATING)
        neutral = parse_bool(row["neutral"])
        adjusted_home = home_rating if neutral else home_rating + HOME_ADVANTAGE

        expected_home = expected_score(adjusted_home, away_rating)
        actual_home = result_score(row["home_score"], row["away_score"])
        k = tournament_k(row["tournament"])
        k *= recency_weight(row["date"], as_of)
        k *= margin_multiplier(row["home_score"], row["away_score"])
        k = float(np.clip(k, MIN_K, MAX_K))
        delta = k * (actual_home - expected_home)

        if home in ratings:
            ratings[home] += delta
            form[home].append((row["date"], actual_home, row["home_score"] - row["away_score"]))
        if away in ratings:
            ratings[away] -= delta
            form[away].append((row["date"], 1 - actual_home, row["away_score"] - row["home_score"]))

    form_scores = {}
    for team in teams:
        recent = form.get(team, [])[-12:]
        if not recent:
            form_scores[team] = 0.0
            continue
        weighted_points = []
        weighted_gd = []
        for date, score, gd in recent:
            weight = recency_weight(date, as_of)
            weighted_points.append(weight * score)
            weighted_gd.append(weight * gd)
        ppg_like = np.nanmean(weighted_points) * 3
        gd_like = np.nanmean(weighted_gd)
        form_scores[team] = float((ppg_like - 1.35) * 55 + gd_like * 18)

    return ratings, form_scores


def load_squad_strength(teams):
    curated = DATA_DIR / "squad_strength.csv"
    if curated.exists():
        df = pd.read_csv(curated)
        if {"team", "squad_rating"}.issubset(df.columns):
            return {
                row["team"]: float(row["squad_rating"])
                for _, row in df.iterrows()
                if row["team"] in teams and not pd.isna(row["squad_rating"])
            }

    transfermarkt_dir = DATA_DIR / "transfermarkt"
    players_path = transfermarkt_dir / "players.csv"
    valuations_path = transfermarkt_dir / "player_valuations.csv"
    if not players_path.exists() or not valuations_path.exists():
        players_path = DATA_DIR / "players.csv"
        valuations_path = DATA_DIR / "player_valuations.csv"
    if not players_path.exists() or not valuations_path.exists():
        return {}

    players = pd.read_csv(players_path)
    valuations = pd.read_csv(valuations_path)
    nationality_col = next(
        (col for col in ["country_of_citizenship", "country_of_birth", "nationality"] if col in players.columns),
        None,
    )
    value_col = next((col for col in ["market_value_in_eur", "market_value"] if col in valuations.columns), None)
    if nationality_col is None or value_col is None or "player_id" not in players.columns:
        return {}

    if "date" in valuations.columns:
        valuations["date"] = pd.to_datetime(valuations["date"])
        valuations = valuations.sort_values("date").groupby("player_id").tail(1)
    else:
        valuations = valuations.groupby("player_id").tail(1)

    if "last_season" in players.columns:
        max_season = pd.to_numeric(players["last_season"], errors="coerce").max()
        players = players[pd.to_numeric(players["last_season"], errors="coerce") >= max_season - 1]

    merged = players[["player_id", nationality_col]].merge(
        valuations[["player_id", value_col]],
        on="player_id",
        how="inner",
    )
    merged = merged[merged[nationality_col].isin(teams)]
    if merged.empty:
        return {}

    squad_values = {}
    for team, group in merged.groupby(nationality_col):
        top_values = group[value_col].dropna().sort_values(ascending=False).head(26)
        if len(top_values) >= 8:
            squad_values[team] = float(np.log1p(top_values).mean())

    normalized = normalize_series_to_rating(squad_values)
    return normalized.to_dict()


def blend_ratings(teams):
    manual = load_manual_ratings()
    fifa = load_latest_fifa_points(teams)
    national_elo, form = calculate_national_elo(teams)
    squad = load_squad_strength(teams)

    squad_fallback_source = fifa or manual
    squad_normalized = squad if squad else normalize_series_to_rating(squad_fallback_source).to_dict()

    ratings = {}
    details = {}
    for team in teams:
        fifa_rating = fifa.get(team, manual.get(team, DEFAULT_RATING))
        elo_rating = national_elo.get(team, DEFAULT_RATING)
        form_rating = DEFAULT_RATING + form.get(team, 0.0)
        squad_rating = squad_normalized.get(team, fifa_rating)
        total = (
            fifa_rating * FIFA_WEIGHT
            + elo_rating * NATIONAL_ELO_WEIGHT
            + form_rating * FORM_WEIGHT
            + squad_rating * SQUAD_WEIGHT
        )

        ratings[team] = round(float(total), 2)
        details[team] = {
            "hybrid_rating": ratings[team],
            "fifa_points": round(float(fifa_rating), 2),
            "national_elo": round(float(elo_rating), 2),
            "form_rating": round(float(form_rating), 2),
            "squad_rating": round(float(squad_rating), 2),
            "squad_source": "transfermarkt_or_curated" if squad else "fifa_scaled_fallback",
        }

    return ratings, details


def save_team_strength(teams):
    ratings, details = blend_ratings(teams)

    with (DATA_DIR / "team_strength.json").open("w") as f:
        json.dump(details, f, indent=2)

    rows = [{"team": team, **values} for team, values in details.items()]
    pd.DataFrame(rows).sort_values("hybrid_rating", ascending=False).to_csv(
        DATA_DIR / "team_strength.csv",
        index=False,
    )
    return ratings, details
