# Oracle FC 2026

Simulador da Copa do Mundo FIFA 2026 com modelo híbrido de força das seleções, distribuição de placares por Poisson ajustado e simulações de Monte Carlo. A aplicação permite visualizar o caminho provável do mata-mata, consultar probabilidades agregadas e editar cenários manualmente.

## O que o sistema faz

- Calcula uma força para cada seleção usando ranking FIFA, Elo recente, forma e valor de elenco.
- Estima gols esperados e placares prováveis para confrontos individuais.
- Simula a fase de grupos e o mata-mata da Copa de 2026.
- Respeita o chaveamento oficial da FIFA, incluindo a tabela de 495 cenários dos terceiros colocados.
- Roda Monte Carlo para estimar chance de título e avanço por fase.
- Permite simulação interativa: alterar classificação dos grupos e vencedores do mata-mata.

## Como o modelo funciona

### Rating híbrido

O arquivo `backend/ratings.py` monta a força base das seleções. O rating combina:

- Pontos atuais do ranking FIFA.
- Elo calculado a partir de `data/results.csv`, com recorte a partir de 2014.
- Peso por recência, com meia-vida de 2,5 anos.
- Peso por competição, dando mais importância a Copa do Mundo, torneios continentais e eliminatórias.
- Forma recente das últimas partidas.
- Força de elenco a partir de dados do Transfermarkt, usando valor de mercado dos jogadores.

Os pesos principais estão em `backend/ratings.py`:

- `FIFA_WEIGHT`
- `NATIONAL_ELO_WEIGHT`
- `FORM_WEIGHT`
- `SQUAD_WEIGHT`

### Modelo de placares

O arquivo `backend/simulator.py` transforma a diferença de rating entre duas seleções em gols esperados. Depois, cria uma matriz de placares com Poisson.

Também existe um ajuste estilo Dixon-Coles para reduzir excesso artificial de placares baixos, principalmente `0-0` e `1-1`.

No mata-mata, empate em 90 minutos não classifica ninguém diretamente. A chance de avançar considera:

- vitória no tempo normal;
- probabilidade de empate;
- chance de vencer nos pênaltis.

### Fase de grupos

Existem dois modos:

- `favorite`: usa pontos esperados para montar a classificação mais provável.
- `realistic`: sorteia os jogos com base na matriz de placares.

Na interface, a fase de grupos pode ser editada com as setas ao lado de cada seleção. Quando a ordem de um grupo muda, o backend recalcula:

- primeiros e segundos colocados;
- melhores terceiros;
- confrontos da Rodada de 32;
- todo o mata-mata.

### Chaveamento

O chaveamento é montado em `montar_chaveamento`, dentro de `backend/simulator.py`.

O arquivo `data/third_place_table_2026.json` contém os 495 cenários possíveis de terceiros colocados. Isso evita cruzamentos errados e mantém o fluxo oficial da Copa de 2026.

### Monte Carlo

A função `simular_probabilidades_titulo` roda várias Copas completas e conta:

- quantas vezes cada seleção foi campeã;
- quantas vezes chegou à Rodada de 32;
- oitavas;
- quartas;
- semifinais;
- final.

Os resultados são salvos em:

- `data/titulo_probs.json`
- `data/stage_probs.json`

## Estrutura do projeto

```text
FIFA-World-Cup-26-prediction-model/
├── backend/
│   ├── main.py
│   ├── ratings.py
│   └── simulator.py
├── data/
│   ├── elo_ratings.json
│   ├── fifa_mens_rank.csv
│   ├── results.csv
│   ├── titulo_probs.json
│   ├── stage_probs.json
│   ├── third_place_table_2026.json
│   ├── team_strength.csv
│   ├── team_strength.json
│   ├── players.csv
│   └── player_valuations.csv
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── index.css
│   │   └── main.jsx
│   ├── package.json
│   └── vite.config.js
└── README.md
```

## O que cada arquivo faz

### Backend

`backend/main.py`

Define a API FastAPI. Principais rotas:

- `GET /`: status da API.
- `GET /rankings`: lê `data/titulo_probs.json`.
- `GET /stages`: lê `data/stage_probs.json`.
- `POST /simulate`: simula um confronto individual.
- `POST /qualification`: retorna probabilidades de classificação em mata-mata.
- `GET /probable-bracket`: gera uma chave provável.
- `POST /interactive-bracket`: recalcula a chave com overrides de mata-mata e fase de grupos.
- `GET /teams`: lista seleções.
- `GET /groups`: lista grupos.
- `GET /strength`: expõe detalhes do rating híbrido.

`backend/simulator.py`

Contém o motor de simulação:

- grupos da Copa;
- cálculo de gols esperados;
- matriz de placares Poisson;
- ajuste Dixon-Coles;
- probabilidades de classificação;
- simulação de jogos;
- simulação da fase de grupos;
- seleção dos melhores terceiros;
- chaveamento oficial;
- simulação do mata-mata;
- recálculo interativo;
- Monte Carlo.

`backend/ratings.py`

Constrói os ratings das seleções:

- lê ranking FIFA;
- calcula Elo nacional recente;
- calcula forma;
- lê dados de elenco;
- normaliza e combina as fontes;
- salva força das seleções em arquivos auxiliares.

### Frontend

`frontend/src/App.jsx`

Aplicação React principal. Contém:

- layout geral;
- abas de navegação;
- visualização do chaveamento;
- modal de detalhes de jogo;
- edição interativa do mata-mata;
- edição interativa da fase de grupos;
- resultados do Monte Carlo;
- simulador de confronto individual;
- aba "Como funciona".

`frontend/src/index.css`

Estilos globais:

- fonte Poppins;
- tokens de cor do Oracle FC;
- dark mode base;
- normalização de `body`, botões e inputs.

`frontend/src/main.jsx`

Ponto de entrada React. Renderiza o componente `App`.

### Dados

`data/results.csv`

Histórico de jogos internacionais usado para calcular Elo recente e forma.

`data/fifa_mens_rank.csv`

Ranking FIFA usado como uma das fontes do rating híbrido.

`data/players.csv` e `data/player_valuations.csv`

Dados do Transfermarkt usados para estimar força de elenco.

`data/team_strength.csv` e `data/team_strength.json`

Saídas auxiliares com força calculada das seleções.

`data/third_place_table_2026.json`

Tabela dos 495 cenários de terceiros colocados da Copa de 2026.

`data/titulo_probs.json`

Probabilidade de título por seleção, gerada pelo Monte Carlo.

`data/stage_probs.json`

Probabilidade de chegar a cada fase, gerada pelo Monte Carlo.

## Como executar

### 1. Instalar dependências do frontend

Entre na pasta do frontend:

```bash
cd frontend
npm install
```

### 2. Instalar dependências do backend

Crie um ambiente Python e instale as bibliotecas principais:

```bash
pip install fastapi uvicorn numpy pandas
```

Se quiser regenerar tabelas auxiliares ou trabalhar com modelos antigos, também pode ser necessário instalar:

```bash
pip install joblib scikit-learn
```

### 3. Rodar a API

Na raiz do projeto:

```bash
uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

A API ficará em:

```text
http://127.0.0.1:8000
```

### 4. Rodar o frontend

Em outro terminal:

```bash
cd frontend
npm run dev -- --host 127.0.0.1 --port 5174
```

Abra:

```text
http://127.0.0.1:5174
```

## Como regenerar o Monte Carlo

Na raiz do projeto, execute:

```bash
python -m backend.simulator
```

Por padrão, o projeto foi pensado para rodar milhares de simulações. A função principal é `simular_probabilidades_titulo`.

Depois de rodar, confira se os arquivos abaixo foram atualizados:

- `data/titulo_probs.json`
- `data/stage_probs.json`

## Como usar a simulação interativa

### Alterar fase de grupos

Na aba "Simulação", vá até "Fase de grupos". Use as setas ao lado de cada seleção para subir ou descer sua colocação.

Ao alterar um grupo, o sistema recalcula automaticamente:

- classificação do grupo;
- melhores terceiros;
- chave oficial da Rodada de 32;
- confrontos seguintes;
- campeão projetado.

### Alterar mata-mata

Clique em qualquer jogo da chave. O modal mostra:

- probabilidade de cada seleção avançar;
- vitória em 90 minutos;
- empate em 90 minutos;
- pênaltis;
- xG;
- placar projetado;
- placares mais prováveis.

Use os botões "Classificar" para forçar um vencedor. A chave é recalculada a partir desse jogo.

## Comandos úteis

Rodar lint do frontend:

```bash
cd frontend
npm run lint
```

Gerar build de produção:

```bash
cd frontend
npm run build
```

Testar se a API está online:

```bash
curl http://127.0.0.1:8000/
```

## Observações importantes

- O modo `favorite` é determinístico e mostra o caminho central do modelo.
- O modo `realistic` sorteia resultados e pode gerar zebras.
- O placar modal pode ser empate, mas o placar projetado no mata-mata é sempre decisivo.
- Alterar fase de grupos pode invalidar escolhas antigas de mata-mata; por isso, a interface limpa os vencedores manuais quando uma classificação de grupo é editada.
- O modelo não prevê lesões, convocações finais ou mudanças táticas em tempo real. Ele depende dos dados carregados na pasta `data`.
