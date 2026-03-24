import React from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ResponsiveContainer } from 'recharts'
import { ATTRIBUTION_TOTALS, GIANTS_SNAPSHOTS, OFFSEASON_ATTRIBUTION, CURRENT_STATE, OFFSEASON_STATE } from '../data/simulation'

const C = {
  bg: '#050a14', panel: '#0a1428', border: '#162040',
  gold: '#f5a623', blue: '#4a90e2', green: '#2f9e44',
  red: '#e03131', purple: '#9b59b6', text: '#e8eaf0', dim: '#5a6a8a',
}

const SOURCE_LABELS: Record<string, string> = {
  game_result: 'Game Performance',
  injury_shock: 'Injuries',
  sentiment: 'Sentiment',
  market_odds: 'Market Odds',
  offseason_decay: 'Offseason Decay',
  coaching_reset: 'Coaching Reset (Harbaugh)',
  roster_moves: 'Roster / FA Moves',
  sentiment_narrative: 'Sentiment Narrative',
  point_diff_drag: '2025 Pt Diff Drag',
}

export default function AttributionTab() {
  const entries = Object.entries(ATTRIBUTION_TOTALS)
    .map(([k, v]) => ({ source: SOURCE_LABELS[k] ?? k, value: +v.toFixed(4), raw: k }))
    .sort((a, b) => b.value - a.value)

  const weeklyData = GIANTS_SNAPSHOTS.filter(s => s.seasonPhase === 'regular').map(s => ({
    label: s.label,
    game: +(s.attributions?.game_result ?? 0).toFixed(4),
    injury: +(s.attributions?.injury_shock ?? 0).toFixed(4),
    sentiment: +(s.attributions?.sentiment ?? 0).toFixed(4),
    odds: +(s.attributions?.market_odds ?? 0).toFixed(4),
  }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: 20 }}>
        <div style={{ fontSize: 12, color: C.dim, fontWeight: 600, letterSpacing: 0.8, marginBottom: 16 }}>
          TOTAL S ATTRIBUTION BY SOURCE
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={entries} layout="vertical" margin={{ left: 30, right: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.border} horizontal={false} />
            <XAxis type="number" tick={{ fill: C.dim, fontSize: 11 }} tickFormatter={v => v.toFixed(3)} />
            <YAxis type="category" dataKey="source" tick={{ fill: C.text, fontSize: 12 }} width={130} />
            <Tooltip
              contentStyle={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 6 }}
              formatter={(v: number) => [v.toFixed(5), 'ΔS']}
              labelStyle={{ color: C.dim }}
            />
            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
              {entries.map((e, i) => (
                <Cell key={i} fill={e.value >= 0 ? C.green : C.red} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Weekly stacked attribution */}
      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: 20 }}>
        <div style={{ fontSize: 12, color: C.dim, fontWeight: 600, letterSpacing: 0.8, marginBottom: 16 }}>
          WEEKLY ΔS BREAKDOWN
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={weeklyData}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
            <XAxis dataKey="label" tick={{ fill: C.dim, fontSize: 11 }} />
            <YAxis tick={{ fill: C.dim, fontSize: 11 }} tickFormatter={v => v.toFixed(2)} />
            <Tooltip
              contentStyle={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 6 }}
              labelStyle={{ color: C.dim }}
              formatter={(v: number) => [v.toFixed(4), '']}
            />
            <Bar dataKey="game" name="Game" stackId="a" fill={C.blue} />
            <Bar dataKey="injury" name="Injury" stackId="a" fill={C.red} />
            <Bar dataKey="sentiment" name="Sentiment" stackId="a" fill={C.purple} />
            <Bar dataKey="odds" name="Market Odds" stackId="a" fill={C.gold} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Summary table */}
      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: 20 }}>
        <div style={{ fontSize: 12, color: C.dim, fontWeight: 600, letterSpacing: 0.8, marginBottom: 16 }}>
          ATTRIBUTION SUMMARY
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '8px 12px', color: C.dim, borderBottom: `1px solid ${C.border}`, fontWeight: 600, fontSize: 11 }}>SOURCE</th>
              <th style={{ textAlign: 'right', padding: '8px 12px', color: C.dim, borderBottom: `1px solid ${C.border}`, fontWeight: 600, fontSize: 11 }}>TOTAL ΔS</th>
              <th style={{ textAlign: 'right', padding: '8px 12px', color: C.dim, borderBottom: `1px solid ${C.border}`, fontWeight: 600, fontSize: 11 }}>DIRECTION</th>
              <th style={{ textAlign: 'right', padding: '8px 12px', color: C.dim, borderBottom: `1px solid ${C.border}`, fontWeight: 600, fontSize: 11 }}>% SHARE</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e, i) => {
              const total = entries.reduce((sum, x) => sum + Math.abs(x.value), 0)
              const share = (Math.abs(e.value) / total * 100).toFixed(1)
              return (
                <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: '10px 12px', color: C.text }}>{e.source}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', color: e.value >= 0 ? C.green : C.red, fontFamily: 'monospace' }}>
                    {e.value >= 0 ? '+' : ''}{e.value.toFixed(5)}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                    <span style={{ color: e.value >= 0 ? C.green : C.red }}>{e.value >= 0 ? '▲ Positive' : '▼ Negative'}</span>
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', color: C.dim }}>{share}%</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <div style={{ marginTop: 16, padding: 12, background: '#0d1e35', borderRadius: 6, fontSize: 12, color: C.dim }}>
          <strong style={{ color: C.text }}>Note:</strong> Attribution is the cumulative Kalman gain × residual (z − S) for each observation source.
          Positive = signal pushed strength up; negative = dragged it down.
        </div>
      </div>

      {/* March 24, 2026 current-state breakdown */}
      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: 20 }}>
        <div style={{ fontSize: 12, color: C.gold, fontWeight: 700, letterSpacing: 0.8, marginBottom: 4 }}>
          MARCH 24, 2026 — WHY IS NYG PRICED HERE?
        </div>
        <div style={{ fontSize: 12, color: C.dim, marginBottom: 16 }}>
          Current mark ${CURRENT_STATE.markPrice.toFixed(2)} | S = {CURRENT_STATE.S.toFixed(4)} | U = {CURRENT_STATE.U.toFixed(4)}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {Object.entries(OFFSEASON_ATTRIBUTION).map(([label, val], i) => {
            const pct = Math.abs(val) / Object.values(OFFSEASON_ATTRIBUTION).reduce((a, v) => a + Math.abs(v), 0) * 100
            const isPos = val >= 0
            return (
              <div key={i}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: C.text }}>{label}</span>
                  <span style={{ fontSize: 12, fontFamily: 'monospace', color: isPos ? C.green : C.red, fontWeight: 700 }}>
                    {isPos ? '+' : ''}{val.toFixed(5)} ΔS
                  </span>
                </div>
                <div style={{ background: '#0a1428', borderRadius: 3, height: 6, overflow: 'hidden' }}>
                  <div style={{
                    width: `${Math.min(100, pct)}%`, height: '100%',
                    background: isPos ? C.green : C.red, borderRadius: 3,
                    opacity: 0.85,
                  }} />
                </div>
              </div>
            )
          })}
        </div>
        <div style={{ marginTop: 16, padding: 12, background: '#0d1e35', borderRadius: 6, fontSize: 12, color: C.dim }}>
          <strong style={{ color: C.text }}>Reading this:</strong> The 2025 season damage (4–13, −58 pt diff) drove S deeply negative.
          The Harbaugh coaching reset partially offsets this — an elite HC hire lifts expected future value even when
          the roster is not yet rebuilt. The team is <em>below average but not dead</em>: S = {CURRENT_STATE.S.toFixed(3)},
          priced at ${CURRENT_STATE.markPrice.toFixed(2)} vs $100 launch. Elevated uncertainty (U = {CURRENT_STATE.U.toFixed(3)})
          reflects a new system, an unproven roster under a new coach, and no live games since January.
        </div>
      </div>
    </div>
  )
}
