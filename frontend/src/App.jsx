import { useState, useEffect } from "react"
import axios from "axios"

const API = "http://127.0.0.1:8000"

const FLAGS = {
  "France": "🇫🇷", "Spain": "🇪🇸", "Argentina": "🇦🇷", "England": "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
  "Portugal": "🇵🇹", "Brazil": "🇧🇷", "Netherlands": "🇳🇱", "Morocco": "🇲🇦",
  "Belgium": "🇧🇪", "Germany": "🇩🇪", "Croatia": "🇭🇷", "Italy": "🇮🇹",
  "Colombia": "🇨🇴", "United States": "🇺🇸", "Mexico": "🇲🇽", "Uruguay": "🇺🇾",
  "Switzerland": "🇨🇭", "Japan": "🇯🇵", "Senegal": "🇸🇳", "Iran": "🇮🇷",
  "Denmark": "🇩🇰", "South Korea": "🇰🇷", "Ecuador": "🇪🇨", "Austria": "🇦🇹",
  "Turkey": "🇹🇷", "Australia": "🇦🇺", "Canada": "🇨🇦", "Ukraine": "🇺🇦",
  "Norway": "🇳🇴", "Panama": "🇵🇦", "Algeria": "🇩🇿", "Egypt": "🇪🇬",
  "Scotland": "🏴󠁧󠁢󠁳󠁣󠁴󠁿", "Paraguay": "🇵🇾", "Tunisia": "🇹🇳", "Ivory Coast": "🇨🇮",
  "Czech Republic": "🇨🇿", "Uzbekistan": "🇺🇿", "Qatar": "🇶🇦",
  "Saudi Arabia": "🇸🇦", "South Africa": "🇿🇦", "Jordan": "🇯🇴",
  "Cape Verde": "🇨🇻", "Ghana": "🇬🇭", "Curacao": "🇨🇼",
  "Haiti": "🇭🇹", "New Zealand": "🇳🇿", "Bosnia and Herzegovina": "🇧🇦",
  "DR Congo": "🇨🇩", "Iraq": "🇮🇶", "Croatia": "🇭🇷",
}

const GROUPS = {
  "A": ["Mexico","South Africa","South Korea","Czech Republic"],
  "B": ["Canada","Qatar","Switzerland","Bosnia and Herzegovina"],
  "C": ["Brazil","Morocco","Haiti","Scotland"],
  "D": ["United States","Paraguay","Australia","Turkey"],
  "E": ["Germany","Curacao","Ivory Coast","Ecuador"],
  "F": ["Netherlands","Japan","Tunisia","Ukraine"],
  "G": ["Belgium","Egypt","Iran","New Zealand"],
  "H": ["Spain","Cape Verde","Saudi Arabia","Uruguay"],
  "I": ["France","Senegal","Norway","Iraq"],
  "J": ["Argentina","Algeria","Austria","Jordan"],
  "K": ["Portugal","Uzbekistan","Colombia","DR Congo"],
  "L": ["England","Croatia","Ghana","Panama"],
}

const teamToGroup = {}
Object.entries(GROUPS).forEach(([g, teams]) => teams.forEach(t => teamToGroup[t] = g))

const GROUP_COLORS = {
  A:"#888780", B:"#D4537E", C:"#D85A30", D:"#EF9F27",
  E:"#1D9E75", F:"#1D9E75", G:"#7F77DD", H:"#378ADD",
  I:"#378ADD", J:"#7F77DD", K:"#534AB7", L:"#185FA5",
}

export default function App() {
  const [tab, setTab] = useState("rankings")
  const [rankings, setRankings] = useState({})
  const [teamA, setTeamA] = useState("Brazil")
  const [teamB, setTeamB] = useState("Argentina")
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [filterGroup, setFilterGroup] = useState("all")

  useEffect(() => {
    axios.get(`${API}/rankings`).then(r => setRankings(r.data.rankings))
  }, [])

  const simulate = async () => {
    setLoading(true)
    setResult(null)
    const r = await axios.post(`${API}/simulate`, { team_a: teamA, team_b: teamB })
    setResult(r.data)
    setLoading(false)
  }

  const teams = Object.keys(teamToGroup).sort()
  const maxPct = Math.max(...Object.values(rankings))

  const filteredRankings = Object.entries(rankings).filter(([team]) =>
    filterGroup === "all" || teamToGroup[team] === filterGroup
  )

  return (
    <div style={{ background: "#0a1628", minHeight: "100vh", color: "white", fontFamily: "sans-serif" }}>
      
      {/* Header */}
      <div style={{ background: "#0d1f3c", borderBottom: "1px solid #1e3a5f", padding: "1rem 2rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{ fontSize: "24px" }}>⚽</span>
          <div>
            <div style={{ fontSize: "18px", fontWeight: 600, color: "#EF9F27" }}>Oracle FC 2026</div>
            <div style={{ fontSize: "12px", color: "#5a7a96" }}>Motor preditivo · Monte Carlo 10k simulações</div>
          </div>
        </div>
        <div style={{ fontSize: "12px", color: "#5DCAA5", background: "#0F6E5620", padding: "4px 12px", borderRadius: "20px", border: "1px solid #0F6E5640" }}>
          Copa começa 11 Jun 2026
        </div>
      </div>

      {/* Tabs */}
      <div style={{ padding: "0 2rem", borderBottom: "1px solid #1e3a5f", display: "flex", gap: "0" }}>
        {["rankings", "simulate"].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: "14px 24px", background: "none", border: "none", cursor: "pointer",
            color: tab === t ? "#EF9F27" : "#5a7a96", fontWeight: tab === t ? 600 : 400,
            borderBottom: tab === t ? "2px solid #EF9F27" : "2px solid transparent",
            fontSize: "14px", textTransform: "capitalize"
          }}>
            {t === "rankings" ? "🏆 Rankings" : "⚔️ Simulador"}
          </button>
        ))}
      </div>

      <div style={{ padding: "2rem", maxWidth: "900px", margin: "0 auto" }}>

        {/* RANKINGS TAB */}
        {tab === "rankings" && (
          <div>
            <div style={{ marginBottom: "1.5rem" }}>
              <div style={{ fontSize: "13px", color: "#5a7a96", marginBottom: "8px" }}>Filtrar por grupo</div>
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                {["all", ...Object.keys(GROUPS)].map(g => (
                  <button key={g} onClick={() => setFilterGroup(g)} style={{
                    padding: "4px 12px", borderRadius: "20px", border: "1px solid",
                    cursor: "pointer", fontSize: "12px", fontWeight: 500,
                    background: filterGroup === g ? (GROUP_COLORS[g] || "#EF9F27") + "30" : "transparent",
                    color: filterGroup === g ? (GROUP_COLORS[g] || "#EF9F27") : "#5a7a96",
                    borderColor: filterGroup === g ? (GROUP_COLORS[g] || "#EF9F27") + "60" : "#1e3a5f",
                  }}>
                    {g === "all" ? "Todos" : `Grupo ${g}`}
                  </button>
                ))}
              </div>
            </div>

            {filteredRankings.map(([team, pct], i) => {
              const grp = teamToGroup[team]
              const color = GROUP_COLORS[grp] || "#888"
              return (
                <div key={team} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "10px 0", borderBottom: "1px solid #1e3a5f" }}>
                  <span style={{ fontSize: "12px", color: "#3d5166", minWidth: "24px", textAlign: "right" }}>{i + 1}</span>
                  <span style={{ fontSize: "20px", minWidth: "28px" }}>{FLAGS[team] || "🏳️"}</span>
                  <span style={{ fontSize: "14px", fontWeight: 500, flex: 1 }}>{team}</span>
                  <span style={{ fontSize: "11px", color: color, fontWeight: 600, minWidth: "20px" }}>{grp}</span>
                  <div style={{ width: "160px", height: "6px", background: "#1e3a5f", borderRadius: "3px", overflow: "hidden" }}>
                    <div style={{ width: `${(pct / maxPct) * 100}%`, height: "100%", background: color, borderRadius: "3px" }} />
                  </div>
                  <span style={{ fontSize: "13px", color: "#a0b4c8", minWidth: "40px", textAlign: "right" }}>{pct.toFixed(1)}%</span>
                </div>
              )
            })}
          </div>
        )}

        {/* SIMULATE TAB */}
        {tab === "simulate" && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: "16px", alignItems: "center", marginBottom: "2rem" }}>
              <div>
                <div style={{ fontSize: "12px", color: "#5a7a96", marginBottom: "6px" }}>Seleção A</div>
                <select value={teamA} onChange={e => setTeamA(e.target.value)} style={{
                  width: "100%", padding: "10px 12px", background: "#0d1f3c", border: "1px solid #1e3a5f",
                  color: "white", borderRadius: "8px", fontSize: "14px"
                }}>
                  {teams.map(t => <option key={t} value={t}>{FLAGS[t]} {t}</option>)}
                </select>
              </div>
              <div style={{ fontSize: "18px", color: "#5a7a96", paddingTop: "20px" }}>vs</div>
              <div>
                <div style={{ fontSize: "12px", color: "#5a7a96", marginBottom: "6px" }}>Seleção B</div>
                <select value={teamB} onChange={e => setTeamB(e.target.value)} style={{
                  width: "100%", padding: "10px 12px", background: "#0d1f3c", border: "1px solid #1e3a5f",
                  color: "white", borderRadius: "8px", fontSize: "14px"
                }}>
                  {teams.map(t => <option key={t} value={t}>{FLAGS[t]} {t}</option>)}
                </select>
              </div>
            </div>

            <button onClick={simulate} disabled={loading} style={{
              width: "100%", padding: "14px", background: loading ? "#1e3a5f" : "#EF9F27",
              color: loading ? "#5a7a96" : "#0a1628", border: "none", borderRadius: "8px",
              fontSize: "16px", fontWeight: 600, cursor: loading ? "not-allowed" : "pointer",
              marginBottom: "2rem"
            }}>
              {loading ? "Simulando..." : "⚽ Simular Confronto"}
            </button>

            {result && (
              <div style={{ background: "#0d1f3c", border: "1px solid #1e3a5f", borderRadius: "12px", padding: "2rem" }}>
                <div style={{ textAlign: "center", marginBottom: "1.5rem", fontSize: "14px", color: "#5a7a96" }}>
                  {FLAGS[result.team_a]} {result.team_a} vs {FLAGS[result.team_b]} {result.team_b}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px", marginBottom: "1.5rem" }}>
                  {[
                    { label: `Vitória ${result.team_a}`, val: result.prob_vitoria_a, color: "#5DCAA5" },
                    { label: "Empate", val: result.prob_empate, color: "#EF9F27" },
                    { label: `Vitória ${result.team_b}`, val: result.prob_vitoria_b, color: "#D85A30" },
                  ].map(({ label, val, color }) => (
                    <div key={label} style={{ textAlign: "center", background: "#0a1628", borderRadius: "8px", padding: "1rem" }}>
                      <div style={{ fontSize: "28px", fontWeight: 600, color }}>{val.toFixed(1)}%</div>
                      <div style={{ fontSize: "11px", color: "#5a7a96", marginTop: "4px" }}>{label}</div>
                    </div>
                  ))}
                </div>
                <div style={{ height: "8px", borderRadius: "4px", overflow: "hidden", display: "flex" }}>
                  <div style={{ width: `${result.prob_vitoria_a}%`, background: "#5DCAA5" }} />
                  <div style={{ width: `${result.prob_empate}%`, background: "#EF9F27" }} />
                  <div style={{ width: `${result.prob_vitoria_b}%`, background: "#D85A30" }} />
                </div>
                <div style={{ marginTop: "1.5rem", padding: "12px", background: "#0a1628", borderRadius: "8px", fontSize: "13px", color: "#5a7a96", textAlign: "center" }}>
                  {result.prob_vitoria_a > result.prob_vitoria_b
                    ? `Nosso modelo favorece ${result.team_a} com ${result.prob_vitoria_a.toFixed(1)}% de chance de vitória`
                    : result.prob_vitoria_b > result.prob_vitoria_a
                    ? `Nosso modelo favorece ${result.team_b} com ${result.prob_vitoria_b.toFixed(1)}% de chance de vitória`
                    : "Confronto equilibrado segundo nosso modelo"}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}