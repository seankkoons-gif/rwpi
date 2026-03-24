import React from 'react'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { GAMES_DATA } from '../data/simulation'

const C = {
  bg: '#050a14', panel: '#0a1428', border: '#162040',
  gold: '#f5a623', blue: '#4a90e2', green: '#2f9e44',
  red: '#e03131', purple: '#9b59b6', text: '#e8eaf0', dim: '#5a6a8a',
}

function Panel({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: 20 }}>
      <div style={{ fontSize: 12, color: C.dim, fontWeight: 600, letterSpacing: 0.8, marginBottom: 16 }}>{title}</div>
      {children}
    </div>
  )
}

export default function PerformanceTab() {
  const chartData = GAMES_DATA.map(g => ({
    label: `W${g.week}`,
    scored: g.pointsScored,
    allowed: g.pointsAllowed,
    margin: g.margin,
    thirdDown: +(g.thirdDownPct * 100).toFixed(1),
    redZone: +(g.redZonePct * 100).toFixed(1),
    sts: g.specialTeamsScore,
    turnover: g.turnovers,
    sacks: g.sacks,
    turnoverDiff: g.sacks - g.turnovers,
    offYards: g.offensiveYards,
    win: g.win,
  }))

  const wins = GAMES_DATA.filter(g => g.win).length
  const losses = GAMES_DATA.filter(g => !g.win && g.margin !== 0).length
  const ties = GAMES_DATA.filter(g => g.margin === 0).length
  const totalScored = GAMES_DATA.reduce((s, g) => s + g.pointsScored, 0)
  const totalAllowed = GAMES_DATA.reduce((s, g) => s + g.pointsAllowed, 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Record card */}
      <div style={{
        background: 'linear-gradient(135deg, #0a1428 0%, #0d2040 100%)',
        border: `1px solid ${C.border}`, borderRadius: 8, padding: 24,
        display: 'flex', gap: 32, alignItems: 'center', flexWrap: 'wrap',
      }}>
        <div>
          <div style={{ fontSize: 11, color: C.dim, letterSpacing: 1, marginBottom: 4 }}>2024 REGULAR SEASON</div>
          <div style={{ fontSize: 36, fontWeight: 900, color: C.gold }}>{wins}-{losses}-{ties}</div>
          <div style={{ fontSize: 13, color: C.red, marginTop: 4, fontWeight: 600 }}>Missed Playoffs</div>
        </div>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          {[
            { label: 'Pts/Game', value: (totalScored / 17).toFixed(1), color: C.blue },
            { label: 'Pts Allowed/Game', value: (totalAllowed / 17).toFixed(1), color: C.red },
            { label: 'Point Diff', value: (totalScored - totalAllowed > 0 ? '+' : '') + (totalScored - totalAllowed), color: totalScored > totalAllowed ? C.green : C.red },
            { label: 'Avg 3rd Down%', value: (GAMES_DATA.reduce((s, g) => s + g.thirdDownPct, 0) / 17 * 100).toFixed(1) + '%', color: C.text },
          ].map(m => (
            <div key={m.label}>
              <div style={{ fontSize: 11, color: C.dim, letterSpacing: 0.8 }}>{m.label}</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: m.color }}>{m.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Points scored/allowed */}
      <Panel title="POINTS SCORED (BLUE) vs ALLOWED (RED) BY WEEK">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
            <XAxis dataKey="label" tick={{ fill: C.dim, fontSize: 11 }} />
            <YAxis tick={{ fill: C.dim, fontSize: 11 }} />
            <Tooltip
              contentStyle={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 6 }}
              labelStyle={{ color: C.dim }}
            />
            <Bar dataKey="scored" name="Scored" fill={C.blue} radius={[3, 3, 0, 0]} />
            <Bar dataKey="allowed" name="Allowed" fill={C.red} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Panel>

      {/* Margin */}
      <Panel title="WEEKLY POINT MARGIN">
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
            <XAxis dataKey="label" tick={{ fill: C.dim, fontSize: 11 }} />
            <YAxis tick={{ fill: C.dim, fontSize: 11 }} />
            <Tooltip contentStyle={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 6 }} labelStyle={{ color: C.dim }} />
            <ReferenceLine y={0} stroke={C.dim} />
            <Bar dataKey="margin" name="Margin" radius={[3, 3, 3, 3]}>
              {chartData.map((d, i) => (
                <rect key={i} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Panel>

      {/* Efficiency */}
      <Panel title="OFFENSIVE EFFICIENCY — 3RD DOWN % (GOLD) vs RED ZONE % (GREEN)">
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
            <XAxis dataKey="label" tick={{ fill: C.dim, fontSize: 11 }} />
            <YAxis tick={{ fill: C.dim, fontSize: 11 }} tickFormatter={v => v + '%'} />
            <Tooltip
              contentStyle={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 6 }}
              labelStyle={{ color: C.dim }}
              formatter={(v: number) => [v.toFixed(1) + '%', '']}
            />
            <ReferenceLine y={38} stroke={C.dim} strokeDasharray="4 2" label={{ value: 'League Avg 3rd', position: 'right', fill: C.dim, fontSize: 9 }} />
            <Line type="monotone" dataKey="thirdDown" stroke={C.gold} strokeWidth={2} dot={{ r: 3 }} name="3rd Down%" />
            <Line type="monotone" dataKey="redZone" stroke={C.green} strokeWidth={2} dot={{ r: 3 }} name="Red Zone%" />
          </LineChart>
        </ResponsiveContainer>
      </Panel>

      {/* Special teams & turnovers */}
      <div style={{ display: 'flex', gap: 16 }}>
        <Panel title="SPECIAL TEAMS SCORE BY WEEK">
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
              <XAxis dataKey="label" tick={{ fill: C.dim, fontSize: 10 }} />
              <YAxis tick={{ fill: C.dim, fontSize: 11 }} />
              <Tooltip contentStyle={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 6 }} labelStyle={{ color: C.dim }} />
              <ReferenceLine y={0} stroke={C.dim} />
              <Bar dataKey="sts" name="STS" fill={C.purple} radius={[3, 3, 3, 3]} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
        <Panel title="SACKS − TURNOVERS (POSITIVE = GOOD)">
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
              <XAxis dataKey="label" tick={{ fill: C.dim, fontSize: 10 }} />
              <YAxis tick={{ fill: C.dim, fontSize: 11 }} />
              <Tooltip contentStyle={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 6 }} labelStyle={{ color: C.dim }} />
              <ReferenceLine y={0} stroke={C.dim} />
              <Bar dataKey="turnoverDiff" name="Sacks−TOs" fill={C.blue} radius={[3, 3, 3, 3]} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
      </div>
    </div>
  )
}
