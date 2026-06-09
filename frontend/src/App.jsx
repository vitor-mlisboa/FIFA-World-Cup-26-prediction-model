import { useCallback, useEffect, useMemo, useState } from "react"
import axios from "axios"

const API = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000"

const GROUPS = {
  A: ["Mexico", "South Africa", "South Korea", "Czech Republic"],
  B: ["Canada", "Qatar", "Switzerland", "Bosnia and Herzegovina"],
  C: ["Brazil", "Morocco", "Haiti", "Scotland"],
  D: ["United States", "Paraguay", "Australia", "Turkey"],
  E: ["Germany", "Curacao", "Ivory Coast", "Ecuador"],
  F: ["Netherlands", "Japan", "Tunisia", "Ukraine"],
  G: ["Belgium", "Egypt", "Iran", "New Zealand"],
  H: ["Spain", "Cape Verde", "Saudi Arabia", "Uruguay"],
  I: ["France", "Senegal", "Norway", "Iraq"],
  J: ["Argentina", "Algeria", "Austria", "Jordan"],
  K: ["Portugal", "Uzbekistan", "Colombia", "DR Congo"],
  L: ["England", "Croatia", "Ghana", "Panama"],
}

const FLAG_CODES = {
  Algeria: "dz",
  Argentina: "ar",
  Australia: "au",
  Austria: "at",
  Belgium: "be",
  "Bosnia and Herzegovina": "ba",
  Brazil: "br",
  Canada: "ca",
  "Cape Verde": "cv",
  Colombia: "co",
  Croatia: "hr",
  Curacao: "cw",
  "Czech Republic": "cz",
  "DR Congo": "cd",
  Ecuador: "ec",
  Egypt: "eg",
  England: "gb-eng",
  France: "fr",
  Germany: "de",
  Ghana: "gh",
  Haiti: "ht",
  Iran: "ir",
  Iraq: "iq",
  "Ivory Coast": "ci",
  Japan: "jp",
  Jordan: "jo",
  Mexico: "mx",
  Morocco: "ma",
  Netherlands: "nl",
  "New Zealand": "nz",
  Norway: "no",
  Panama: "pa",
  Paraguay: "py",
  Portugal: "pt",
  Qatar: "qa",
  "Saudi Arabia": "sa",
  Scotland: "gb-sct",
  Senegal: "sn",
  "South Africa": "za",
  "South Korea": "kr",
  Spain: "es",
  Switzerland: "ch",
  Tunisia: "tn",
  Turkey: "tr",
  Ukraine: "ua",
  "United States": "us",
  Uruguay: "uy",
  Uzbekistan: "uz",
}

const GROUP_COLORS = {
  A: "#888780",
  B: "#D4537E",
  C: "#D85A30",
  D: "#EF9F27",
  E: "#1D9E75",
  F: "#1D9E75",
  G: "#7F77DD",
  H: "#3B8BEB",
  I: "#3B8BEB",
  J: "#7F77DD",
  K: "#534AB7",
  L: "#185FA5",
}

const COLORS = {
  bgBase: "#080E1A",
  bgCard: "#0D1829",
  bgHover: "#111F35",
  border: "#1A2E4A",
  amber: "#F5A623",
  green: "#22C97A",
  red: "#E84545",
  blue: "#3B8BEB",
  teal: "#2DD4BF",
  textPrimary: "#F0F4F8",
  textSecondary: "#7A90A8",
  textTertiary: "#3D5166",
}

const TYPE = {
  label: { fontSize: 10, fontWeight: 900, textTransform: "uppercase", letterSpacing: 0 },
  body: { fontSize: 12, lineHeight: 1.5 },
  bodyLarge: { fontSize: 14, lineHeight: 1.55 },
  sectionTitle: { fontSize: 20, lineHeight: 1.15, fontWeight: 900 },
  headline: { fontSize: 28, lineHeight: 1.05, fontWeight: 900 },
}

const ROUND_LABELS = {
  round_of_32: "Rodada de 32",
  round_of_16: "Oitavas",
  quarterfinals: "Quartas",
  semifinals: "Semifinais",
  final: "Final",
}

const TEAM_TO_GROUP = Object.fromEntries(
  Object.entries(GROUPS).flatMap(([group, teams]) => teams.map((team) => [team, group])),
)

const tabs = [
  { id: "simulation", label: "Simulação" },
  { id: "montecarlo", label: "Monte Carlo" },
  { id: "custom", label: "Minha simulação" },
  { id: "about", label: "Como funciona" },
]

const STAGE_COLUMNS = [
  { id: "round_of_32", label: "Mata-mata" },
  { id: "round_of_16", label: "Oitavas" },
  { id: "quarterfinals", label: "Quartas" },
  { id: "semifinals", label: "Semi" },
  { id: "final", label: "Final" },
]

const KNOCKOUT_ROUNDS = ["round_of_32", "round_of_16", "quarterfinals", "semifinals", "final"]

const ABOUT_ITEMS = [
  {
    step: "01",
    title: "Rating híbrido",
    text: "Cada seleção recebe uma força base que combina ranking FIFA, Elo recente, forma esportiva e valor atual do elenco via Transfermarkt.",
  },
  {
    step: "02",
    title: "Poisson ajustado",
    text: "A diferença de força vira expectativa de gols. A matriz de placares usa Poisson com ajuste Dixon-Coles para reduzir excesso artificial de 0x0 e 1x1.",
  },
  {
    step: "03",
    title: "Fase de grupos",
    text: "No modo realista, cada jogo é sorteado pela matriz de placares. No modo favoritos, a tabela usa pontos esperados para exibir o caminho central.",
  },
  {
    step: "04",
    title: "Mata-mata",
    text: "Empate não classifica ninguém diretamente. A chance de avançar soma vitória no tempo normal e a fatia de empate decidida nos pênaltis.",
  },
  {
    step: "05",
    title: "Monte Carlo",
    text: "O motor roda milhares de Copas completas e conta quantas vezes cada seleção chega a cada fase e quantas vezes termina campeã.",
  },
]

const ABOUT_MODES = [
  {
    title: "Favoritos",
    tone: COLORS.amber,
    text: "Sempre escolhe a seleção com maior probabilidade em cada confronto. É ótimo para auditar o caminho mais provável, mas reduz a variância do torneio.",
  },
  {
    title: "Realista",
    tone: COLORS.green,
    text: "Sorteia cada jogo pelas probabilidades do modelo. Esse modo aceita zebras, empates em 90 minutos e decisões por pênaltis.",
  },
  {
    title: "Interativo",
    tone: COLORS.blue,
    text: "Permite forçar um vencedor específico e recalcula toda a chave a partir daquele ponto, mantendo intactos os jogos anteriores.",
  },
]

const ABOUT_METRICS = [
  "xG mostra os gols esperados para cada seleção.",
  "Placar projetado é o placar decisivo mais provável para o classificado.",
  "Probabilidade de avançar inclui tempo normal e pênaltis.",
  "Monte Carlo mede frequência de título e presença em cada fase.",
]

const page = {
  minHeight: "100vh",
  background: COLORS.bgBase,
  color: COLORS.textPrimary,
  fontFamily: "Poppins, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
}

const shell = {
  width: "min(1240px, calc(100% - 32px))",
  margin: "0 auto",
}

function formatPct(value) {
  return Number(value || 0).toFixed(1)
}

async function fetchMonteCarloData() {
  const [rankingsResponse, stagesResponse] = await Promise.all([
    axios.get(`${API}/rankings`),
    axios.get(`${API}/stages`),
  ])
  return {
    rankings: rankingsResponse.data.rankings || {},
    stages: stagesResponse.data.stages || {},
    error: rankingsResponse.data.error || stagesResponse.data.error || "",
  }
}

function matchKey(match) {
  return match?.match_id || `${match?.round}:${match?.match_index ?? 0}`
}

function descendantMatchKeys(match) {
  const startRound = KNOCKOUT_ROUNDS.indexOf(match.round)
  if (startRound < 0) return new Set([matchKey(match)])

  const keys = new Set()
  let index = Number(match.match_index || 0)
  for (let roundIndex = startRound; roundIndex < KNOCKOUT_ROUNDS.length; roundIndex += 1) {
    keys.add(`${KNOCKOUT_ROUNDS[roundIndex]}:${index}`)
    index = Math.floor(index / 2)
  }
  return keys
}

function baseBracketFrom(bracket) {
  return (bracket?.matches || [])
    .filter((match) => match.round === "round_of_32")
    .sort((a, b) => (a.match_index ?? 0) - (b.match_index ?? 0))
    .map((match) => [match.team_a, match.team_b])
}

function annotateManualMatches(bracket, manualOverrides) {
  return {
    ...bracket,
    matches: (bracket?.matches || []).map((match) => {
      const key = matchKey(match)
      return {
        ...match,
        manual_override: manualOverrides[key] === match.winner,
      }
    }),
  }
}

function sameRanking(a = [], b = []) {
  return a.length === b.length && a.every((team, index) => team === b[index])
}

function flagSrc(team) {
  const code = FLAG_CODES[team]
  return code ? `https://flagcdn.com/w80/${code}.png` : ""
}

function initials(team) {
  return team
    .split(" ")
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

function groupBadge(team) {
  const group = TEAM_TO_GROUP[team]
  return group ? `Grupo ${group}` : "Sem grupo"
}

function FlagBubble({ team, size = 30, active = false }) {
  const [failed, setFailed] = useState(false)
  const group = TEAM_TO_GROUP[team]
  const color = GROUP_COLORS[group] || COLORS.textSecondary
  const source = flagSrc(team)

  return (
    <span
      title={team}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        flex: `0 0 ${size}px`,
        background: `linear-gradient(135deg, ${color}, ${COLORS.bgCard})`,
        border: active ? `3px solid ${COLORS.green}` : `2px solid ${COLORS.border}`,
        boxShadow: "0 3px 10px rgba(0, 0, 0, 0.32)",
        color: COLORS.bgBase,
        fontSize: Math.max(9, size * 0.3),
        fontWeight: 900,
      }}
    >
      {source && !failed ? (
        <img
          alt=""
          src={source}
          onError={() => setFailed(true)}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        initials(team)
      )}
    </span>
  )
}

function TeamRow({ team, pct, winner, compact = false }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: compact ? "26px minmax(0, 1fr)" : "30px minmax(0, 1fr) auto",
        gap: 8,
        alignItems: "center",
      }}
    >
      <FlagBubble team={team} size={compact ? 25 : 29} active={winner} />
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            color: winner ? COLORS.textPrimary : COLORS.textSecondary,
            fontSize: compact ? 11 : 12,
            fontWeight: winner ? 900 : 700,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {team}
        </div>
        {!compact && (
        <div style={{ color: GROUP_COLORS[TEAM_TO_GROUP[team]] || COLORS.textTertiary, fontSize: 9, fontWeight: 900 }}>
            {groupBadge(team)}
          </div>
        )}
      </div>
      {!compact && (
        <div style={{ color: winner ? COLORS.green : COLORS.textSecondary, fontSize: 11, fontWeight: 900 }}>
          {formatPct(pct)}%
        </div>
      )}
    </div>
  )
}

function BracketMatch({ match, onSelect }) {
  const aWins = match.winner === match.team_a
  const winnerPct = aWins ? match.prob_classifica_a : match.prob_classifica_b
  const accent = winnerPct >= 58 ? COLORS.green : COLORS.amber
  const manual = Boolean(match.manual_override)

  return (
    <button
      type="button"
      onClick={() => onSelect(match)}
      style={{
        width: "100%",
        minWidth: 154,
        textAlign: "left",
        background: manual ? COLORS.bgHover : COLORS.bgCard,
        border: manual ? `1px solid ${COLORS.amber}` : `1px solid ${accent}55`,
        borderRadius: 999,
        padding: "7px 10px",
        cursor: "pointer",
        boxShadow: manual ? "0 12px 24px rgba(245, 166, 35, 0.18)" : "0 10px 22px rgba(0, 0, 0, 0.22)",
        position: "relative",
      }}
    >
      {manual && (
        <span
          style={{
            position: "absolute",
            top: -7,
            right: 12,
            background: COLORS.amber,
            color: COLORS.bgBase,
            borderRadius: 999,
            padding: "2px 7px",
            fontSize: 8,
            fontWeight: 1000,
          }}
        >
          EDITADO
        </span>
      )}
      <div style={{ display: "grid", gap: 5 }}>
        <TeamRow team={match.team_a} pct={match.prob_classifica_a} winner={aWins} compact />
        <TeamRow team={match.team_b} pct={match.prob_classifica_b} winner={!aWins} compact />
      </div>
      <div
        style={{
          marginTop: 6,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 8,
          color: COLORS.textSecondary,
          fontSize: 10,
          fontWeight: 900,
        }}
      >
        <span>
          {match.match_number ? `Jogo ${match.match_number} · ` : ""}
          {match.placar_estimado || "-"} proj.
        </span>
        <span style={{ color: manual ? COLORS.amber : accent }}>{formatPct(winnerPct)}%</span>
      </div>
    </button>
  )
}

function ProgressBracket({ bracket, onSelect }) {
  const rounds = useMemo(() => {
    const next = {}
    for (const match of bracket?.matches || []) {
      next[match.round] = [...(next[match.round] || []), match]
    }
    return next
  }, [bracket])

  const roundOrder = KNOCKOUT_ROUNDS
  const rowStep = 58
  const cardHeight = 52
  const cardWidth = 174
  const colGap = 54
  const topPad = 34
  const bottomPad = 24
  const height = topPad + rowStep * 16 + bottomPad
  const width = roundOrder.length * cardWidth + (roundOrder.length - 1) * colGap + 170

  return (
    <div
      style={{
        background: `linear-gradient(180deg, ${COLORS.bgCard} 0%, ${COLORS.bgBase} 100%)`,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 8,
        overflowX: "auto",
        overflowY: "hidden",
      }}
    >
      <div
        style={{
          width,
          height,
          position: "relative",
          padding: "0 18px",
        }}
      >
        {roundOrder.map((round, roundIndex) => {
          const x = 18 + roundIndex * (cardWidth + colGap)
          return (
            <div
              key={`label-${round}`}
              style={{
                position: "absolute",
                top: 12,
                left: x,
                width: cardWidth,
                color: COLORS.textSecondary,
                fontSize: 10,
                fontWeight: 1000,
                textTransform: "uppercase",
                letterSpacing: 0,
                textAlign: "center",
              }}
            >
              {ROUND_LABELS[round]}
            </div>
          )
        })}

        {roundOrder.flatMap((round, roundIndex) =>
          (rounds[round] || []).map((match, matchIndex) => {
            const x = 18 + roundIndex * (cardWidth + colGap)
            const centerY = topPad + (matchIndex + 0.5) * 2 ** roundIndex * rowStep
            const nextX = x + cardWidth
            const nextMatchIndex = Math.floor(matchIndex / 2)
            const nextCenterY = topPad + (nextMatchIndex + 0.5) * 2 ** (roundIndex + 1) * rowStep
            const elbowX = nextX + colGap / 2
            const connectorColor =
              (match.winner === match.team_a ? match.prob_classifica_a : match.prob_classifica_b) >= 58
                ? COLORS.green
                : COLORS.amber

            return (
              <div key={`${round}-${matchIndex}-${match.team_a}-${match.team_b}`}>
                {roundIndex < roundOrder.length - 1 && (
                  <>
                    <div
                      style={{
                        position: "absolute",
                        left: nextX,
                        top: centerY,
                        width: colGap / 2,
                        height: 2,
                        background: `${connectorColor}66`,
                      }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        left: elbowX,
                        top: Math.min(centerY, nextCenterY),
                        width: 2,
                        height: Math.abs(nextCenterY - centerY),
                        background: `${connectorColor}66`,
                      }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        left: elbowX,
                        top: nextCenterY,
                        width: colGap / 2,
                        height: 2,
                        background: `${connectorColor}66`,
                      }}
                    />
                  </>
                )}
                <div
                  style={{
                    position: "absolute",
                    left: x,
                    top: centerY - cardHeight / 2,
                    width: cardWidth,
                    height: cardHeight,
                  }}
                >
                  <BracketMatch match={match} onSelect={onSelect} />
                </div>
              </div>
            )
          }),
        )}

        <div
          style={{
            position: "absolute",
            left: 18 + roundOrder.length * (cardWidth + colGap) - 12,
            top: topPad + rowStep * 8 - 78,
            width: 138,
            display: "grid",
            justifyItems: "center",
            gap: 10,
          }}
        >
          <div
            style={{
              width: 122,
              height: 122,
              borderRadius: "50%",
              display: "grid",
              placeItems: "center",
              background: `radial-gradient(circle at 35% 30%, #fff8d6, ${COLORS.amber} 55%, #b85d18)`,
              boxShadow: "0 18px 35px rgba(245, 166, 35, 0.28)",
              border: `5px solid ${COLORS.bgHover}`,
              textAlign: "center",
              padding: 12,
            }}
          >
            <div>
              <FlagBubble team={bracket.champion} size={42} active />
              <div style={{ color: COLORS.textPrimary, fontSize: 11, fontWeight: 1000, marginTop: 8 }}>CAMPEÃO</div>
              <div style={{ color: COLORS.textPrimary, fontSize: 13, fontWeight: 1000, lineHeight: 1.05 }}>{bracket.champion}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function MatchDetails({ match, onClose, onForceWinner, canEdit = false, isUpdating = false }) {
  if (!match) return null

  const aWins = match.winner === match.team_a
  const manual = Boolean(match.manual_override)

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(8, 20, 36, 0.42)",
        display: "grid",
        placeItems: "center",
        padding: 18,
        zIndex: 20,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "min(560px, 100%)",
          background: COLORS.bgCard,
          borderRadius: 8,
          boxShadow: "0 26px 60px rgba(19, 34, 47, 0.28)",
          border: `1px solid ${COLORS.border}`,
          overflow: "hidden",
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div style={{ background: COLORS.bgHover, color: COLORS.textPrimary, padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
            <div>
              <div style={{ color: COLORS.textSecondary, ...TYPE.label, marginBottom: 4 }}>
                {match.match_number ? `Jogo ${match.match_number} · ` : ""}
                {ROUND_LABELS[match.round]}
              </div>
              <div style={{ fontSize: 18, fontWeight: 1000 }}>{match.team_a} x {match.team_b}</div>
            </div>
            <button
              type="button"
              onClick={onClose}
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                border: `1px solid ${COLORS.border}`,
                background: COLORS.bgCard,
                color: COLORS.textPrimary,
                cursor: "pointer",
                fontWeight: 900,
              }}
            >
              X
            </button>
          </div>
        </div>

        <div style={{ padding: 18 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 16, alignItems: "center", marginBottom: 18 }}>
            <div style={{ display: "grid", justifyItems: "center", gap: 8 }}>
              <FlagBubble team={match.team_a} size={54} active={aWins} />
              <strong style={{ textAlign: "center" }}>{match.team_a}</strong>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ color: COLORS.textSecondary, ...TYPE.label }}>Placar projetado</div>
              <div style={{ color: COLORS.textPrimary, fontSize: 30, fontWeight: 1000 }}>{match.placar_estimado}</div>
              <div style={{ color: COLORS.textSecondary, fontSize: 11 }}>
          {formatPct(match.prob_placar_estimado)}% entre placares decisivos
              </div>
            </div>
            <div style={{ display: "grid", justifyItems: "center", gap: 8 }}>
              <FlagBubble team={match.team_b} size={54} active={!aWins} />
              <strong style={{ textAlign: "center" }}>{match.team_b}</strong>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
            <Metric label={`Avança ${match.team_a}`} value={`${formatPct(match.prob_classifica_a)}%`} active={aWins} />
            <Metric label={`Avança ${match.team_b}`} value={`${formatPct(match.prob_classifica_b)}%`} active={!aWins} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 12 }}>
            <Metric label={`Vitória ${match.team_a}`} value={`${formatPct(match.prob_vitoria_a)}%`} />
            <Metric label="Empate em 90 min" value={`${formatPct(match.prob_empate_tempo_normal)}%`} />
            <Metric label={`Vitória ${match.team_b}`} value={`${formatPct(match.prob_vitoria_b)}%`} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
            <Metric label={`xG ${match.team_a}`} value={formatPct(match.xg_a)} />
            <Metric label={`xG ${match.team_b}`} value={formatPct(match.xg_b)} />
            <Metric label={`Pênaltis ${match.team_a}`} value={`${formatPct(match.prob_penaltis_a)}%`} />
            <Metric label={`Pênaltis ${match.team_b}`} value={`${formatPct(match.prob_penaltis_b)}%`} />
          </div>

          {canEdit && (
            <div
              style={{
                marginTop: 14,
                background: manual ? `${COLORS.amber}18` : COLORS.bgBase,
                border: manual ? `1px solid ${COLORS.amber}66` : `1px solid ${COLORS.border}`,
                borderRadius: 8,
                padding: 12,
              }}
            >
              <div style={{ color: manual ? COLORS.amber : COLORS.textSecondary, ...TYPE.label, marginBottom: 9 }}>
                {manual ? "Resultado definido manualmente" : "Simulação interativa"}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {[match.team_a, match.team_b].map((team) => (
                  <button
                    key={team}
                    type="button"
                    onClick={() => onForceWinner(match, team)}
                    disabled={isUpdating}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      padding: "10px 12px",
                      borderRadius: 8,
                      border: team === match.winner ? `1px solid ${COLORS.amber}` : `1px solid ${COLORS.border}`,
                      background: team === match.winner ? `${COLORS.amber}22` : COLORS.bgCard,
                      color: team === match.winner ? COLORS.textPrimary : COLORS.textSecondary,
                      cursor: isUpdating ? "not-allowed" : "pointer",
                      fontSize: 12,
                      fontWeight: 1000,
                      opacity: isUpdating ? 0.7 : 1,
                    }}
                  >
                    <FlagBubble team={team} size={22} active={team === match.winner} />
                    Classificar {team}
                  </button>
                ))}
              </div>
            </div>
          )}

          {match.placares_mais_provaveis?.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div style={{ color: COLORS.textSecondary, ...TYPE.label, marginBottom: 8 }}>
                Distribuição Poisson de placares
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {match.placares_mais_provaveis.map((score) => (
                  <div
                    key={score.placar}
                    style={{
                      background: score.placar === match.placar_modal ? `${COLORS.amber}22` : COLORS.bgBase,
                      border: score.placar === match.placar_modal ? `1px solid ${COLORS.amber}66` : `1px solid ${COLORS.border}`,
                      borderRadius: 999,
                      padding: "7px 10px",
                      color: COLORS.textPrimary,
                      fontSize: 12,
                      fontWeight: 900,
                    }}
                  >
                    {score.placar} <span style={{ color: COLORS.textSecondary }}>{formatPct(score.prob)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Metric({ label, value, active = false }) {
  return (
    <div
      style={{
        background: active ? `${COLORS.green}22` : COLORS.bgBase,
        border: active ? `1px solid ${COLORS.green}66` : `1px solid ${COLORS.border}`,
        borderRadius: 8,
        padding: 10,
        minWidth: 0,
      }}
    >
      <div style={{ color: active ? COLORS.green : COLORS.textSecondary, fontSize: 10, fontWeight: 900, marginBottom: 4 }}>{label}</div>
      <div style={{ color: COLORS.textPrimary, fontSize: 18, fontWeight: 1000 }}>{value}</div>
    </div>
  )
}

function formatStat(value) {
  const number = Number(value || 0)
  return Number.isInteger(number) ? String(number) : number.toFixed(1)
}

function GroupStageSummary({ bracket, groupOverrides = {}, onMoveTeam, canEdit = false, isUpdating = false }) {
  if (!bracket?.groups) return null

  const expectedMode = bracket.knockout_mode === "favorite"

  return (
    <section style={{ ...panelStyle, marginTop: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 14 }}>
        <div>
          <div style={{ color: COLORS.textPrimary, ...TYPE.sectionTitle }}>Fase de grupos</div>
          <div style={{ color: COLORS.textSecondary, fontSize: 12, marginTop: 3 }}>
            {expectedMode ? "Classificação por pontos esperados" : "Resultado sorteado neste cenário"}
            {canEdit ? " · use as setas para alterar a colocação" : ""}
          </div>
        </div>
        <div style={{ color: COLORS.amber, fontSize: 12, fontWeight: 1000 }}>
          {expectedMode ? "Determinístico" : "Monte Carlo"}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
        {Object.entries(bracket.groups).map(([group, data]) => {
          const edited = Boolean(groupOverrides[group])
          return (
          <div key={group} style={{ background: COLORS.bgBase, border: `1px solid ${edited ? COLORS.amber : COLORS.border}`, borderRadius: 8, overflow: "hidden" }}>
            <div
              style={{
                background: `${GROUP_COLORS[group] || COLORS.amber}30`,
                color: GROUP_COLORS[group] || COLORS.amber,
                padding: "8px 10px",
                fontSize: 12,
                fontWeight: 1000,
                display: "flex",
                justifyContent: "space-between",
                gap: 8,
                alignItems: "center",
              }}
            >
              <span>Grupo {group}</span>
              {edited && (
                <span style={{ color: COLORS.bgBase, background: COLORS.amber, borderRadius: 999, padding: "2px 7px", fontSize: 9 }}>
                  EDITADO
                </span>
              )}
            </div>
            <div style={{ display: "grid" }}>
              {(data.ranking || []).map((team, index) => {
                const stats = data.stats?.[team] || {}
                const qualified = index < 2
                return (
                  <div
                    key={team}
                    style={{
                      display: "grid",
                      gridTemplateColumns: canEdit
                        ? "20px 28px minmax(0, 1fr) 48px 42px 38px 38px"
                        : "20px 28px minmax(0, 1fr) 42px 38px 38px",
                      gap: 8,
                      alignItems: "center",
                      padding: "8px 10px",
                      borderTop: index === 0 ? 0 : `1px solid ${COLORS.border}`,
                    }}
                  >
                    <span style={{ color: qualified ? COLORS.green : COLORS.textTertiary, fontSize: 11, fontWeight: 1000 }}>{index + 1}</span>
                    <FlagBubble team={team} size={24} active={qualified} />
                    <span
                      style={{
                        minWidth: 0,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        color: qualified ? COLORS.textPrimary : COLORS.textSecondary,
                        fontSize: 12,
                        fontWeight: qualified ? 900 : 700,
                      }}
                    >
                      {team}
                    </span>
                    {canEdit && (
                      <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
                        {[
                          { label: "↑", direction: -1, disabled: index === 0 },
                          { label: "↓", direction: 1, disabled: index === (data.ranking || []).length - 1 },
                        ].map((control) => (
                          <button
                            key={control.label}
                            type="button"
                            title={`${control.label === "↑" ? "Subir" : "Descer"} ${team}`}
                            aria-label={`${control.label === "↑" ? "Subir" : "Descer"} ${team} no Grupo ${group}`}
                            onClick={() => onMoveTeam?.(group, team, control.direction)}
                            disabled={isUpdating || control.disabled}
                            style={{
                              width: 20,
                              height: 20,
                              borderRadius: 6,
                              border: `1px solid ${COLORS.border}`,
                              background: control.disabled ? COLORS.bgBase : COLORS.bgCard,
                              color: control.disabled ? COLORS.textTertiary : COLORS.textSecondary,
                              cursor: isUpdating || control.disabled ? "not-allowed" : "pointer",
                              fontSize: 12,
                              fontWeight: 900,
                              lineHeight: 1,
                              padding: 0,
                            }}
                          >
                            {control.label}
                          </button>
                        ))}
                      </div>
                    )}
                    <span style={{ color: COLORS.textPrimary, fontSize: 12, fontWeight: 1000, textAlign: "right" }}>{formatStat(stats.points)}</span>
                    <span style={{ color: COLORS.textSecondary, fontSize: 11, fontWeight: 900, textAlign: "right" }}>SG {formatStat(stats.gd)}</span>
                    <span style={{ color: COLORS.textSecondary, fontSize: 11, fontWeight: 900, textAlign: "right" }}>GP {formatStat(stats.gf)}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )})}
      </div>
    </section>
  )
}

function MonteCarloResults({
  filteredRankings,
  rankings,
  stages,
  maxPct,
  filterGroup,
  onFilterGroup,
  dataError,
  onReloadData,
}) {
  const leaders = Object.entries(rankings)
    .sort(([, pctA], [, pctB]) => pctB - pctA)
    .slice(0, 3)

  return (
    <>
      <section style={{ marginBottom: 18 }}>
        <div style={{ marginBottom: 14 }}>
          <h1 style={{ margin: 0, ...TYPE.headline }}>
            Resultados do Monte Carlo
          </h1>
          <p style={{ margin: "6px 0 0", color: COLORS.textSecondary, ...TYPE.bodyLarge, fontWeight: 600 }}>
            Probabilidades agregadas das simulações completas da Copa.
          </p>
        </div>

        {dataError && (
          <div
            style={{
              ...panelStyle,
              color: COLORS.red,
              marginBottom: 12,
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <span>{dataError}</span>
            <button
              type="button"
              onClick={onReloadData}
              style={{
                padding: "7px 11px",
                borderRadius: 999,
                border: `1px solid ${COLORS.red}66`,
                background: `${COLORS.red}20`,
                color: COLORS.textPrimary,
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 1000,
              }}
            >
              Tentar novamente
            </button>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
          {leaders.map(([team, pct], index) => (
            <div key={team} style={panelStyle}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center", minWidth: 0 }}>
                  <FlagBubble team={team} size={44} active={index === 0} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ color: COLORS.textSecondary, ...TYPE.label }}>#{index + 1}</div>
                    <div
                      style={{
                        color: COLORS.textPrimary,
                        fontSize: 17,
                        fontWeight: 1000,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {team}
                    </div>
                  </div>
                </div>
                <div style={{ color: index === 0 ? COLORS.amber : COLORS.green, fontSize: 24, fontWeight: 1000 }}>
                  {formatPct(pct)}%
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}>
                <Metric label="Chega à final" value={`${formatPct(stages.final?.[team])}%`} active={index === 0} />
                <Metric label="Chega à semi" value={`${formatPct(stages.semifinals?.[team])}%`} />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section style={panelStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
          <div>
            <div style={{ color: COLORS.textPrimary, ...TYPE.sectionTitle }}>Ranking de título e fases</div>
            <div style={{ color: COLORS.textSecondary, fontSize: 12, marginTop: 4 }}>
              Filtre por grupo para comparar o caminho provável de cada seleção.
            </div>
          </div>
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
            {["all", ...Object.keys(GROUPS)].map((group) => (
              <button
                key={group}
                onClick={() => onFilterGroup(group)}
                style={{
                  padding: "6px 11px",
                  borderRadius: 999,
                  border: "1px solid",
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 900,
                  background: filterGroup === group ? `${GROUP_COLORS[group] || COLORS.amber}30` : "transparent",
                  color: filterGroup === group ? GROUP_COLORS[group] || COLORS.amber : COLORS.textSecondary,
                  borderColor: filterGroup === group ? `${GROUP_COLORS[group] || COLORS.amber}70` : COLORS.border,
                }}
              >
                {group === "all" ? "Todos" : `Grupo ${group}`}
              </button>
            ))}
          </div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <div style={{ minWidth: 860 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "34px 38px minmax(170px, 1fr) 64px minmax(120px, 200px) repeat(5, 78px)",
                alignItems: "center",
                gap: 10,
                padding: "0 0 8px",
                color: COLORS.textSecondary,
                fontSize: 10,
                fontWeight: 1000,
                textTransform: "uppercase",
              }}
            >
              <span>#</span>
              <span />
              <span>Seleção</span>
              <span>Grupo</span>
              <span>Título</span>
              {STAGE_COLUMNS.map((stage) => (
                <span key={stage.id} style={{ textAlign: "right" }}>
                  {stage.label}
                </span>
              ))}
            </div>

            <div style={{ display: "grid", gap: 2 }}>
              {filteredRankings.length === 0 && (
                <div style={{ color: COLORS.textSecondary, textAlign: "center", padding: 28 }}>
                  Aguardando dados do Monte Carlo...
                </div>
              )}
              {filteredRankings.map(([team, pct], index) => {
                const group = TEAM_TO_GROUP[team]
                const color = GROUP_COLORS[group] || COLORS.textTertiary

                return (
                  <div
                    key={team}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "34px 38px minmax(170px, 1fr) 64px minmax(120px, 200px) repeat(5, 78px)",
                      alignItems: "center",
                      gap: 10,
                      padding: "10px 0",
                      borderTop: `1px solid ${COLORS.border}`,
                    }}
                  >
                    <span style={{ fontSize: 12, color: COLORS.textTertiary, fontWeight: 900 }}>{index + 1}</span>
                    <FlagBubble team={team} size={30} />
                    <span style={{ minWidth: 0, fontSize: 14, fontWeight: 900 }}>{team}</span>
                    <span style={{ color, fontSize: 11, fontWeight: 1000 }}>{group || "-"}</span>
                    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 48px", gap: 10, alignItems: "center" }}>
                      <div style={{ height: 8, background: COLORS.border, borderRadius: 999, overflow: "hidden" }}>
                        <div style={{ width: `${(pct / maxPct) * 100}%`, height: "100%", background: color }} />
                      </div>
                      <span style={{ fontSize: 13, color: COLORS.textSecondary, textAlign: "right", fontWeight: 1000 }}>
                        {formatPct(pct)}%
                      </span>
                    </div>
                    {STAGE_COLUMNS.map((stage) => (
                      <span key={stage.id} style={{ color: COLORS.textSecondary, fontSize: 12, fontWeight: 900, textAlign: "right" }}>
                        {formatPct(stages[stage.id]?.[team])}%
                      </span>
                    ))}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </section>
    </>
  )
}

function AboutPanel() {
  return (
    <div style={{ display: "grid", gap: 18 }}>
      <section
        style={{
          ...panelStyle,
          padding: 22,
          background: `linear-gradient(135deg, ${COLORS.bgCard} 0%, ${COLORS.bgHover} 100%)`,
        }}
      >
        <div style={{ ...TYPE.label, color: COLORS.amber, marginBottom: 8 }}>ORACLE FC 2026 · MODELO PREDITIVO</div>
        <h1 style={{ margin: 0, ...TYPE.headline }}>Como funciona</h1>
        <p style={{ margin: "10px 0 0", color: COLORS.textSecondary, ...TYPE.bodyLarge, maxWidth: 850 }}>
          O site combina força atual das seleções, distribuição de placares e simulações completas da Copa para
          estimar caminhos, fases e chances de título sem tratar o mata-mata como empate possível.
        </p>
      </section>

      <section>
        <div style={{ ...TYPE.label, color: COLORS.textSecondary, marginBottom: 10 }}>PIPELINE DO MODELO</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 12 }}>
        {ABOUT_ITEMS.map((item) => (
          <div key={item.title} style={{ ...panelStyle, minHeight: 150 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", marginBottom: 10 }}>
              <div style={{ color: COLORS.amber, fontSize: 14, fontWeight: 900 }}>{item.title}</div>
              <div
                style={{
                  color: COLORS.bgBase,
                  background: COLORS.amber,
                  borderRadius: 999,
                  padding: "3px 8px",
                  fontSize: 10,
                  fontWeight: 900,
                }}
              >
                {item.step}
              </div>
            </div>
            <div style={{ color: COLORS.textSecondary, ...TYPE.bodyLarge }}>{item.text}</div>
          </div>
        ))}
        </div>
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
        <div style={panelStyle}>
          <div style={{ ...TYPE.sectionTitle, color: COLORS.textPrimary, marginBottom: 12 }}>Modos de chave</div>
          <div style={{ display: "grid", gap: 10 }}>
            {ABOUT_MODES.map((mode) => (
              <div
                key={mode.title}
                style={{
                  background: COLORS.bgBase,
                  border: `1px solid ${COLORS.border}`,
                  borderLeft: `4px solid ${mode.tone}`,
                  borderRadius: 8,
                  padding: 14,
                }}
              >
                <div style={{ color: mode.tone, fontSize: 13, fontWeight: 900, marginBottom: 5 }}>{mode.title}</div>
                <div style={{ color: COLORS.textSecondary, ...TYPE.bodyLarge }}>{mode.text}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={panelStyle}>
          <div style={{ ...TYPE.sectionTitle, color: COLORS.textPrimary, marginBottom: 12 }}>Como ler os números</div>
          <div style={{ display: "grid", gap: 9 }}>
            {ABOUT_METRICS.map((metric) => (
              <div key={metric} style={{ display: "grid", gridTemplateColumns: "18px minmax(0, 1fr)", gap: 9 }}>
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: COLORS.teal,
                    marginTop: 7,
                  }}
                />
                <span style={{ color: COLORS.textSecondary, ...TYPE.bodyLarge }}>{metric}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section
        style={{
          ...panelStyle,
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) auto",
          gap: 16,
          alignItems: "center",
        }}
      >
        <div>
          <div style={{ ...TYPE.label, color: COLORS.green, marginBottom: 6 }}>CHAVEAMENTO OFICIAL</div>
          <div style={{ color: COLORS.textSecondary, ...TYPE.bodyLarge }}>
            A Rodada de 32 segue os jogos oficiais da FIFA, incluindo a tabela de 495 cenários para os terceiros
            colocados. Isso evita cruzamentos indevidos, como Brasil e Espanha se encontrarem antes de uma possível final
            quando ambos vencem seus grupos.
          </div>
        </div>
        <div
          style={{
            color: COLORS.bgBase,
            background: COLORS.green,
            borderRadius: 999,
            padding: "8px 12px",
            fontSize: 12,
            fontWeight: 900,
            whiteSpace: "nowrap",
          }}
        >
          FIFA 2026
        </div>
      </section>
    </div>
  )
}

export default function App() {
  const [tab, setTab] = useState("simulation")
  const [rankings, setRankings] = useState({})
  const [stages, setStages] = useState({})
  const [teamA, setTeamA] = useState("Brazil")
  const [teamB, setTeamB] = useState("Argentina")
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [dataError, setDataError] = useState("")
  const [filterGroup, setFilterGroup] = useState("all")
  const [bracket, setBracket] = useState(null)
  const [baseScenario, setBaseScenario] = useState(null)
  const [bracketOverrides, setBracketOverrides] = useState({})
  const [groupOverrides, setGroupOverrides] = useState({})
  const [bracketMode, setBracketMode] = useState("favorite")
  const [bracketLoading, setBracketLoading] = useState(true)
  const [bracketError, setBracketError] = useState("")
  const [selectedMatch, setSelectedMatch] = useState(null)
  const [interactiveLoading, setInteractiveLoading] = useState(false)

  const teams = useMemo(() => Object.keys(TEAM_TO_GROUP).sort(), [])
  const maxPct = Math.max(1, ...Object.values(rankings))
  const manualOverrideCount = Object.keys(bracketOverrides).length + Object.keys(groupOverrides).length

  const filteredRankings = useMemo(
    () =>
      Object.entries(rankings)
        .filter(([team]) => filterGroup === "all" || TEAM_TO_GROUP[team] === filterGroup)
        .sort(([, pctA], [, pctB]) => pctB - pctA),
    [filterGroup, rankings],
  )

  const loadMonteCarloData = useCallback(async () => {
    try {
      const payload = await fetchMonteCarloData()
      setRankings(payload.rankings)
      setStages(payload.stages)
      setDataError(payload.error)
    } catch {
      setDataError("Não foi possível carregar o Monte Carlo. Verifique se a API está rodando na porta 8000.")
    }
  }, [])

  const loadBracket = useCallback(
    async (mode = bracketMode) => {
      setBracketLoading(true)
      setBracketError("")
      try {
        const response = await axios.get(`${API}/probable-bracket?mode=${mode}`)
        const nextBracket = annotateManualMatches(response.data, {})
        setBracket(nextBracket)
        setBaseScenario(nextBracket)
        setBracketOverrides({})
        setGroupOverrides({})
      } catch {
        setBracketError("Não foi possível carregar o chaveamento. Verifique se a API está rodando.")
      } finally {
        setBracketLoading(false)
      }
    },
    [bracketMode],
  )

  const clearInteractiveChoices = useCallback(() => {
    if (!baseScenario) return
    const nextBracket = annotateManualMatches(baseScenario, {})
    setBracket(nextBracket)
    setBracketOverrides({})
    setGroupOverrides({})
    setSelectedMatch(null)
  }, [baseScenario])

  const applyGroupRanking = useCallback(
    async (group, ranking) => {
      if (!bracket) return

      const scenario = baseScenario || bracket
      const baseRanking = scenario.groups?.[group]?.ranking || GROUPS[group] || []
      const sanitizedRanking = ranking.filter((team) => (GROUPS[group] || []).includes(team))
      sanitizedRanking.push(...baseRanking.filter((team) => !sanitizedRanking.includes(team)))

      const nextGroupOverrides = { ...groupOverrides }
      if (sameRanking(sanitizedRanking, baseRanking)) {
        delete nextGroupOverrides[group]
      } else {
        nextGroupOverrides[group] = sanitizedRanking
      }

      setSelectedMatch(null)
      setInteractiveLoading(true)
      setBracketError("")

      if (Object.keys(nextGroupOverrides).length === 0) {
        const nextBracket = annotateManualMatches(scenario, {})
        setBracket(nextBracket)
        setBracketOverrides({})
        setGroupOverrides({})
        setInteractiveLoading(false)
        return
      }

      try {
        const response = await axios.post(`${API}/interactive-bracket`, {
          knockout_mode: bracketMode,
          base_bracket: baseBracketFrom(scenario),
          overrides: {},
          group_overrides: nextGroupOverrides,
          groups: scenario.groups || bracket.groups,
          best_thirds: scenario.best_thirds || bracket.best_thirds,
        })
        const nextBracket = annotateManualMatches(response.data, {})
        setBracket(nextBracket)
        setBracketOverrides({})
        setGroupOverrides(nextGroupOverrides)
      } catch {
        setBracketError("Não foi possível recalcular a fase de grupos. Verifique se a API está rodando.")
      } finally {
        setInteractiveLoading(false)
      }
    },
    [baseScenario, bracket, bracketMode, groupOverrides],
  )

  const moveGroupTeam = useCallback(
    (group, team, direction) => {
      const currentRanking =
        bracket?.groups?.[group]?.ranking ||
        baseScenario?.groups?.[group]?.ranking ||
        GROUPS[group] ||
        []
      const nextRanking = [...currentRanking]
      const currentIndex = nextRanking.indexOf(team)
      const nextIndex = currentIndex + direction

      if (currentIndex < 0 || nextIndex < 0 || nextIndex >= nextRanking.length) return

      ;[nextRanking[currentIndex], nextRanking[nextIndex]] = [nextRanking[nextIndex], nextRanking[currentIndex]]
      applyGroupRanking(group, nextRanking)
    },
    [applyGroupRanking, baseScenario, bracket],
  )

  const applyInteractiveWinner = useCallback(
    async (match, winner) => {
      if (!bracket) return

      const scenario = baseScenario || bracket
      const baseBracket = baseBracketFrom(scenario)
      const selectedKey = matchKey(match)
      const downstreamKeys = descendantMatchKeys(match)
      const lockedWinners = {}

      if (baseBracket.length !== 16) {
        setBracketError("Não foi possível identificar a base da chave para recalcular este cenário.")
        return
      }

      for (const item of bracket.matches || []) {
        const key = matchKey(item)
        if (!downstreamKeys.has(key)) {
          lockedWinners[key] = item.winner
        }
      }

      const nextManualOverrides = Object.fromEntries(
        Object.entries(bracketOverrides).filter(([key]) => !downstreamKeys.has(key)),
      )
      nextManualOverrides[selectedKey] = winner

      setInteractiveLoading(true)
      setBracketError("")
      try {
        const response = await axios.post(`${API}/interactive-bracket`, {
          knockout_mode: bracketMode,
          base_bracket: baseBracket,
          overrides: { ...lockedWinners, ...nextManualOverrides },
          group_overrides: groupOverrides,
          groups: scenario.groups || bracket.groups,
          best_thirds: scenario.best_thirds || bracket.best_thirds,
        })
        const nextBracket = annotateManualMatches(response.data, nextManualOverrides)
        setBracket(nextBracket)
        setBracketOverrides(nextManualOverrides)
        setSelectedMatch(nextBracket.matches.find((item) => matchKey(item) === selectedKey) || null)
      } catch {
        setBracketError("Não foi possível recalcular a chave interativa. Verifique se a API está rodando.")
      } finally {
        setInteractiveLoading(false)
      }
    },
    [baseScenario, bracket, bracketMode, bracketOverrides, groupOverrides],
  )

  useEffect(() => {
    fetchMonteCarloData()
      .then((payload) => {
        setRankings(payload.rankings)
        setStages(payload.stages)
        setDataError(payload.error)
      })
      .catch(() => setDataError("Não foi possível carregar o Monte Carlo. Verifique se a API está rodando na porta 8000."))
    axios
      .get(`${API}/probable-bracket?mode=favorite`)
      .then((response) => {
        const nextBracket = annotateManualMatches(response.data, {})
        setBracket(nextBracket)
        setBaseScenario(nextBracket)
        setGroupOverrides({})
      })
      .catch(() => setBracketError("Não foi possível carregar o chaveamento. Verifique se a API está rodando."))
      .finally(() => setBracketLoading(false))
  }, [])

  async function simulate() {
    setLoading(true)
    setResult(null)
    try {
      const response = await axios.post(`${API}/simulate`, { team_a: teamA, team_b: teamB })
      setResult(response.data)
    } finally {
      setLoading(false)
    }
  }

  async function changeBracketMode(mode) {
    setBracketMode(mode)
    setSelectedMatch(null)
    await loadBracket(mode)
  }

  function changeTab(nextTab) {
    setTab(nextTab)
  }

  return (
    <div style={page}>
      <header style={{ background: COLORS.bgCard, borderBottom: `1px solid ${COLORS.border}` }}>
        <div
          style={{
            ...shell,
            minHeight: 76,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
          }}
        >
          <div>
            <div style={{ fontSize: 20, fontWeight: 900, color: COLORS.amber }}>Oracle FC 2026</div>
            <div style={{ fontSize: 12, color: COLORS.textSecondary, marginTop: 4 }}>
              Modelo híbrido com Elo recente, elenco, Poisson e Monte Carlo
            </div>
          </div>
          <div
            style={{
              ...TYPE.label,
              fontSize: 12,
              color: COLORS.green,
              background: `${COLORS.green}20`,
              padding: "6px 12px",
              borderRadius: 999,
              border: `1px solid ${COLORS.green}40`,
              whiteSpace: "nowrap",
            }}
          >
            Copa começa em 11 Jun 2026
          </div>
        </div>
      </header>

      <nav style={{ borderBottom: `1px solid ${COLORS.border}`, background: COLORS.bgBase }}>
        <div style={{ ...shell, display: "flex", overflowX: "auto" }}>
          {tabs.map((item) => (
            <button
              key={item.id}
              onClick={() => changeTab(item.id)}
              style={{
                padding: "15px 20px",
                background: "transparent",
                border: 0,
                borderBottom: tab === item.id ? `3px solid ${COLORS.amber}` : "3px solid transparent",
                color: tab === item.id ? COLORS.amber : COLORS.textSecondary,
                cursor: "pointer",
                fontWeight: tab === item.id ? 900 : 700,
                fontSize: 14,
                whiteSpace: "nowrap",
                transition: "color 150ms ease, border-color 150ms ease",
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      </nav>

      <main style={{ ...shell, padding: "28px 0 44px" }}>
        {tab === "simulation" && (
          <>
            <section style={{ marginBottom: 22 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 16,
                  flexWrap: "wrap",
                  marginBottom: 14,
                }}
              >
                <div>
                  <h1 style={{ margin: 0, ...TYPE.headline }}>
                    Simulação do caminho da seleção
                  </h1>
                  <p style={{ margin: "6px 0 0", color: COLORS.textSecondary, ...TYPE.bodyLarge, fontWeight: 600 }}>
                    Clique em qualquer jogo para abrir probabilidades, xG, placar estimado e pênaltis.
                  </p>
                </div>

                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  {[
                    { id: "favorite", label: "Favoritos" },
                    { id: "realistic", label: "Realista" },
                  ].map((mode) => (
                    <button
                      key={mode.id}
                      onClick={() => changeBracketMode(mode.id)}
                      style={{
                        padding: "8px 12px",
                        borderRadius: 999,
                        border: "1px solid",
                        cursor: "pointer",
                        fontSize: 12,
                        fontWeight: 1000,
                        background: bracketMode === mode.id ? COLORS.amber : COLORS.bgCard,
                        color: bracketMode === mode.id ? COLORS.bgBase : COLORS.textSecondary,
                        borderColor: bracketMode === mode.id ? COLORS.amber : COLORS.border,
                        transition: "background 150ms ease, color 150ms ease, border-color 150ms ease",
                      }}
                    >
                      {mode.label}
                    </button>
                  ))}
                  <button
                    onClick={() => loadBracket()}
                    disabled={bracketLoading}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 999,
                      border: `1px solid ${COLORS.green}40`,
                      background: `${COLORS.green}20`,
                      color: COLORS.green,
                      cursor: bracketLoading ? "not-allowed" : "pointer",
                      fontSize: 12,
                      fontWeight: 1000,
                      opacity: bracketLoading ? 0.65 : 1,
                    }}
                  >
                    {bracketLoading ? "Gerando..." : "Novo cenário"}
                  </button>
                  {manualOverrideCount > 0 && (
                    <button
                      onClick={clearInteractiveChoices}
                      disabled={interactiveLoading}
                      style={{
                        padding: "8px 12px",
                        borderRadius: 999,
                        border: `1px solid ${COLORS.amber}66`,
                        background: `${COLORS.amber}18`,
                        color: COLORS.amber,
                        cursor: interactiveLoading ? "not-allowed" : "pointer",
                        fontSize: 12,
                        fontWeight: 1000,
                        opacity: interactiveLoading ? 0.65 : 1,
                      }}
                    >
                      Limpar escolhas ({manualOverrideCount})
                    </button>
                  )}
                </div>
              </div>

              {bracketError && (
                <div style={{ ...panelStyle, color: COLORS.red, marginBottom: 16 }}>{bracketError}</div>
              )}

              {bracket?.champion && (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(0, 1fr) auto",
                    gap: 14,
                    alignItems: "center",
                    marginBottom: 14,
                  }}
                >
                  <div style={{ ...panelStyle, padding: "12px 14px" }}>
                    <div style={{ color: COLORS.textSecondary, ...TYPE.label, marginBottom: 6 }}>
                      Campeão projetado no cenário
                    </div>
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <FlagBubble team={bracket.champion} size={42} active />
                      <div style={{ color: COLORS.textPrimary, fontSize: 24, fontWeight: 900 }}>{bracket.champion}</div>
                    </div>
                  </div>
                  <div
                    style={{
                      color: COLORS.green,
                      background: `${COLORS.green}20`,
                      border: `1px solid ${COLORS.green}40`,
                      borderRadius: 999,
                      padding: "8px 12px",
                      fontSize: 12,
                      fontWeight: 1000,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {bracket.knockout_mode === "favorite" ? "Maior probabilidade" : "Sorteio ponderado"}
                  </div>
                </div>
              )}

              {bracketLoading && !bracket && (
                <div style={{ color: COLORS.textSecondary, textAlign: "center", padding: 32 }}>Gerando chaveamento...</div>
              )}

              {bracket && <ProgressBracket bracket={bracket} onSelect={setSelectedMatch} />}
              {bracket && (
                <GroupStageSummary
                  bracket={bracket}
                  groupOverrides={groupOverrides}
                  onMoveTeam={moveGroupTeam}
                  canEdit
                  isUpdating={interactiveLoading}
                />
              )}
            </section>

          </>
        )}

        {tab === "montecarlo" && (
          <MonteCarloResults
            filteredRankings={filteredRankings}
            rankings={rankings}
            stages={stages}
            maxPct={maxPct}
            filterGroup={filterGroup}
            onFilterGroup={setFilterGroup}
            dataError={dataError}
            onReloadData={loadMonteCarloData}
          />
        )}

        {tab === "custom" && (
          <>
            <section style={{ marginBottom: 16 }}>
              <h1 style={{ margin: 0, ...TYPE.headline }}>
                Minha simulação
              </h1>
              <p style={{ margin: "6px 0 0", color: COLORS.textSecondary, ...TYPE.bodyLarge, fontWeight: 600 }}>
                Escolha duas seleções para ver probabilidades, xG e placares mais prováveis.
              </p>
            </section>

            <section style={panelStyle}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 1fr) auto minmax(0, 1fr)",
                gap: 16,
                alignItems: "end",
                marginBottom: 22,
              }}
            >
              <label style={{ display: "grid", gap: 7 }}>
                <span style={{ ...TYPE.label, color: COLORS.textSecondary }}>Seleção A</span>
                <select value={teamA} onChange={(event) => setTeamA(event.target.value)} style={selectStyle}>
                  {teams.map((team) => (
                    <option key={team} value={team}>
                      {team}
                    </option>
                  ))}
                </select>
              </label>
              <div style={{ color: COLORS.textSecondary, fontWeight: 900, paddingBottom: 12 }}>vs</div>
              <label style={{ display: "grid", gap: 7 }}>
                <span style={{ ...TYPE.label, color: COLORS.textSecondary }}>Seleção B</span>
                <select value={teamB} onChange={(event) => setTeamB(event.target.value)} style={selectStyle}>
                  {teams.map((team) => (
                    <option key={team} value={team}>
                      {team}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <button
              onClick={simulate}
              disabled={loading}
              style={{
                width: "100%",
                padding: 14,
                background: loading ? COLORS.border : COLORS.amber,
                color: loading ? COLORS.textSecondary : COLORS.bgBase,
                border: 0,
                borderRadius: 8,
                fontSize: 15,
                fontWeight: 1000,
                cursor: loading ? "not-allowed" : "pointer",
                marginBottom: 22,
              }}
            >
              {loading ? "Simulando..." : "Simular confronto"}
            </button>

            {result && (
              <div style={{ background: COLORS.bgBase, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: 16 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 16, alignItems: "center", marginBottom: 18 }}>
                  <div style={{ display: "grid", justifyItems: "center", gap: 7 }}>
                    <FlagBubble team={result.team_a} size={48} />
                    <strong>{result.team_a}</strong>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ color: COLORS.textSecondary, ...TYPE.label }}>Placar modal</div>
                    <div style={{ fontSize: 30, fontWeight: 1000 }}>{result.placar_estimado}</div>
                    <div style={{ color: COLORS.textSecondary, fontSize: 11 }}>xG {formatPct(result.xg_a)} - {formatPct(result.xg_b)}</div>
                  </div>
                  <div style={{ display: "grid", justifyItems: "center", gap: 7 }}>
                    <FlagBubble team={result.team_b} size={48} />
                    <strong>{result.team_b}</strong>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
                  {[
                    { label: `Vitória ${result.team_a}`, value: result.prob_vitoria_a, color: COLORS.green },
                    { label: "Empate", value: result.prob_empate, color: COLORS.amber },
                    { label: `Vitória ${result.team_b}`, value: result.prob_vitoria_b, color: COLORS.red },
                  ].map((item) => (
                    <div key={item.label} style={{ background: COLORS.bgCard, borderRadius: 8, padding: 13, textAlign: "center", border: `1px solid ${COLORS.border}` }}>
                      <div style={{ color: item.color, fontSize: 24, fontWeight: 1000 }}>{formatPct(item.value)}%</div>
                      <div style={{ color: COLORS.textSecondary, fontSize: 11, marginTop: 4 }}>{item.label}</div>
                    </div>
                  ))}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12 }}>
                  <Metric label={`Avança ${result.team_a}`} value={`${formatPct(result.prob_classifica_a)}%`} />
                  <Metric label={`Avança ${result.team_b}`} value={`${formatPct(result.prob_classifica_b)}%`} />
                </div>

                {result.placares_mais_provaveis?.length > 0 && (
                  <div style={{ marginTop: 14 }}>
                    <div style={{ color: COLORS.textSecondary, ...TYPE.label, marginBottom: 8 }}>
                      Principais placares pelo Poisson
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {result.placares_mais_provaveis.map((score) => (
                        <div
                          key={score.placar}
                          style={{
                            border: `1px solid ${COLORS.border}`,
                            background: COLORS.bgCard,
                            color: COLORS.textPrimary,
                            borderRadius: 999,
                            padding: "7px 10px",
                            fontSize: 12,
                            fontWeight: 900,
                          }}
                        >
                          {score.placar} <span style={{ color: COLORS.textSecondary }}>{formatPct(score.prob)}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            </section>
          </>
        )}

        {tab === "about" && <AboutPanel />}

      </main>

      <MatchDetails
        match={selectedMatch}
        onClose={() => setSelectedMatch(null)}
        onForceWinner={applyInteractiveWinner}
        canEdit={Boolean(bracket)}
        isUpdating={interactiveLoading}
      />
    </div>
  )
}

const selectStyle = {
  width: "100%",
  padding: "11px 12px",
  background: COLORS.bgCard,
  border: `1px solid ${COLORS.border}`,
  color: COLORS.textPrimary,
  borderRadius: 8,
  fontSize: 14,
  fontWeight: 800,
}

const panelStyle = {
  background: COLORS.bgCard,
  border: `1px solid ${COLORS.border}`,
  borderRadius: 8,
  padding: 16,
  boxShadow: "0 10px 28px rgba(0, 0, 0, 0.2)",
}
