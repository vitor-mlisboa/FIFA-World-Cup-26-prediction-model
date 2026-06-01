from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import json
import joblib
import numpy as np
import pandas as pd

app = FastAPI(title="Oracle FC 2026")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

model = joblib.load("data/model.pkl")

with open("data/elo_ratings.json") as f:
    elo_ratings = json.load(f)

class ConfrontoRequest(BaseModel):
    team_a: str
    team_b: str

def get_elo(team):
    return elo_ratings.get(team, 1500)

def predict_probs(team_a, team_b):
    features = pd.DataFrame([{
        "elo_diff": get_elo(team_a) - get_elo(team_b),
        "elo_home": get_elo(team_a),
        "elo_away": get_elo(team_b),
        "neutral": 1,
        "phase": 3,
        "form_h_wr": 0.5,
        "form_a_wr": 0.5,
        "form_h_gd": 0.0,
        "form_a_gd": 0.0,
    }])
    probs = model.predict_proba(features)[0]
    probs = np.array(probs, dtype=np.float64)
    probs = probs / probs.sum()
    return probs

@app.get("/")
def root():
    return {"status": "Oracle FC 2026 online"}

@app.get("/rankings")
def rankings():
    try:
        with open("data/titulo_probs.json") as f:
            probs = json.load(f)
        return {"rankings": probs}
    except FileNotFoundError:
        return {"error": "Simulação ainda não rodou. Execute simulator.py primeiro."}

@app.post("/simulate")
def simulate(req: ConfrontoRequest):
    probs = predict_probs(req.team_a, req.team_b)
    return {
        "team_a": req.team_a,
        "team_b": req.team_b,
        "prob_vitoria_a": round(float(probs[2]) * 100, 1),
        "prob_empate": round(float(probs[1]) * 100, 1),
        "prob_vitoria_b": round(float(probs[0]) * 100, 1),
    }

@app.get("/teams")
def teams():
    return {"teams": sorted(elo_ratings.keys())}