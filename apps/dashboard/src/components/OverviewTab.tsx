import React from 'react'
import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts'
import { GIANTS_SNAPSHOTS, CURRENT_STATE, LAUNCH_CONFIG, OFFSEASON_STATE, CURRENT_DATE_LABEL, LAST_SEASON_RECORD, CURRENT_HC } from '../data/simulation'

const C = {
  bg: '#050a14', panel: '#0a1428', border: '#162040',
  gold: '#f5a623', blue: '#4a90e2', green: '#2f9e44',
  red: '#e03131', purple: '#9b59b6', text: '#e8eaf0', dim: '#5a6a8a',
}

function Card({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{
      background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8,
      padding: '16px 20px', flex: 1, minWidth: 0,
    }}>
      <div style={{ fontSize: 11, color: C.dim, fontWeight: 600, letterSpacing: 0.8, marginBottom: 8 }}>
        {label.toUpperCase()}
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color: color ?? C.text }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: C.dim, marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

export default function OverviewTab() {
  const cur = CURRENT_STATE
  const changePct = ((cur.markPrice - LAUNCH_CONFIG.launchPrice) / LAUNCH_CONFIG.launchPrice * 100)
  const isUp = changePct >= 0

  const chartData = GIANTS_SNAPSHOTS.map(s => ({ label: s.label, price: +s.markPrice.toFixed(2) }))

  const regime = cur.U < 0.4 ? 'CALM' : cur.U < 0.7 ? 'ELEVATED' : cur.U < 1.0 ? 'STRESSED' : 'CRISIS'
  const regimeColor = cur.U < 0.4 ? C.green : cur.U < 0.7 ? C.gold : cur.U < 1.0 ? '#e67e22' : C.red

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Big price */}
      <div style={{ textAlign: 'center', padding: '24px 0 8px' }}>
        <div style={{ fontSize: 13, color: C.dim, marginBottom: 8 }}>MARK PRICE</div>
        <div style={{ fontSize: 56, fontWeight: 900, color: C.gold, letterSpacing: -2 }}>
          ${cur.markPrice.toFixed(2)}
        </div>
        <div style={{ fontSize: 18, fontWeight: 700, color: isUp ? C.green : C.red, marginTop: 6 }}>
          {isUp ? '▲' : '▼'} {Math.abs(changePct).toFixed(2)}% from launch (${LAUNCH_CONFIG.launchPrice.toFixed(2)})
        </div>
        <div style={{ fontSize: 13, color: C.dim, marginTop: 4 }}>
          Fair Price: ${cur.price.toFixed(2)} · Season Phase: {cur.seasonPhase.toUpperCase()}
        </div>
        <div style={{ marginTop: 10, display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <span style={{ background: '#0d1e35', border: `1px solid ${C.border}`, borderRadius: 4, padding: '3px 10px', fontSize: 11, color: C.gold, fontWeight: 700 }}>
            📅 Current State Date: {CURRENT_DATE_LABEL}
          </span>
          <span style={{ background: '#0d1e35', border: `1px solid ${C.border}`, borderRadius: 4, padding: '3px 10px', fontSize: 11, color: C.dim }}>
            Last completed season: {LAST_SEASON_RECORD}
          </span>
          <span style={{ background: '#0d1e35', border: `1px solid ${C.border}`, borderRadius: 4, padding: '3px 10px', fontSize: 11, color: C.blue }}>
            HC: {CURRENT_HC}
          </span>
        </div>
      </div>

      {/* Metrics grid */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <Card label="Mark Price" value={`$${cur.markPrice.toFixed(2)}`} sub={`Fair: $${cur.price.toFixed(2)}`} color={C.gold} />
        <Card label="Latent Strength S" value={cur.S.toFixed(4)} sub="0 = league average" color={cur.S >= 0 ? C.green : C.red} />
        <Card label="Uncertainty U" value={cur.U.toFixed(4)} sub={`σ of latent state`} color={C.purple} />
        <Card label="Funding Rate" value={`${(cur.fundingRate * 100).toFixed(1)}%`} sub="annualized" color={C.blue} />
        <Card
          label="OI Long / Short"
          value={`$${(cur.longOI / 1000).toFixed(0)}K / $${(cur.shortOI / 1000).toFixed(0)}K`}
          sub={`Net: ${cur.longOI > cur.shortOI ? 'Long' : 'Short'} biased`}
          color={C.text}
        />
        <Card label="Risk Regime" value={regime} sub={`U = ${cur.U.toFixed(3)}`} color={regimeColor} />
      </div>

      {/* Sparkline */}
      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: 20 }}>
        <div style={{ fontSize: 12, color: C.dim, fontWeight: 600, letterSpacing: 0.8, marginBottom: 12 }}>
          PRICE HISTORY — WEEK 1 TO NOW
        </div>
        <ResponsiveContainer width="100%" height={120}>
          <LineChart data={chartData}>
            <Line type="monotone" dataKey="price" stroke={C.gold} strokeWidth={2} dot={false} />
            <Tooltip
              contentStyle={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 6 }}
              labelStyle={{ color: C.dim, fontSize: 11 }}
              formatter={(v: number) => [`$${v.toFixed(2)}`, 'Mark Price']}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Recent events */}
      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: 20 }}>
        <div style={{ fontSize: 12, color: C.dim, fontWeight: 600, letterSpacing: 0.8, marginBottom: 12 }}>
          RECENT SNAPSHOTS
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {GIANTS_SNAPSHOTS.slice(-5).map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ minWidth: 36, fontSize: 12, color: C.dim, fontWeight: 600 }}>{s.label}</span>
              <span style={{ flex: 1, fontSize: 13, color: C.text }}>{s.event}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: C.gold }}>${s.markPrice.toFixed(2)}</span>
              <span style={{ fontSize: 12, color: s.S >= 0 ? C.green : C.red, minWidth: 50, textAlign: 'right' }}>
                S={s.S.toFixed(3)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
