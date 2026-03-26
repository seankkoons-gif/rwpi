import React, { useState, useEffect } from 'react'
import { CURRENT_STATE, LAUNCH_CONFIG } from '../../data/simulation'

const C = {
  bg: '#050a14', panel: '#0a1428', border: '#162040',
  gold: '#f5a623', blue: '#4a90e2', green: '#00c853',
  red: '#ff3d3d', text: '#e8eaf0', dim: '#5a6a8a',
}

const markPrice = CURRENT_STATE.markPrice
const change24h = ((markPrice - LAUNCH_CONFIG.launchPrice) / LAUNCH_CONFIG.launchPrice * 100)
const fundingRate = CURRENT_STATE.fundingRate * 100
const totalOI = CURRENT_STATE.longOI + CURRENT_STATE.shortOI
const VOLUME_24H = 2_400_000

function Divider() {
  return <div style={{ width: 1, height: 28, background: C.border, margin: '0 14px', flexShrink: 0 }} />
}

function Stat({ label, value, sub, valueColor }: { label: string; value: string; sub?: string; valueColor?: string }) {
  return (
    <div style={{ flexShrink: 0 }}>
      <div style={{ fontSize: 10, color: C.dim, letterSpacing: 0.4, marginBottom: 1 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color: valueColor ?? C.text, lineHeight: 1.2 }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: C.dim, lineHeight: 1.2 }}>{sub}</div>}
    </div>
  )
}

export default function TopBar() {
  const [countdown, setCountdown] = useState('')

  useEffect(() => {
    const now = new Date()
    const target = new Date(now)
    target.setHours(now.getHours() + 1, 0, 0, 0)
    if (target.getTime() < now.getTime()) target.setHours(target.getHours() + 1)

    const tick = () => {
      const diff = target.getTime() - Date.now()
      if (diff <= 0) { setCountdown('0m 0s'); return }
      const m = Math.floor(diff / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setCountdown(`${m}m ${s}s`)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  const isDown = change24h < 0

  return (
    <div style={{
      background: C.panel,
      borderBottom: `1px solid ${C.border}`,
      height: 52,
      display: 'flex',
      alignItems: 'center',
      padding: '0 16px',
      flexShrink: 0,
      overflowX: 'auto',
      gap: 0,
    }}>
      {/* Asset identity */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, marginRight: 6 }}>
        <div style={{
          width: 30, height: 30, borderRadius: '50%',
          background: C.gold, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 900, fontSize: 10, color: '#050a14', flexShrink: 0,
        }}>NYG</div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, color: C.text, lineHeight: 1.1 }}>New York Giants</div>
          <div style={{ fontSize: 10, color: C.dim, lineHeight: 1.1 }}>RWP Perpetual</div>
        </div>
      </div>

      <Divider />

      {/* Price */}
      <div style={{ flexShrink: 0, marginRight: 14 }}>
        <div style={{ fontSize: 20, fontWeight: 900, color: C.gold, letterSpacing: -0.5 }}>
          ${markPrice.toFixed(2)}
        </div>
        <div style={{ fontSize: 11, fontWeight: 700, color: isDown ? C.red : C.green }}>
          {isDown ? '▼' : '▲'} {Math.abs(change24h).toFixed(1)}%
        </div>
      </div>

      <Divider />
      <Stat label="24h Volume" value={`$${(VOLUME_24H / 1e6).toFixed(1)}M`} />
      <Divider />
      <Stat
        label="Funding Rate"
        value={`${fundingRate >= 0 ? '+' : ''}${fundingRate.toFixed(2)}% ann`}
        sub={countdown ? `next in ${countdown}` : ''}
        valueColor={fundingRate >= 0 ? C.green : C.red}
      />
      <Divider />
      <Stat label="Open Interest" value={`$${(totalOI / 1e6).toFixed(2)}M`} />
      <Divider />
      <Stat label="Mark" value={`$${markPrice.toFixed(2)}`} valueColor={C.gold} />
      <Divider />
      <Stat label="Oracle (Fair)" value={`$${CURRENT_STATE.price.toFixed(2)}`} valueColor={C.dim} />
      <Divider />
      <div style={{
        flexShrink: 0,
        fontSize: 10, fontWeight: 700, letterSpacing: 0.5,
        color: C.gold, background: '#f5a62322', border: `1px solid ${C.gold}44`,
        borderRadius: 4, padding: '3px 8px',
      }}>
        ELEVATED RISK · U={CURRENT_STATE.U.toFixed(3)} · 10x MAX
      </div>
    </div>
  )
}
