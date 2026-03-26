import React from 'react'
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

const MARKETS = [
  {
    symbol: 'NYG',
    name: 'New York Giants',
    price: markPrice,
    change: change24h,
    funding: fundingRate,
    oi: totalOI,
    active: true,
  },
  // Scaffold — future markets
  {
    symbol: 'DAL',
    name: 'Dallas Cowboys',
    price: 112.45,
    change: 3.2,
    funding: 6.1,
    oi: 987_000,
    active: false,
    comingSoon: true,
  },
  {
    symbol: 'PHI',
    name: 'Philadelphia Eagles',
    price: 134.20,
    change: -1.8,
    funding: 7.8,
    oi: 2_100_000,
    active: false,
    comingSoon: true,
  },
  {
    symbol: 'WAS',
    name: 'Washington Commanders',
    price: 98.55,
    change: 0.5,
    funding: 5.3,
    oi: 654_000,
    active: false,
    comingSoon: true,
  },
]

export default function MarketSidebar() {
  return (
    <div style={{
      width: 240,
      flexShrink: 0,
      background: C.panel,
      borderRight: `1px solid ${C.border}`,
      overflowY: 'auto',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        padding: '10px 14px 8px',
        borderBottom: `1px solid ${C.border}`,
        fontSize: 10,
        fontWeight: 700,
        color: C.dim,
        letterSpacing: 1,
        flexShrink: 0,
      }}>
        MARKETS
      </div>

      {/* Search bar */}
      <div style={{ padding: '8px 10px', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        <input
          placeholder="Search..."
          style={{
            width: '100%',
            background: '#0d1e35',
            border: `1px solid ${C.border}`,
            borderRadius: 6,
            color: C.text,
            padding: '6px 10px',
            fontSize: 12,
            outline: 'none',
          }}
        />
      </div>

      {/* Market list */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {MARKETS.map(m => (
          <MarketRow key={m.symbol} market={m} />
        ))}
      </div>

      {/* Bottom info */}
      <div style={{
        padding: '12px 14px',
        borderTop: `1px solid ${C.border}`,
        flexShrink: 0,
      }}>
        <div style={{ fontSize: 10, color: C.dim, marginBottom: 6, fontWeight: 700, letterSpacing: 0.5 }}>
          NYG STATS
        </div>
        <StatRow label="S_q" value={'-0.263'} color={C.red} />
        <StatRow label="S_o" value={'+0.069'} color={C.blue} />
        <StatRow label="λ" value={'0.75'} color={C.gold} />
        <StatRow label="U (σ)" value={CURRENT_STATE.U.toFixed(3)} color={C.gold} />
        <StatRow label="Long OI" value={`$${(CURRENT_STATE.longOI / 1000).toFixed(0)}K`} color={C.green} />
        <StatRow label="Short OI" value={`$${(CURRENT_STATE.shortOI / 1000).toFixed(0)}K`} color={C.red} />
      </div>
    </div>
  )
}

function StatRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 11 }}>
      <span style={{ color: C.dim }}>{label}</span>
      <span style={{ color: color ?? C.text, fontWeight: 700, fontFamily: 'monospace' }}>{value}</span>
    </div>
  )
}

function MarketRow({ market }: { market: typeof MARKETS[0] }) {
  const isUp = market.change >= 0
  const isActive = market.active
  const isSoon = (market as any).comingSoon

  return (
    <div style={{
      padding: '10px 14px',
      borderBottom: `1px solid ${C.border}`,
      cursor: isActive ? 'default' : 'not-allowed',
      background: isActive ? '#0d1e35' : 'transparent',
      borderLeft: isActive ? `2px solid ${C.gold}` : '2px solid transparent',
      opacity: isSoon ? 0.45 : 1,
      transition: 'background 0.1s',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
        <div>
          <span style={{ fontWeight: 800, fontSize: 13, color: isActive ? C.gold : C.text }}>
            {market.symbol}
          </span>
          {isSoon && (
            <span style={{
              fontSize: 9, fontWeight: 700, color: C.dim,
              background: '#162040', borderRadius: 3, padding: '1px 5px', marginLeft: 6,
            }}>SOON</span>
          )}
          <div style={{ fontSize: 10, color: C.dim, marginTop: 1 }}>{market.name}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>
            ${market.price.toFixed(2)}
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, color: isUp ? C.green : C.red }}>
            {isUp ? '▲' : '▼'} {Math.abs(market.change).toFixed(1)}%
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: C.dim }}>
        <span>Funding: <span style={{ color: market.funding > 0 ? C.blue : C.red }}>{market.funding.toFixed(1)}%</span></span>
        <span>OI: ${(market.oi / 1e6).toFixed(2)}M</span>
      </div>
    </div>
  )
}
