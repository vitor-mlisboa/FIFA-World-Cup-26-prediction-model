import json
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

try:
    from .simulator import (
        GROUPS,
        elo_ratings,
        qualification_probabilities,
        predict_scoreline,
        recalcular_chave_por_grupos,
        recalcular_chave_interativa,
        rating_details,
        simular_chave_provavel,
        simular_confronto,
    )
except ImportError:
    from simulator import (
        GROUPS,
        elo_ratings,
        qualification_probabilities,
        predict_scoreline,
        recalcular_chave_por_grupos,
        recalcular_chave_interativa,
        rating_details,
        simular_chave_provavel,
        simular_confronto,
    )


app = FastAPI(title="Oracle FC 2026")
DATA_DIR = Path(__file__).resolve().parents[1] / "data"

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class ConfrontoRequest(BaseModel):
    team_a: str
    team_b: str


class InteractiveBracketRequest(BaseModel):
    knockout_mode: str = "realistic"
    base_bracket: list[list[str]] = Field(default_factory=list)
    overrides: dict[str, str] = Field(default_factory=dict)
    group_overrides: dict[str, list[str]] = Field(default_factory=dict)
    groups: dict | None = None
    best_thirds: list[dict] | None = None


@app.get("/")
def root():
    return {"status": "Oracle FC 2026 online"}


@app.get("/rankings")
def rankings():
    try:
        with (DATA_DIR / "titulo_probs.json").open() as f:
            probs = json.load(f)
        return {"rankings": probs}
    except FileNotFoundError:
        return {"rankings": {}, "error": "Simulação ainda não rodou. Execute simulator.py primeiro."}


@app.get("/stages")
def stages():
    try:
        with (DATA_DIR / "stage_probs.json").open() as f:
            probs = json.load(f)
        return {"stages": probs}
    except FileNotFoundError:
        return {"stages": {}, "error": "Simulação ainda não rodou. Execute simulator.py primeiro."}


@app.post("/simulate")
def simulate(req: ConfrontoRequest):
    analytic = predict_scoreline(req.team_a, req.team_b)
    sampled = simular_confronto(req.team_a, req.team_b)
    return {
        **analytic,
        "simulado": sampled,
        "placares_mais_provaveis": sampled["placares_mais_provaveis"],
    }


@app.post("/qualification")
def qualification(req: ConfrontoRequest):
    probs = qualification_probabilities(req.team_a, req.team_b)
    return {
        "team_a": req.team_a,
        "team_b": req.team_b,
        "prob_classifica_a": round(probs["prob_classifica_a"] * 100, 1),
        "prob_classifica_b": round(probs["prob_classifica_b"] * 100, 1),
        "prob_vitoria_a": round(probs["prob_vitoria_a"] * 100, 1),
        "prob_empate_tempo_normal": round(probs["prob_empate"] * 100, 1),
        "prob_vitoria_b": round(probs["prob_vitoria_b"] * 100, 1),
        "prob_penaltis_a": round(probs["prob_penaltis_a"] * 100, 1),
        "prob_penaltis_b": round(probs["prob_penaltis_b"] * 100, 1),
    }


@app.get("/probable-bracket")
def probable_bracket(mode: str = "favorite"):
    if mode not in {"favorite", "realistic"}:
        mode = "favorite"
    return simular_chave_provavel(knockout_mode=mode)


@app.post("/interactive-bracket")
def interactive_bracket(req: InteractiveBracketRequest):
    mode = req.knockout_mode if req.knockout_mode in {"favorite", "realistic"} else "realistic"
    if req.group_overrides:
        return recalcular_chave_por_grupos(
            groups=req.groups,
            knockout_mode=mode,
            overrides=req.overrides,
            group_overrides=req.group_overrides,
        )
    return recalcular_chave_interativa(
        req.base_bracket,
        knockout_mode=mode,
        overrides=req.overrides,
        groups=req.groups,
        best_thirds=req.best_thirds,
    )


@app.get("/teams")
def teams():
    return {"teams": sorted(elo_ratings.keys())}


@app.get("/groups")
def groups():
    return {"groups": GROUPS}


@app.get("/strength")
def strength():
    return {"strength": rating_details}
