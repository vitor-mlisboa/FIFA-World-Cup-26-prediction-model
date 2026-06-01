import numpy as np
import joblib
import json
import pandas as pd
from multiprocessing import Pool, cpu_count
from itertools import combinations
import time

model = joblib.load("data/model.pkl")

with open("data/elo_ratings.json") as f:
    elo_ratings = json.load(f)

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

def get_elo(team):
    return elo_ratings.get(team, 1500)

def predict_match(team_a, team_b):
    elo_a = get_elo(team_a)
    elo_b = get_elo(team_b)
    features = pd.DataFrame([{
        "elo_diff": elo_a - elo_b,
        "elo_home": elo_a,
        "elo_away": elo_b,
        "neutral": 1,
        "phase": 3,
        "form_h_wr": 0.5,
        "form_a_wr": 0.5,
        "form_h_gd": 0.0,
        "form_a_gd": 0.0,
    }])
    probs = model.predict_proba(features)[0]
    probs = np.array(probs, dtype=np.float64)
    return probs / probs.sum()

def pre_calcular_probs(times):
    cache = {}
    for a, b in combinations(times, 2):
        probs = predict_match(a, b)
        cache[(a, b)] = probs
        cache[(b, a)] = np.array([probs[2], probs[1], probs[0]])
    return cache

PROB_CACHE = pre_calcular_probs([t for g in GROUPS.values() for t in g])

def simular_jogo(team_a, team_b, pode_empatar=True):
    probs = PROB_CACHE.get((team_a, team_b))
    if probs is None:
        probs = predict_match(team_a, team_b)
    probs = np.array(probs, dtype=np.float64)
    probs = probs / probs.sum()
    if pode_empatar:
        return np.random.choice(["B", "E", "A"], p=probs)
    else:
        p_a = probs[2] / (probs[0] + probs[2])
        return np.random.choice(["A", "B"], p=[p_a, 1 - p_a])

def simular_grupo(times):
    pontos = {t: 0 for t in times}
    saldo = {t: 0 for t in times}
    for i in range(len(times)):
        for j in range(i + 1, len(times)):
            r = simular_jogo(times[i], times[j], pode_empatar=True)
            if r == "A":
                pontos[times[j]] += 3
                saldo[times[j]] -= 1
                saldo[times[i]] += 1
            elif r == "B":
                pontos[times[i]] += 3
                saldo[times[i]] -= 1
                saldo[times[j]] += 1
            else:
                pontos[times[i]] += 1
                pontos[times[j]] += 1
    return sorted(times, key=lambda t: (pontos[t], saldo[t], get_elo(t)), reverse=True)

def selecionar_melhores_terceiros(resultados):
    terceiros = []
    for grupo, ranking in resultados.items():
        terceiros.append((ranking[2], grupo))
    terceiros.sort(key=lambda x: get_elo(x[0]), reverse=True)
    return [t[0] for t in terceiros[:8]], [t[1] for t in terceiros[:8]]

def montar_chaveamento(resultados, terceiros_times, terceiros_grupos):
    # chaveamento fixo oficial FIFA 2026
    # 1o e 2o de cada grupo já têm confrontos pré-definidos
    # 3os colocados são alocados conforme tabela FIFA (495 cenários)
    # usamos o cenário mais provável: grupos A-H avançam
    p = {g: resultados[g][0] for g in GROUPS}
    s = {g: resultados[g][1] for g in GROUPS}

    # alocação dos 3os conforme tabela oficial FIFA para grupos A-H
    terceiros_map = {}
    grupos_t = sorted(terceiros_grupos[:8])
    chave_str = "".join(grupos_t)

    # tabela oficial simplificada (cenário mais comum)
    # 1A vs 3H, 1B vs 3G, 1C vs 3F, 1D vs 3E
    # 1E vs 2I, 1F vs 2J, 1G vs 2K, 1H vs 2L
    # 2A vs 2B, 2C vs 2D, 2E vs 2F, 2G vs 2H
    # 1I vs 1J, 1K vs 1L, 2I vs 2J, 2K vs 2L (oitavas)

    bracket = [
        # rodada de 32 — 16 jogos
        (p["A"], terceiros_times[7] if len(terceiros_times) > 7 else s["H"]),
        (p["B"], terceiros_times[6] if len(terceiros_times) > 6 else s["G"]),
        (p["C"], s["F"]),
        (p["D"], s["E"]),
        (p["E"], s["I"]),
        (p["F"], s["J"]),
        (p["G"], s["K"]),
        (p["H"], s["L"]),
        (s["A"], s["B"]),
        (s["C"], s["D"]),
        (terceiros_times[0] if terceiros_times else s["A"], terceiros_times[1] if len(terceiros_times) > 1 else s["B"]),
        (terceiros_times[2] if len(terceiros_times) > 2 else s["C"], terceiros_times[3] if len(terceiros_times) > 3 else s["D"]),
        (p["I"], p["J"]),
        (p["K"], p["L"]),
        (s["G"], s["H"]),
        (s["K"], s["L"]),
    ]
    return bracket

def simular_mata_mata(bracket):
    times = []
    for a, b in bracket:
        r = simular_jogo(a, b, pode_empatar=False)
        times.append(a if r == "A" else b)

    while len(times) > 1:
        proxima = []
        for i in range(0, len(times), 2):
            if i + 1 < len(times):
                r = simular_jogo(times[i], times[i+1], pode_empatar=False)
                proxima.append(times[i] if r == "A" else times[i+1])
            else:
                proxima.append(times[i])
        times = proxima

    return times[0]

def simular_copa():
    resultados = {}
    for grupo, times in GROUPS.items():
        resultados[grupo] = simular_grupo(times)

    terceiros_times, terceiros_grupos = selecionar_melhores_terceiros(resultados)
    bracket = montar_chaveamento(resultados, terceiros_times, terceiros_grupos)
    return simular_mata_mata(bracket)

def _simular_uma(i):
    return simular_copa()

def simular_probabilidades_titulo(n=10000):
    cpus = cpu_count()
    print(f"  Usando {cpus} núcleos da CPU")
    inicio = time.time()

    with Pool(processes=cpus) as pool:
        resultados = pool.map(_simular_uma, range(n))

    tempo = round(time.time() - inicio, 1)
    print(f"  Concluído em {tempo}s ✓")

    contagem = {}
    for campeao in resultados:
        contagem[campeao] = contagem.get(campeao, 0) + 1

    return dict(sorted(
        {t: round(v / n * 100, 1) for t, v in contagem.items()}.items(),
        key=lambda x: x[1], reverse=True
    ))

def simular_confronto(team_a, team_b, n=1000):
    resultados = {"vitoria_a": 0, "empate": 0, "vitoria_b": 0}
    for _ in range(n):
        probs = predict_match(team_a, team_b)
        r = np.random.choice(["vitoria_b", "empate", "vitoria_a"], p=probs)
        resultados[r] += 1
    return {k: round(v / n * 100, 1) for k, v in resultados.items()}

if __name__ == "__main__":
    print("Simulando 10.000 Copas do Mundo...\n")
    probs = simular_probabilidades_titulo(10000)

    print("\nTop 15 — probabilidade de título:")
    for i, (team, prob) in enumerate(list(probs.items())[:15], 1):
        bar = "█" * int(prob / 0.5)
        print(f"{i:2}. {team:<25} {prob:5.1f}% {bar}")

    with open("data/titulo_probs.json", "w") as f:
        json.dump(probs, f, indent=2)
    print("\nProbabilidades salvas em data/titulo_probs.json")