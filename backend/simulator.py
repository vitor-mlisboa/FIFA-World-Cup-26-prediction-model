import json
import math
import time
from collections import Counter, defaultdict
from itertools import combinations
from multiprocessing import Pool, cpu_count

import numpy as np

try:
    from .ratings import DATA_DIR, blend_ratings, save_team_strength
except ImportError:
    from ratings import DATA_DIR, blend_ratings, save_team_strength


GROUPS = {
    "A": ["Mexico", "South Africa", "South Korea", "Czech Republic"],
    "B": ["Canada", "Qatar", "Switzerland", "Bosnia and Herzegovina"],
    "C": ["Brazil", "Morocco", "Haiti", "Scotland"],
    "D": ["United States", "Paraguay", "Australia", "Turkey"],
    "E": ["Germany", "Curacao", "Ivory Coast", "Ecuador"],
    "F": ["Netherlands", "Japan", "Tunisia", "Ukraine"],
    "G": ["Belgium", "Egypt", "Iran", "New Zealand"],
    "H": ["Spain", "Cape Verde", "Saudi Arabia", "Uruguay"],
    "I": ["France", "Senegal", "Norway", "Iraq"],
    "J": ["Argentina", "Algeria", "Austria", "Jordan"],
    "K": ["Portugal", "Uzbekistan", "Colombia", "DR Congo"],
    "L": ["England", "Croatia", "Ghana", "Panama"],
}

TEAM_LIST = [team for teams in GROUPS.values() for team in teams]
HOST_TEAMS = {"Mexico", "United States", "Canada"}

BASE_GOALS = 1.38
ELO_GOAL_SCALE = 560
HOST_ELO_BOOST = 45
PENALTY_ELO_SCALE = 900
MAX_GOALS = 10
DIXON_COLES_RHO = 0.1

THIRD_PLACE_ELIGIBILITY = {
    "M74": {"A", "B", "C", "D", "F"},
    "M77": {"C", "D", "F", "G", "H"},
    "M79": {"C", "E", "F", "H", "I"},
    "M80": {"E", "H", "I", "J", "K"},
    "M81": {"B", "E", "F", "I", "J"},
    "M82": {"A", "E", "H", "I", "J"},
    "M85": {"E", "F", "G", "I", "J"},
    "M87": {"D", "E", "I", "J", "L"},
}

ROUND_OF_32_FLOW = [
    "M74",
    "M77",
    "M73",
    "M75",
    "M83",
    "M84",
    "M81",
    "M82",
    "M76",
    "M78",
    "M79",
    "M80",
    "M86",
    "M88",
    "M85",
    "M87",
]

OFFICIAL_MATCH_NUMBERS = {
    "round_of_32": [74, 77, 73, 75, 83, 84, 81, 82, 76, 78, 79, 80, 86, 88, 85, 87],
    "round_of_16": [89, 90, 93, 94, 91, 92, 95, 96],
    "quarterfinals": [97, 98, 99, 100],
    "semifinals": [101, 102],
    "final": [104],
}

THIRD_PLACE_TABLE_PATH = DATA_DIR / "third_place_table_2026.json"


def load_third_place_scenarios():
    try:
        payload = json.loads(THIRD_PLACE_TABLE_PATH.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return {}
    return payload.get("table", {})


elo_ratings, rating_details = blend_ratings(TEAM_LIST)
THIRD_PLACE_SCENARIOS = load_third_place_scenarios()


def get_elo(team):
    return float(elo_ratings.get(team, 1500))


def match_elo(team):
    rating = get_elo(team)
    if team in HOST_TEAMS:
        rating += HOST_ELO_BOOST
    return rating


def poisson_pmf(lmbda, max_goals=MAX_GOALS):
    probs = [math.exp(-lmbda) * lmbda**k / math.factorial(k) for k in range(max_goals)]
    tail = max(0.0, 1.0 - sum(probs))
    probs.append(tail)
    return np.array(probs, dtype=np.float64)


def expected_goals(team_a, team_b):
    diff = match_elo(team_a) - match_elo(team_b)
    lambda_a = BASE_GOALS * math.exp(diff / ELO_GOAL_SCALE)
    lambda_b = BASE_GOALS * math.exp(-diff / ELO_GOAL_SCALE)
    return float(np.clip(lambda_a, 0.25, 4.2)), float(np.clip(lambda_b, 0.25, 4.2))


def score_matrix(team_a, team_b):
    lambda_a, lambda_b = expected_goals(team_a, team_b)
    pa = poisson_pmf(lambda_a)
    pb = poisson_pmf(lambda_b)
    matrix = np.outer(pa, pb)

    # Dixon-Coles style low-score correction: reduces repeated 0-0/1-1 modal draws
    # without discarding the Poisson distribution used for the full scoreline space.
    matrix[0, 0] *= max(0.0, 1 - lambda_a * lambda_b * DIXON_COLES_RHO)
    matrix[0, 1] *= 1 + lambda_a * DIXON_COLES_RHO
    matrix[1, 0] *= 1 + lambda_b * DIXON_COLES_RHO
    matrix[1, 1] *= max(0.0, 1 - DIXON_COLES_RHO)
    return matrix / matrix.sum()


def most_likely_score(team_a, team_b):
    matrix = score_matrix(team_a, team_b)
    score_a, score_b = np.unravel_index(np.argmax(matrix), matrix.shape)
    return int(score_a), int(score_b), float(matrix[score_a, score_b])


def top_scorelines(team_a, team_b, limit=6):
    matrix = score_matrix(team_a, team_b)
    rows = []
    for goals_a in range(matrix.shape[0]):
        for goals_b in range(matrix.shape[1]):
            rows.append((goals_a, goals_b, float(matrix[goals_a, goals_b])))
    rows.sort(key=lambda item: item[2], reverse=True)
    return [
        {"placar": f"{goals_a}-{goals_b}", "prob": round(prob * 100, 1)}
        for goals_a, goals_b, prob in rows[:limit]
    ]


def most_likely_decisive_score(team_a, team_b, winner):
    matrix = score_matrix(team_a, team_b)
    best = None
    for goals_a in range(matrix.shape[0]):
        for goals_b in range(matrix.shape[1]):
            if winner == team_a and goals_a <= goals_b:
                continue
            if winner == team_b and goals_b <= goals_a:
                continue
            prob = float(matrix[goals_a, goals_b])
            if best is None or prob > best[2]:
                best = (goals_a, goals_b, prob)

    if best is None:
        return most_likely_score(team_a, team_b)
    return int(best[0]), int(best[1]), float(best[2])


def predict_match(team_a, team_b):
    matrix = score_matrix(team_a, team_b)
    p_a = float(np.tril(matrix, -1).sum())
    p_draw = float(np.trace(matrix))
    p_b = float(np.triu(matrix, 1).sum())
    probs = np.array([p_b, p_draw, p_a], dtype=np.float64)
    return probs / probs.sum()


def penalty_win_probability(team_a, team_b):
    diff = match_elo(team_a) - match_elo(team_b)
    return 1 / (1 + math.exp(-diff / PENALTY_ELO_SCALE))


def qualification_probabilities(team_a, team_b):
    probs = predict_match(team_a, team_b)
    p_b_win, p_draw, p_a_win = probs
    p_a_pen = penalty_win_probability(team_a, team_b)
    p_a_qualifies = float(p_a_win + p_draw * p_a_pen)
    p_b_qualifies = float(p_b_win + p_draw * (1 - p_a_pen))
    total = p_a_qualifies + p_b_qualifies
    return {
        "team_a": team_a,
        "team_b": team_b,
        "prob_classifica_a": p_a_qualifies / total,
        "prob_classifica_b": p_b_qualifies / total,
        "prob_vitoria_a": float(p_a_win),
        "prob_empate": float(p_draw),
        "prob_vitoria_b": float(p_b_win),
        "prob_penaltis_a": float(p_a_pen),
        "prob_penaltis_b": float(1 - p_a_pen),
    }


def predict_scoreline(team_a, team_b):
    lambda_a, lambda_b = expected_goals(team_a, team_b)
    qualification = qualification_probabilities(team_a, team_b)
    score_a, score_b, score_prob = most_likely_score(team_a, team_b)
    return {
        "team_a": team_a,
        "team_b": team_b,
        "xg_a": round(lambda_a, 2),
        "xg_b": round(lambda_b, 2),
        "placar_estimado": f"{score_a}-{score_b}",
        "prob_placar_estimado": round(score_prob * 100, 1),
        "placares_mais_provaveis": top_scorelines(team_a, team_b),
        "prob_vitoria_a": round(float(predict_match(team_a, team_b)[2]) * 100, 1),
        "prob_empate": round(float(predict_match(team_a, team_b)[1]) * 100, 1),
        "prob_vitoria_b": round(float(predict_match(team_a, team_b)[0]) * 100, 1),
        "prob_classifica_a": round(qualification["prob_classifica_a"] * 100, 1),
        "prob_classifica_b": round(qualification["prob_classifica_b"] * 100, 1),
    }


def pre_calcular_probs(times):
    cache = {}
    for a, b in combinations(times, 2):
        cache[(a, b)] = predict_match(a, b)
        cache[(b, a)] = predict_match(b, a)
    return cache


PROB_CACHE = pre_calcular_probs(TEAM_LIST)


def simular_placar(team_a, team_b):
    matrix = score_matrix(team_a, team_b)
    index = int(np.random.choice(matrix.size, p=matrix.ravel()))
    gols_a, gols_b = np.unravel_index(index, matrix.shape)
    return int(gols_a), int(gols_b)


def vencedor_penaltis(team_a, team_b):
    p_a = penalty_win_probability(team_a, team_b)
    return team_a if np.random.random() < p_a else team_b


def classificado_mata_mata(team_a, team_b, mode="realistic"):
    probs = qualification_probabilities(team_a, team_b)
    if mode == "favorite":
        return team_a if probs["prob_classifica_a"] >= probs["prob_classifica_b"] else team_b
    return team_a if np.random.random() < probs["prob_classifica_a"] else team_b


def simular_jogo(team_a, team_b, pode_empatar=True):
    gols_a, gols_b = simular_placar(team_a, team_b)
    if gols_a > gols_b:
        return "A", gols_a, gols_b
    if gols_b > gols_a:
        return "B", gols_a, gols_b
    if pode_empatar:
        return "E", gols_a, gols_b
    winner = vencedor_penaltis(team_a, team_b)
    return ("A" if winner == team_a else "B"), gols_a, gols_b


def empty_stats(team):
    return {
        "team": team,
        "points": 0,
        "wins": 0,
        "gf": 0,
        "ga": 0,
        "gd": 0,
    }


def round_stats(stats):
    return {
        team: {
            key: (round(value, 2) if isinstance(value, float) else value)
            for key, value in values.items()
        }
        for team, values in stats.items()
    }


def simular_grupo(times):
    stats = {team: empty_stats(team) for team in times}

    for i in range(len(times)):
        for j in range(i + 1, len(times)):
            team_a, team_b = times[i], times[j]
            result, gols_a, gols_b = simular_jogo(team_a, team_b, pode_empatar=True)

            stats[team_a]["gf"] += gols_a
            stats[team_a]["ga"] += gols_b
            stats[team_b]["gf"] += gols_b
            stats[team_b]["ga"] += gols_a

            if result == "A":
                stats[team_a]["points"] += 3
                stats[team_a]["wins"] += 1
            elif result == "B":
                stats[team_b]["points"] += 3
                stats[team_b]["wins"] += 1
            else:
                stats[team_a]["points"] += 1
                stats[team_b]["points"] += 1

    for team in times:
        stats[team]["gd"] = stats[team]["gf"] - stats[team]["ga"]

    ranking = sorted(
        times,
        key=lambda t: (
            stats[t]["points"],
            stats[t]["gd"],
            stats[t]["gf"],
            stats[t]["wins"],
            get_elo(t),
        ),
        reverse=True,
    )
    return ranking, stats


def simular_grupo_favorito(times):
    stats = {team: empty_stats(team) for team in times}

    for i in range(len(times)):
        for j in range(i + 1, len(times)):
            team_a, team_b = times[i], times[j]
            probs = predict_match(team_a, team_b)
            p_b_win, p_draw, p_a_win = probs
            xg_a, xg_b = expected_goals(team_a, team_b)

            stats[team_a]["points"] += float(3 * p_a_win + p_draw)
            stats[team_b]["points"] += float(3 * p_b_win + p_draw)
            stats[team_a]["wins"] += float(p_a_win)
            stats[team_b]["wins"] += float(p_b_win)
            stats[team_a]["gf"] += xg_a
            stats[team_a]["ga"] += xg_b
            stats[team_b]["gf"] += xg_b
            stats[team_b]["ga"] += xg_a

    for team in times:
        stats[team]["gd"] = stats[team]["gf"] - stats[team]["ga"]

    ranking = sorted(
        times,
        key=lambda t: (
            stats[t]["points"],
            stats[t]["gd"],
            stats[t]["gf"],
            stats[t]["wins"],
            get_elo(t),
        ),
        reverse=True,
    )
    return ranking, round_stats(stats)


def selecionar_melhores_terceiros(group_results):
    terceiros = []
    for group, data in group_results.items():
        team = data["ranking"][2]
        stats = data["stats"][team]
        terceiros.append((team, group, stats))

    terceiros.sort(
        key=lambda item: (
            item[2]["points"],
            item[2]["gd"],
            item[2]["gf"],
            item[2]["wins"],
            get_elo(item[0]),
        ),
        reverse=True,
    )
    return terceiros[:8]


def montar_chaveamento(group_results, terceiros):
    p = {g: group_results[g]["ranking"][0] for g in GROUPS}
    s = {g: group_results[g]["ranking"][1] for g in GROUPS}
    third_slots = atribuir_terceiros_oficiais(terceiros)

    matches_by_number = {
        "M73": (s["A"], s["B"]),
        "M74": (p["E"], third_slots["M74"]),
        "M75": (p["F"], s["C"]),
        "M76": (p["C"], s["F"]),
        "M77": (p["I"], third_slots["M77"]),
        "M78": (s["E"], s["I"]),
        "M79": (p["A"], third_slots["M79"]),
        "M80": (p["L"], third_slots["M80"]),
        "M81": (p["D"], third_slots["M81"]),
        "M82": (p["G"], third_slots["M82"]),
        "M83": (s["K"], s["L"]),
        "M84": (p["H"], s["J"]),
        "M85": (p["B"], third_slots["M85"]),
        "M86": (p["J"], s["H"]),
        "M87": (p["K"], third_slots["M87"]),
        "M88": (s["D"], s["G"]),
    }
    return [matches_by_number[match_number] for match_number in ROUND_OF_32_FLOW]


def atribuir_terceiros_oficiais(terceiros):
    teams_by_group = {group: team for team, group, _ in terceiros}
    scenario_key = "".join(sorted(teams_by_group))
    scenario = THIRD_PLACE_SCENARIOS.get(scenario_key)
    if scenario and all(slot in scenario and scenario[slot] in teams_by_group for slot in THIRD_PLACE_ELIGIBILITY):
        return {slot: teams_by_group[scenario[slot]] for slot in THIRD_PLACE_ELIGIBILITY}

    assignments = {}
    slots = sorted(THIRD_PLACE_ELIGIBILITY, key=lambda slot: len(THIRD_PLACE_ELIGIBILITY[slot]))
    available = list(terceiros)
    original_rank = {team: index for index, (team, _, _) in enumerate(terceiros)}

    def backtrack(slot_index):
        if slot_index == len(slots):
            return True

        slot = slots[slot_index]
        eligible_groups = THIRD_PLACE_ELIGIBILITY[slot]
        candidates = [item for item in available if item[1] in eligible_groups]
        candidates.sort(key=lambda item: original_rank[item[0]])

        for item in candidates:
            assignments[slot] = item[0]
            available.remove(item)
            if backtrack(slot_index + 1):
                return True
            available.append(item)
            assignments.pop(slot, None)
        return False

    if backtrack(0):
        return assignments

    # Fallback defensivo para cenários improváveis com dados de entrada incompletos.
    assignments = {}
    available = list(terceiros)
    for slot, eligible_groups in THIRD_PLACE_ELIGIBILITY.items():
        candidates = [item for item in available if item[1] in eligible_groups]
        if not candidates:
            candidates = available
        if not candidates:
            assignments[slot] = None
            continue
        candidate = min(candidates, key=lambda item: original_rank[item[0]])
        assignments[slot] = candidate[0]
        available.remove(candidate)
    return assignments


def official_match_number(round_name, match_index):
    numbers = OFFICIAL_MATCH_NUMBERS.get(round_name, [])
    if 0 <= match_index < len(numbers):
        return numbers[match_index]
    return None


def match_key(round_name, match_index):
    return f"{round_name}:{match_index}"


def simular_mata_mata(bracket, mode="realistic", return_bracket=False, overrides=None):
    round_names = ["round_of_16", "quarterfinals", "semifinals", "final", "champion"]
    overrides = overrides or {}
    appearances = defaultdict(set)
    bracket_log = []

    current = []
    for match_index, (a, b) in enumerate(bracket):
        key = match_key("round_of_32", match_index)
        forced_winner = overrides.get(key)
        winner = forced_winner if forced_winner in {a, b} else classificado_mata_mata(a, b, mode=mode)
        current.append(winner)
        if return_bracket:
            bracket_log.append(
                matchup_log(
                    "round_of_32",
                    match_index,
                    a,
                    b,
                    winner,
                    forced_winner == winner,
                    official_match_number("round_of_32", match_index),
                )
            )

    for team in current:
        appearances[team].add(round_names[0])

    round_index = 1
    while len(current) > 1:
        next_round = []
        for i in range(0, len(current), 2):
            a, b = current[i], current[i + 1]
            round_name = round_names[round_index - 1]
            match_index = i // 2
            key = match_key(round_name, match_index)
            forced_winner = overrides.get(key)
            winner = forced_winner if forced_winner in {a, b} else classificado_mata_mata(a, b, mode=mode)
            next_round.append(winner)
            if return_bracket:
                bracket_log.append(
                    matchup_log(
                        round_name,
                        match_index,
                        a,
                        b,
                        winner,
                        forced_winner == winner,
                        official_match_number(round_name, match_index),
                    )
                )
        current = next_round
        for team in current:
            appearances[team].add(round_names[round_index])
        round_index += 1

    if return_bracket:
        return current[0], appearances, bracket_log
    return current[0], appearances


def matchup_log(round_name, match_index, team_a, team_b, winner, forced=False, match_number=None):
    probs = qualification_probabilities(team_a, team_b)
    lambda_a, lambda_b = expected_goals(team_a, team_b)
    modal_a, modal_b, modal_prob = most_likely_score(team_a, team_b)
    score_a, score_b, score_prob = most_likely_decisive_score(team_a, team_b, winner)
    return {
        "round": round_name,
        "match_index": match_index,
        "match_id": match_key(round_name, match_index),
        "match_number": match_number,
        "team_a": team_a,
        "team_b": team_b,
        "winner": winner,
        "forced": forced,
        "xg_a": round(lambda_a, 2),
        "xg_b": round(lambda_b, 2),
        "placar_estimado": f"{score_a}-{score_b}",
        "prob_placar_estimado": round(score_prob * 100, 1),
        "placar_modal": f"{modal_a}-{modal_b}",
        "prob_placar_modal": round(modal_prob * 100, 1),
        "placares_mais_provaveis": top_scorelines(team_a, team_b),
        "prob_classifica_a": round(probs["prob_classifica_a"] * 100, 1),
        "prob_classifica_b": round(probs["prob_classifica_b"] * 100, 1),
        "prob_vitoria_a": round(probs["prob_vitoria_a"] * 100, 1),
        "prob_empate_tempo_normal": round(probs["prob_empate"] * 100, 1),
        "prob_vitoria_b": round(probs["prob_vitoria_b"] * 100, 1),
        "prob_penaltis_a": round(probs["prob_penaltis_a"] * 100, 1),
        "prob_penaltis_b": round(probs["prob_penaltis_b"] * 100, 1),
    }


def simular_copa(knockout_mode="realistic"):
    group_results = {}
    phase_hits = defaultdict(set)

    for group, teams in GROUPS.items():
        ranking, stats = simular_grupo(teams)
        group_results[group] = {"ranking": ranking, "stats": stats}
        for team in ranking[:2]:
            phase_hits[team].add("round_of_32")

    terceiros = selecionar_melhores_terceiros(group_results)
    for team, _, _ in terceiros:
        phase_hits[team].add("round_of_32")

    bracket = montar_chaveamento(group_results, terceiros)
    champion, knockout_hits = simular_mata_mata(bracket, mode=knockout_mode)
    for team, phases in knockout_hits.items():
        phase_hits[team].update(phases)
    phase_hits[champion].add("champion")

    return champion, {team: sorted(phases) for team, phases in phase_hits.items()}


def simular_chave_provavel(knockout_mode="favorite", overrides=None):
    group_results = {}
    for group, teams in GROUPS.items():
        if knockout_mode == "favorite":
            ranking, stats = simular_grupo_favorito(teams)
        else:
            ranking, stats = simular_grupo(teams)
        group_results[group] = {"ranking": ranking, "stats": stats}

    terceiros = selecionar_melhores_terceiros(group_results)
    bracket = montar_chaveamento(group_results, terceiros)
    champion, _, bracket_log = simular_mata_mata(
        bracket,
        mode=knockout_mode,
        return_bracket=True,
        overrides=overrides,
    )

    return {
        "champion": champion,
        "knockout_mode": knockout_mode,
        "groups": {
            group: {
                "ranking": data["ranking"],
                "stats": data["stats"],
            }
            for group, data in group_results.items()
        },
        "best_thirds": [
            {"team": team, "group": group, "stats": stats}
            for team, group, stats in terceiros
        ],
        "matches": bracket_log,
    }


def normalizar_grupos_interativos(groups=None, group_overrides=None):
    groups = groups or {}
    group_overrides = group_overrides or {}
    normalized = {}

    for group, teams in GROUPS.items():
        payload = groups.get(group, {})
        source_ranking = payload.get("ranking") or teams
        source_stats = payload.get("stats") or {}

        ranking = [team for team in source_ranking if team in teams]
        ranking.extend(team for team in teams if team not in ranking)

        override = group_overrides.get(group)
        if override:
            manual_ranking = [team for team in override if team in teams]
            manual_ranking.extend(team for team in ranking if team not in manual_ranking)
            ranking = manual_ranking[: len(teams)]

        normalized[group] = {
            "ranking": ranking,
            "stats": {
                team: source_stats.get(team) or empty_stats(team)
                for team in teams
            },
        }

    return normalized


def recalcular_chave_por_grupos(groups=None, knockout_mode="realistic", overrides=None, group_overrides=None):
    group_results = normalizar_grupos_interativos(groups=groups, group_overrides=group_overrides)
    terceiros = selecionar_melhores_terceiros(group_results)
    bracket = montar_chaveamento(group_results, terceiros)
    champion, _, bracket_log = simular_mata_mata(
        bracket,
        mode=knockout_mode,
        return_bracket=True,
        overrides=overrides,
    )

    return {
        "champion": champion,
        "knockout_mode": knockout_mode,
        "interactive": True,
        "groups": {
            group: {
                "ranking": data["ranking"],
                "stats": data["stats"],
            }
            for group, data in group_results.items()
        },
        "best_thirds": [
            {"team": team, "group": group, "stats": stats}
            for team, group, stats in terceiros
        ],
        "matches": bracket_log,
        "overrides": overrides or {},
        "group_overrides": group_overrides or {},
    }


def recalcular_chave_interativa(base_bracket, knockout_mode="realistic", overrides=None, groups=None, best_thirds=None):
    bracket = [tuple(match) for match in base_bracket if len(match) == 2]
    champion, _, bracket_log = simular_mata_mata(
        bracket,
        mode=knockout_mode,
        return_bracket=True,
        overrides=overrides,
    )

    return {
        "champion": champion,
        "knockout_mode": knockout_mode,
        "interactive": True,
        "groups": groups or {},
        "best_thirds": best_thirds or [],
        "matches": bracket_log,
        "overrides": overrides or {},
    }


def _simular_uma(_):
    return simular_copa()


def pct(counter, n):
    return dict(
        sorted(
            {team: round(count / n * 100, 1) for team, count in counter.items()}.items(),
            key=lambda x: x[1],
            reverse=True,
        )
    )


def simular_probabilidades_titulo(n=10000):
    cpus = max(1, cpu_count() - 1)
    print(f"  Usando {cpus} nucleos da CPU")
    inicio = time.time()

    with Pool(processes=cpus) as pool:
        resultados = pool.map(_simular_uma, range(n))

    tempo = round(time.time() - inicio, 1)
    print(f"  Concluido em {tempo}s")

    title_counts = Counter()
    phase_counts = {
        "round_of_32": Counter(),
        "round_of_16": Counter(),
        "quarterfinals": Counter(),
        "semifinals": Counter(),
        "final": Counter(),
        "champion": Counter(),
    }

    for champion, phase_hits in resultados:
        title_counts[champion] += 1
        for team, phases in phase_hits.items():
            for phase in phases:
                phase_counts[phase][team] += 1

    rankings = pct(title_counts, n)
    stage_probs = {phase: pct(counter, n) for phase, counter in phase_counts.items()}
    return rankings, stage_probs


def simular_confronto(team_a, team_b, n=1000):
    resultados = Counter()
    placares = Counter()
    for _ in range(n):
        result, gols_a, gols_b = simular_jogo(team_a, team_b, pode_empatar=True)
        if result == "A":
            resultados["vitoria_a"] += 1
        elif result == "B":
            resultados["vitoria_b"] += 1
        else:
            resultados["empate"] += 1
        placares[f"{gols_a}-{gols_b}"] += 1

    probs = {k: round(resultados[k] / n * 100, 1) for k in ["vitoria_a", "empate", "vitoria_b"]}
    probs["placares_mais_provaveis"] = [
        {"placar": score, "prob": round(count / n * 100, 1)}
        for score, count in placares.most_common(5)
    ]
    return probs


if __name__ == "__main__":
    n = 10000
    print(f"Simulando {n:,} Copas do Mundo...\n".replace(",", "."))
    save_team_strength(TEAM_LIST)
    rankings, stage_probs = simular_probabilidades_titulo(n)

    print("\nTop 15 - probabilidade de título:")
    for i, (team, prob) in enumerate(list(rankings.items())[:15], 1):
        bar = "#" * int(prob / 0.5)
        print(f"{i:2}. {team:<25} {prob:5.1f}% {bar}")

    with (DATA_DIR / "titulo_probs.json").open("w") as f:
        json.dump(rankings, f, indent=2)

    with (DATA_DIR / "stage_probs.json").open("w") as f:
        json.dump(stage_probs, f, indent=2)

    print(f"\nProbabilidades salvas em {DATA_DIR / 'titulo_probs.json'} e {DATA_DIR / 'stage_probs.json'}")
