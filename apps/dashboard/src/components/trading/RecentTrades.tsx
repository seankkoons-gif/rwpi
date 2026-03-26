import React, { useState, useEffect } from 'react'
import { RECENT_TRADES, RecentTrade } from '../../data/simulation'

const C = {
  bg: '#050a14', panel: '#0a1428', border: '#162040',
  gold: '#f5a623', blue: '#4a90e2', green: '#00c853',
  red: '#ff3d3d', text: '#e8eaf0', dim: '#5a6a8a',
}

// Generate a new trade periodically
function genTrade(markPrice: number): RecentTrade {
  const side = Math.random() > 0.5 ? 'buy' : 'sell'
  const price = +(markPrice + (Math.random() - 0.5) * 0.08).toFixed(2)
  const size = Math.round(10 + Math.random() * 180)
  return { side, price, size, ago: 'just now' }
}

export default function RecentTrades() {
  const [trades, setTrades] = useState<RecentTrade[]>(RECENT_TRADES)

  // Periodically prepend a new trade
  useEffect(() => {
    const id = setInterval(() => {
      setTrades(prev => {
        const newTrade = genTrade(88.73)
        return [newTrade, ...prev.slice(0, 19)]
      })
    }, 2500)
    return () => clearInterval(id)
  }, [])

  return (
    <div style={{
      width: 200,
      flexShrink: 0,
      background: C.panel,
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        padding: '8px 12px',
        borderBottom: `1px solid ${C.border}`,
        fontSize: 10,
        fontWeight: 700,
        color: C.dim,
        letterSpacing: 1,
        flexShrink: 0,
      }}>
        RECENT TRADES
      </div>

      {/* Column headers */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        padding: '4px 10px',
        fontSize: 10,
        color: C.dim,
        borderBottom: `1px solid ${C.border}`,
        flexShrink: 0,
      }}>
        <span>Price</span>
        <span style={{ textAlign: 'center' }}>Size</span>
        <span style={{ textAlign: 'right' }}>Time</span>
      </div>

      {/* Trade list */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {trades.map((t, i) => (
          <div
            key={i}
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              padding: '2px 10px',
              fontSize: 11,
              fontFamily: 'monospace',
              borderBottom: i === 0 ? `1px solid ${C.border}` : 'none',
              animation: i === 0 ? 'fadeIn 0.3s ease' : 'none',
            }}
          >
            <span style={{ color: t.side === 'buy' ? C.green : C.red, fontWeight: 600 }}>
              {t.price.toFixed(2)}
            </span>
            <span style={{ color: C.text, textAlign: 'center' }}>{t.size}</span>
            <span style={{ color: C.dim, textAlign: 'right', fontSize: 10 }}>{t.ago}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
