import pandas as pd
import numpy as np
import json
import joblib
from xgboost import XGBClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score

df = pd.read_csv("data/results.csv")
df["date"] = pd.to_datetime(df["date"])
df = df[df["date"] >= "2020-01-01"].sort_values("date").reset_index(drop=True)

with open("data/elo_ratings.json") as f:
    elo_ratings = json.load(f)

def get_elo(team):
    return elo_ratings.get(team, 1400)

form = {}

def get_form(team):
    games = form.get(team, [])
    if not games:
        return 0.5, 0.0
    recent = games[-10:]
    winrate = sum(1 for g in recent if g["result"] == "W") / len(recent)
    avg_gd = np.mean([g["gd"] for g in recent])
    return winrate, avg_gd

def k_factor(tournament):
    t = str(tournament).lower()
    if "fifa world cup" in t and "qualification" not in t:
        return 3
    elif "qualification" in t or "eliminat" in t:
        return 2
    elif "copa america" in t or "euro" in t or "africa cup" in t or "nations" in t:
        return 2
    elif "friendly" in t:
        return 1
    return 1

rows = []

for _, row in df.iterrows():
    home, away = row["home_team"], row["away_team"]
    hs, as_ = row["home_score"], row["away_score"]
    neutral = row["neutral"]

    elo_h = get_elo(home)
    elo_a = get_elo(away)
    form_h_wr, form_h_gd = get_form(home)
    form_a_wr, form_a_gd = get_form(away)
    phase = k_factor(row["tournament"])

    if hs > as_:
        target = 2
    elif hs < as_:
        target = 0
    else:
        target = 1

    rows.append({
        "elo_diff": elo_h - elo_a,
        "elo_home": elo_h,
        "elo_away": elo_a,
        "neutral": int(neutral),
        "phase": phase,
        "form_h_wr": form_h_wr,
        "form_a_wr": form_a_wr,
        "form_h_gd": form_h_gd,
        "form_a_gd": form_a_gd,
        "target": target
    })

    for team, score, conceded in [(home, hs, as_), (away, as_, hs)]:
        if team not in form:
            form[team] = []
        result = "W" if score > conceded else ("L" if score < conceded else "D")
        form[team].append({"result": result, "gd": score - conceded})

data = pd.DataFrame(rows)
X = data.drop("target", axis=1)
y = data["target"]

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, shuffle=False
)

model = XGBClassifier(
    n_estimators=300, max_depth=4, learning_rate=0.05,
    eval_metric="mlogloss", random_state=42
)
model.fit(X_train, y_train)

preds = model.predict(X_test)
acc = accuracy_score(y_test, preds)
print(f"Acurácia no conjunto de teste: {acc:.2%}")

joblib.dump(model, "data/model.pkl")
print("Modelo salvo em data/model.pkl")