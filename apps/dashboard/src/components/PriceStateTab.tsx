import React from 'react'
import {
  AreaChart, Area, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer, Legend,
} from 'recharts'
import { GIANTS_SNAPSHOTS } from '../data/simulation'

const C = {
  bg: '#050a14', panel: '#0a1428', border: '#162040',
  gold: '#f5a623', blue: '#4a90e2', green: '#2f9e44',
  red: '#e03131', purple: '#9b59b6', text: '#e8eaf0', dim: '#5a6a8a',
}

const data = GIANTS_SNAPSHOTS.map(s => ({
  label: s.label,
  mark: +s.markPrice.toFixed(3),
  fair: +s.price.toFixed(3),
  S: +s.S.toFixed(4),
  U: +s.U.toFixed(4),
  week: s.week,
  event: s.event,
}))

const majorEvents = [
  { label: 'W7', event: 'Eagles Blowout' },
  { label: 'W12', event: 'Bucs Domination' },
  { label: 'W15', event: 'Falcons Collapse' },
  { label: 'W17', event: 'Colts Win' },
]

function chartTip(props: any) {
  if (!props.active || !props.payload?.length) return null
  const d = props.payload[0]?.payload
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 6, padding: '10px 14px', fontSize: 12 }}>
      <div style={{ color: C.dim, marginBottom: 4 }}>{d?.label} {d?.event ? `· ${d.event}` : ''}</div>
      {props.payload.map((p: any, i: number) => (
        <div key={i} style={{ color: p.color }}>{p.name}: {typeof p.value === 'number' ? p.value.toFixed(4) : p.value}</div>
      ))}
    </div>
  )
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div style={{ fontSize: 12, color: C.dim, fontWeight: 600, letterSpacing: 0.8, marginBottom: 12 }}>
      {title}
    </div>
  )
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: 20 }}>
      {children}
    </div>
  )
}

export default function PriceStateTab() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Chart 1: Mark Price */}
      <Panel>
        <SectionHeader title="MARK PRICE (GOLD) vs FAIR PRICE (DIM)" />
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="goldGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={C.gold} stopOpacity={0.3} />
                <stop offset="95%" stopColor={C.gold} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
            <XAxis dataKey="label" tick={{ fill: C.dim, fontSize: 11 }} />
            <YAxis tick={{ fill: C.dim, fontSize: 11 }} tickFormatter={v => `$${v}`} domain={['auto', 'auto']} />
            <Tooltip content={chartTip} />
            <Area type="monotone" dataKey="mark" stroke={C.gold} fill="url(#goldGrad)" strokeWidth={2} name="Mark Price" />
            <Line type="monotone" dataKey="fair" stroke={C.dim} strokeWidth={1.5} strokeDasharray="4 2" dot={false} name="Fair Price" />
            {majorEvents.map(e => (
              <ReferenceLine key={e.label} x={e.label} stroke={C.border} strokeDasharray="4 4"
                label={{ value: e.event, position: 'top', fill: C.dim, fontSize: 9 }} />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </Panel>

      {/* Chart 2: Latent Strength S */}
      <Panel>
        <SectionHeader title="LATENT STRENGTH S (BLUE) — 0 = LEAGUE AVERAGE" />
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="blueGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={C.blue} stopOpacity={0.3} />
                <stop offset="95%" stopColor={C.blue} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
            <XAxis dataKey="label" tick={{ fill: C.dim, fontSize: 11 }} />
            <YAxis tick={{ fill: C.dim, fontSize: 11 }} />
            <Tooltip content={chartTip} />
            <ReferenceLine y={0} stroke={C.dim} strokeDasharray="4 2" label={{ value: 'League Avg', position: 'right', fill: C.dim, fontSize: 10 }} />
            <Area type="monotone" dataKey="S" stroke={C.blue} fill="url(#blueGrad)" strokeWidth={2} name="Latent S" />
            {majorEvents.map(e => (
              <ReferenceLine key={e.label} x={e.label} stroke={C.border} strokeDasharray="4 4" />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </Panel>

      {/* Chart 3: Uncertainty U */}
      <Panel>
        <SectionHeader title="UNCERTAINTY U (PURPLE) — DECREASES WITH INFORMATION" />
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="purpGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={C.purple} stopOpacity={0.4} />
                <stop offset="95%" stopColor={C.purple} stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
            <XAxis dataKey="label" tick={{ fill: C.dim, fontSize: 11 }} />
            <YAxis tick={{ fill: C.dim, fontSize: 11 }} />
            <Tooltip content={chartTip} />
            <Area type="monotone" dataKey="U" stroke={C.purple} fill="url(#purpGrad)" strokeWidth={2} name="Uncertainty U" />
          </AreaChart>
        </ResponsiveContainer>
        <div style={{ fontSize: 11, color: C.dim, marginTop: 8 }}>
          U = √V · Increases during offseason (information decay), decreases as game data arrives
        </div>
      </Panel>

      {/* Events table */}
      <Panel>
        <SectionHeader title="MAJOR EVENTS" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {GIANTS_SNAPSHOTS.filter(s => s.event?.startsWith('💥') || s.event?.startsWith('🔥')).map((s, i) => (
            <div key={i} style={{ display: 'flex', gap: 16, fontSize: 13 }}>
              <span style={{ color: C.dim, minWidth: 40 }}>{s.label}</span>
              <span style={{ flex: 1 }}>{s.event}</span>
              <span style={{ color: C.gold }}>${s.markPrice.toFixed(2)}</span>
              <span style={{ color: s.S >= 0 ? C.green : C.red }}>S={s.S.toFixed(3)}</span>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  )
}
