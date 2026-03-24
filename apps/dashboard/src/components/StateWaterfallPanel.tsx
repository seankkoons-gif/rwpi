import React, { useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ReferenceLine, ResponsiveContainer } from 'recharts'
import { STATE_WATERFALL, S_q, S_o, LAMBDA, COMBINED_S } from '../data/simulation'

const C = {
  bg: '#050a14', panel: '#0a1428', border: '#162040',
  gold: '#f5a623', blue: '#4a90e2', green: '#2f9e44',
  red: '#e03131', purple: '#9b59b6', text: '#e8eaf0', dim: '#5a6a8a',
}

const COLORS: Record<string, string> = {
  baseline: '#6b7a99',
  sq: C.red,
  so: C.blue,
  lambda: C.gold,
  result: C.text,
}

interface WaterfallEntry {
  label: string
  note: string
  component: string
  delta: number
  helper: number  // transparent spacer (lower bound of bar)
  bar: number     // visible bar height (always positive)
  running: number // cumulative value after this entry
  color: string
}

function buildWaterfall(): WaterfallEntry[] {
  const entries: WaterfallEntry[] = []
  let running = 0

  for (const entry of STATE_WATERFALL) {
    if (entry.component === 'baseline') {
      running = -0.15
      entries.push({
        label: entry.label,
        note: entry.note,
        component: entry.component,
        delta: -0.15,
        helper: -0.15,
        bar: 0.15,
        running,
        color: COLORS.baseline,
      })
    } else if (entry.component === 'result') {
      entries.push({
        label: entry.label,
        note: entry.note,
        component: entry.component,
        delta: 0,
        helper: COMBINED_S,
        bar: Math.abs(COMBINED_S),
        running: COMBINED_S,
        color: C.text,
      })
    } else {
      const start = running
      running = +(running + entry.delta).toFixed(4)
      const lower = Math.min(start, running)
      entries.push({
        label: entry.label,
        note: entry.note,
        component: entry.component,
        delta: entry.delta,
        helper: lower,
        bar: Math.abs(entry.delta),
        running,
        color: COLORS[entry.component] ?? C.dim,
      })
    }
  }
  return entries
}

function shortLabel(label: string): string {
  const map: Record<string, string> = {
    'Franchise baseline': 'Baseline',
    '2025 season losses': 'Season\nLosses',
    'Point diff drag': 'Pt Diff\nDrag',
    'Injuries (DL, OC)': 'Injuries',
    'Market odds drag': 'Odds\nDrag',
    'Harbaugh hire': 'Harbaugh\nHire',
    'FA + roster moves': 'FA\nMoves',
    'Draft capital (#7)': 'Draft\n#7',
    'Analytics projections': 'Analytics\nProj',
    'Optionality discount': 'λ\nDiscount',
    'Final combined S': 'Final\nS',
  }
  return map[label] ?? label
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload as WaterfallEntry
  if (!d) return null
  return (
    <div style={{
      background: C.panel, border: `1px solid ${C.border}`,
      borderRadius: 6, padding: '10px 14px', fontSize: 12,
    }}>
      <div style={{ color: C.text, fontWeight: 700, marginBottom: 4 }}>{d.label}</div>
      {d.component !== 'baseline' && d.component !== 'result' && (
        <div style={{ color: d.color, fontFamily: 'monospace' }}>
          Δ = {d.delta >= 0 ? '+' : ''}{d.delta.toFixed(4)}
        </div>
      )}
      <div style={{ color: C.dim, marginTop: 2 }}>
        → S = {d.running.toFixed(4)}
      </div>
      <div style={{ color: C.dim, marginTop: 4, fontSize: 11 }}>{d.note}</div>
    </div>
  )
}

export default function StateWaterfallPanel() {
  const data = useMemo(() => buildWaterfall(), [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Chart */}
      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: 20 }}>
        <div style={{ fontSize: 12, color: C.dim, fontWeight: 600, letterSpacing: 0.8, marginBottom: 4 }}>
          STATE WATERFALL — HOW S WAS BUILT
        </div>
        <div style={{ fontSize: 11, color: C.dim, marginBottom: 16 }}>
          Bridge chart: each bar shows the cumulative impact on combined S from launch (−0.15) to today (−0.211)
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
          {[
            { label: 'Baseline', color: COLORS.baseline },
            { label: 'S_q driver (negative)', color: C.red },
            { label: 'S_o driver (positive)', color: C.blue },
            { label: 'λ discount', color: C.gold },
            { label: 'Final S', color: C.text },
          ].map((l, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 12, height: 12, borderRadius: 2, background: l.color }} />
              <span style={{ fontSize: 11, color: C.dim }}>{l.label}</span>
            </div>
          ))}
        </div>

        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={data} margin={{ top: 10, right: 20, left: 20, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
            <XAxis
              dataKey="label"
              tick={({ x, y, payload }) => {
                const lines = shortLabel(payload.value).split('\n')
                return (
                  <g transform={`translate(${x},${y})`}>
                    {lines.map((line: string, i: number) => (
                      <text
                        key={i}
                        x={0}
                        y={i * 13 + 10}
                        textAnchor="middle"
                        fill={C.dim}
                        fontSize={10}
                      >
                        {line}
                      </text>
                    ))}
                  </g>
                )
              }}
              height={55}
            />
            <YAxis
              tick={{ fill: C.dim, fontSize: 11 }}
              tickFormatter={(v) => v.toFixed(2)}
              domain={[-0.40, 0.05]}
            />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={0} stroke={C.border} strokeWidth={1} />
            <ReferenceLine y={COMBINED_S} stroke={C.text} strokeDasharray="4 4" strokeWidth={1} />
            {/* Invisible spacer bar */}
            <Bar dataKey="helper" stackId="wf" fill="transparent" isAnimationActive={false} />
            {/* Visible delta bar */}
            <Bar dataKey="bar" stackId="wf" radius={[2, 2, 0, 0]} isAnimationActive={false}>
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.color} fillOpacity={entry.component === 'result' ? 0.6 : 0.9} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Equation breakdown */}
      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: 20 }}>
        <div style={{ fontSize: 12, color: C.dim, fontWeight: 600, letterSpacing: 0.8, marginBottom: 16 }}>
          FINAL EQUATION
        </div>
        <div style={{
          fontFamily: 'monospace', fontSize: 14, lineHeight: 2.2,
          color: C.text,
          background: '#060d1c',
          borderRadius: 6,
          padding: '16px 20px',
          border: `1px solid ${C.border}`,
        }}>
          <div>S<sub>combined</sub> = S<sub>q</sub> + λ × S<sub>o</sub></div>
          <div style={{ paddingLeft: 20 }}>
            {'= '}
            <span style={{ color: C.red }}>{S_q.toFixed(3)}</span>
            {' + '}
            <span style={{ color: C.gold }}>{LAMBDA}</span>
            {' × '}
            <span style={{ color: C.blue }}>{S_o.toFixed(3)}</span>
          </div>
          <div style={{ paddingLeft: 20 }}>
            {'= '}
            <span style={{ color: C.red }}>{S_q.toFixed(3)}</span>
            {' + '}
            <span style={{ color: C.gold }}>{(LAMBDA * S_o).toFixed(3)}</span>
          </div>
          <div style={{ paddingLeft: 20, fontWeight: 800, fontSize: 16 }}>
            {'= '}
            <span style={{ color: C.text }}>{COMBINED_S.toFixed(3)}</span>
          </div>
        </div>
        <div style={{ marginTop: 12, fontSize: 11, color: C.dim, lineHeight: 1.6 }}>
          <strong style={{ color: C.text }}>Reading the waterfall:</strong> The season losses (4-13),
          point differential (−58), injuries, and odds drag all compound negatively into S_q.
          The Harbaugh hire, FA moves, and draft capital (#7 pick) add positive optionality (S_o),
          but this is discounted by λ=0.75 because it hasn't been validated on-field yet.
          The final state of {COMBINED_S.toFixed(3)} sits below launch baseline, reflecting
          a rebuilding franchise with real but unrealized upside.
        </div>
      </div>

      {/* Step-by-step table */}
      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: 20 }}>
        <div style={{ fontSize: 12, color: C.dim, fontWeight: 600, letterSpacing: 0.8, marginBottom: 12 }}>
          STEP-BY-STEP TABLE
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '8px 10px', color: C.dim, borderBottom: `1px solid ${C.border}`, fontSize: 10, fontWeight: 700, letterSpacing: 0.5 }}>EVENT</th>
              <th style={{ textAlign: 'center', padding: '8px 10px', color: C.dim, borderBottom: `1px solid ${C.border}`, fontSize: 10, fontWeight: 700, letterSpacing: 0.5 }}>BUCKET</th>
              <th style={{ textAlign: 'right', padding: '8px 10px', color: C.dim, borderBottom: `1px solid ${C.border}`, fontSize: 10, fontWeight: 700, letterSpacing: 0.5 }}>Δ</th>
              <th style={{ textAlign: 'right', padding: '8px 10px', color: C.dim, borderBottom: `1px solid ${C.border}`, fontSize: 10, fontWeight: 700, letterSpacing: 0.5 }}>RUNNING S</th>
              <th style={{ textAlign: 'left', padding: '8px 10px', color: C.dim, borderBottom: `1px solid ${C.border}`, fontSize: 10, fontWeight: 700, letterSpacing: 0.5 }}>NOTE</th>
            </tr>
          </thead>
          <tbody>
            {data.map((entry, i) => (
              <tr key={i} style={{ borderBottom: `1px solid ${C.border}40` }}>
                <td style={{ padding: '9px 10px', color: C.text }}>{entry.label}</td>
                <td style={{ padding: '9px 10px', textAlign: 'center' }}>
                  <span style={{
                    fontSize: 10, fontWeight: 700,
                    color: entry.color,
                    background: `${entry.color}18`,
                    border: `1px solid ${entry.color}30`,
                    borderRadius: 3,
                    padding: '1px 6px',
                  }}>
                    {entry.component.toUpperCase()}
                  </span>
                </td>
                <td style={{
                  padding: '9px 10px', textAlign: 'right',
                  fontFamily: 'monospace',
                  color: entry.delta === 0 ? C.dim : entry.delta > 0 ? C.blue : C.red,
                  fontWeight: 700,
                }}>
                  {entry.delta === 0 ? '—' : (entry.delta > 0 ? '+' : '') + entry.delta.toFixed(4)}
                </td>
                <td style={{
                  padding: '9px 10px', textAlign: 'right',
                  fontFamily: 'monospace', color: entry.running < 0 ? C.red : C.green,
                  fontWeight: 700,
                }}>
                  {entry.running.toFixed(4)}
                </td>
                <td style={{ padding: '9px 10px', color: C.dim, fontSize: 11 }}>{entry.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
