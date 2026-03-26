import React, { useState } from 'react'
import { CURRENT_STATE } from '../../data/simulation'

const C = {
  bg: '#050a14', panel: '#0a1428', border: '#162040',
  gold: '#f5a623', blue: '#4a90e2', green: '#00c853',
  red: '#ff3d3d', text: '#e8eaf0', dim: '#5a6a8a',
}

const MARK = CURRENT_STATE.markPrice

// Demo positions
const DEMO_POSITIONS = [
  {
    symbol: 'NYG',
    side: 'SHORT' as const,
    size: 100,
    entryPrice: 91.20,
    markPrice: MARK,
    pnl: +247,
    pnlPct: +2.71,
    liqPrice: 100.42,
    margin: 1_824,
    leverage: 5,
  },
]

// Demo trade history
const DEMO_TRADES = [
  { side: 'SHORT', size: 100, price: 91.20, fee: 4.56, time: '2026-03-20 14:32', symbol: 'NYG' },
  { side: 'LONG',  size: 50,  price: 89.10, fee: 2.23, time: '2026-03-18 09:15', symbol: 'NYG' },
  { side: 'SHORT', size: 80,  price: 92.40, fee: 3.70, time: '2026-03-15 16:42', symbol: 'NYG' },
  { side: 'LONG',  size: 120, price: 87.50, fee: 5.25, time: '2026-03-12 11:08', symbol: 'NYG' },
  { side: 'LONG',  size: 60,  price: 90.30, fee: 2.71, time: '2026-03-10 13:55', symbol: 'NYG' },
  { side: 'SHORT', size: 200, price: 93.80, fee: 9.38, time: '2026-03-07 10:22', symbol: 'NYG' },
  { side: 'LONG',  size: 75,  price: 88.90, fee: 3.33, time: '2026-03-05 15:40', symbol: 'NYG' },
  { side: 'SHORT', size: 45,  price: 91.60, fee: 2.06, time: '2026-03-03 08:30', symbol: 'NYG' },
  { side: 'LONG',  size: 160, price: 86.20, fee: 6.90, time: '2026-02-28 14:15', symbol: 'NYG' },
  { side: 'SHORT', size: 90,  price: 94.10, fee: 4.23, time: '2026-02-25 11:00', symbol: 'NYG' },
]

type BottomTab = 'positions' | 'orders' | 'history' | 'funding' | 'analytics'

interface Props {
  activeTab: BottomTab
  onTabChange: (t: BottomTab) => void
  analyticsContent: React.ReactNode
}

export default function PositionPanel({ activeTab, onTabChange, analyticsContent }: Props) {
  const [closedPositions, setClosedPositions] = useState<string[]>([])

  const TABS: { id: BottomTab; label: string }[] = [
    { id: 'positions', label: 'Positions (1)' },
    { id: 'orders',   label: 'Open Orders' },
    { id: 'history',  label: 'Trade History' },
    { id: 'funding',  label: 'Funding' },
    { id: 'analytics',label: 'Analytics' },
  ]

  return (
    <div style={{
      background: C.panel,
      borderTop: `1px solid ${C.border}`,
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
      height: 280,
    }}>
      {/* Tab bar */}
      <div style={{
        display: 'flex',
        borderBottom: `1px solid ${C.border}`,
        flexShrink: 0,
        overflowX: 'auto',
      }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => onTabChange(t.id)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '8px 18px', fontSize: 12, fontWeight: 600,
              color: activeTab === t.id ? C.gold : C.dim,
              borderBottom: activeTab === t.id ? `2px solid ${C.gold}` : '2px solid transparent',
              whiteSpace: 'nowrap', transition: 'color 0.15s',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto' }}>
        {activeTab === 'positions' && (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                {['Symbol', 'Side', 'Size', 'Entry', 'Mark', 'PnL', 'PnL %', 'Liq Price', 'Margin', 'Actions'].map(h => (
                  <th key={h} style={{
                    padding: '7px 12px', color: C.dim, fontWeight: 600,
                    fontSize: 10, textAlign: 'left', whiteSpace: 'nowrap',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DEMO_POSITIONS.filter(p => !closedPositions.includes(p.symbol)).map((p, i) => (
                <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: '8px 12px', color: C.gold, fontWeight: 700 }}>{p.symbol}</td>
                  <td style={{ padding: '8px 12px', color: p.side === 'LONG' ? C.green : C.red, fontWeight: 700 }}>
                    {p.side}
                  </td>
                  <td style={{ padding: '8px 12px', color: C.text, fontFamily: 'monospace' }}>{p.size}</td>
                  <td style={{ padding: '8px 12px', color: C.text, fontFamily: 'monospace' }}>${p.entryPrice.toFixed(2)}</td>
                  <td style={{ padding: '8px 12px', color: C.gold, fontFamily: 'monospace' }}>${p.markPrice.toFixed(2)}</td>
                  <td style={{ padding: '8px 12px', color: p.pnl >= 0 ? C.green : C.red, fontWeight: 700, fontFamily: 'monospace' }}>
                    {p.pnl >= 0 ? '+' : ''}${p.pnl}
                  </td>
                  <td style={{ padding: '8px 12px', color: p.pnlPct >= 0 ? C.green : C.red, fontFamily: 'monospace' }}>
                    {p.pnlPct >= 0 ? '+' : ''}{p.pnlPct.toFixed(2)}%
                  </td>
                  <td style={{ padding: '8px 12px', color: C.red, fontFamily: 'monospace' }}>${p.liqPrice.toFixed(2)}</td>
                  <td style={{ padding: '8px 12px', color: C.text, fontFamily: 'monospace' }}>${p.margin.toLocaleString()}</td>
                  <td style={{ padding: '8px 12px' }}>
                    <button
                      onClick={() => setClosedPositions(prev => [...prev, p.symbol])}
                      style={{
                        padding: '4px 12px', borderRadius: 4, border: `1px solid ${C.red}`,
                        background: 'transparent', color: C.red, fontSize: 11, fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      Close
                    </button>
                  </td>
                </tr>
              ))}
              {closedPositions.length === DEMO_POSITIONS.length && (
                <tr>
                  <td colSpan={10} style={{ padding: '20px', textAlign: 'center', color: C.dim, fontSize: 12 }}>
                    No open positions
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}

        {activeTab === 'orders' && (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            height: '100%', gap: 8, padding: 20,
          }}>
            <div style={{ fontSize: 32 }}>📋</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>No open orders</div>
            <div style={{ fontSize: 12, color: C.dim }}>Place a limit or stop order to see it here</div>
          </div>
        )}

        {activeTab === 'history' && (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                {['Symbol', 'Side', 'Size', 'Price', 'Fee', 'Time'].map(h => (
                  <th key={h} style={{
                    padding: '7px 12px', color: C.dim, fontWeight: 600,
                    fontSize: 10, textAlign: 'left', whiteSpace: 'nowrap',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DEMO_TRADES.map((t, i) => (
                <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: '7px 12px', color: C.gold, fontWeight: 700 }}>{t.symbol}</td>
                  <td style={{ padding: '7px 12px', color: t.side === 'LONG' ? C.green : C.red, fontWeight: 700 }}>
                    {t.side}
                  </td>
                  <td style={{ padding: '7px 12px', color: C.text, fontFamily: 'monospace' }}>{t.size}</td>
                  <td style={{ padding: '7px 12px', color: C.text, fontFamily: 'monospace' }}>${t.price.toFixed(2)}</td>
                  <td style={{ padding: '7px 12px', color: C.dim, fontFamily: 'monospace' }}>${t.fee.toFixed(2)}</td>
                  <td style={{ padding: '7px 12px', color: C.dim, fontSize: 11 }}>{t.time}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {activeTab === 'funding' && <FundingTab />}

        {activeTab === 'analytics' && (
          <div style={{ padding: '12px 16px' }}>
            {analyticsContent}
          </div>
        )}
      </div>
    </div>
  )
}

function FundingTab() {
  const [countdown, setCountdown] = useState('')

  React.useEffect(() => {
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

  const fundingRate = CURRENT_STATE.fundingRate * 100
  const longOI = CURRENT_STATE.longOI
  const shortOI = CURRENT_STATE.shortOI
  const U = CURRENT_STATE.U
  const mark = CURRENT_STATE.markPrice
  const fair = CURRENT_STATE.price

  const total = longOI + shortOI
  const base = 5.0
  const imbalance = total > 0 ? 20 * (longOI - shortOI) / total : 0
  const uncertainty = 10 * U
  const basis = fair > 0 ? 15 * (mark - fair) / fair : 0

  return (
    <div style={{ padding: '12px 16px', display: 'flex', gap: 24, flexWrap: 'wrap' }}>
      {/* Current rate */}
      <div style={{ background: '#060e1f', border: `1px solid ${C.border}`, borderRadius: 8, padding: '14px 18px', minWidth: 200 }}>
        <div style={{ fontSize: 10, color: C.dim, fontWeight: 700, letterSpacing: 1, marginBottom: 8 }}>CURRENT RATE</div>
        <div style={{ fontSize: 28, fontWeight: 900, color: C.blue }}>{fundingRate.toFixed(2)}%</div>
        <div style={{ fontSize: 11, color: C.dim, marginTop: 2 }}>annualized</div>
        <div style={{ marginTop: 10, fontSize: 12, color: C.dim }}>
          Next funding in <span style={{ color: C.gold, fontWeight: 700 }}>{countdown}</span>
        </div>
        <div style={{ marginTop: 4, fontSize: 11, color: C.dim }}>
          Longs pay shorts at this rate
        </div>
      </div>

      {/* Formula breakdown */}
      <div style={{ background: '#060e1f', border: `1px solid ${C.border}`, borderRadius: 8, padding: '14px 18px', minWidth: 280 }}>
        <div style={{ fontSize: 10, color: C.dim, fontWeight: 700, letterSpacing: 1, marginBottom: 10 }}>RATE BREAKDOWN</div>
        <div style={{ fontFamily: 'monospace', fontSize: 12, lineHeight: 1.9 }}>
          <div>
            <span style={{ color: C.dim }}>r = base + imbalance + uncertainty + basis</span>
          </div>
          <div>
            <span style={{ color: C.dim }}>&nbsp;&nbsp;= </span>
            <span style={{ color: C.blue }}>{base.toFixed(1)}%</span>
            <span style={{ color: C.dim }}> + </span>
            <span style={{ color: imbalance >= 0 ? C.green : C.red }}>
              {imbalance >= 0 ? '+' : ''}{imbalance.toFixed(2)}%
            </span>
            <span style={{ color: C.dim }}> + </span>
            <span style={{ color: C.gold }}>{uncertainty.toFixed(2)}%</span>
            <span style={{ color: C.dim }}> + </span>
            <span style={{ color: basis >= 0 ? C.gold : C.red }}>
              {basis >= 0 ? '+' : ''}{basis.toFixed(2)}%
            </span>
          </div>
          <div style={{ borderTop: `1px solid ${C.border}`, marginTop: 4, paddingTop: 4 }}>
            <span style={{ color: C.dim }}>&nbsp;&nbsp;= </span>
            <span style={{ color: C.blue, fontWeight: 800, fontSize: 14 }}>{fundingRate.toFixed(2)}%</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          {[
            { label: 'Base', val: `${base.toFixed(1)}%`, color: C.blue, desc: 'Fixed LP comp' },
            { label: 'Imbalance', val: `${imbalance >= 0 ? '+' : ''}${imbalance.toFixed(2)}%`, color: imbalance >= 0 ? C.green : C.red, desc: '0.20 × OI skew' },
            { label: 'Uncertainty', val: `+${uncertainty.toFixed(2)}%`, color: C.gold, desc: '0.10 × U' },
            { label: 'Basis', val: `${basis >= 0 ? '+' : ''}${basis.toFixed(2)}%`, color: C.dim, desc: '0.15 × (M-F)/F' },
          ].map(c => (
            <div key={c.label} style={{
              background: '#0a1428', border: `1px solid ${C.border}`, borderRadius: 5,
              padding: '6px 10px', fontSize: 11,
            }}>
              <div style={{ color: c.color, fontWeight: 700 }}>{c.label}: {c.val}</div>
              <div style={{ color: C.dim, fontSize: 10 }}>{c.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
