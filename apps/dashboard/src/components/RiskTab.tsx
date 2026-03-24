import React, { useState } from 'react'
import { CURRENT_STATE } from '../data/simulation'

const C = {
  bg: '#050a14', panel: '#0a1428', border: '#162040',
  gold: '#f5a623', blue: '#4a90e2', green: '#2f9e44',
  red: '#e03131', purple: '#9b59b6', text: '#e8eaf0', dim: '#5a6a8a',
}

// Inline market engine logic for live calculator
function calcRiskRegime(U: number) {
  if (U < 0.4) return { regime: 'calm', leverageCap: 20, mmRate: 0.025 }
  if (U < 0.7) return { regime: 'elevated', leverageCap: 10, mmRate: 0.04 }
  if (U < 1.0) return { regime: 'stressed', leverageCap: 5, mmRate: 0.065 }
  return { regime: 'crisis', leverageCap: 2, mmRate: 0.10 }
}

function calcFundingComponents(longOI: number, shortOI: number, U: number, mark: number, fair: number) {
  const total = longOI + shortOI
  const baseRate = 0.05
  const imbalanceComponent = total > 0 ? 0.20 * (longOI - shortOI) / total : 0
  const uncertaintyComponent = 0.10 * U
  const basisComponent = fair > 0 ? 0.15 * (mark - fair) / fair : 0
  const rawTotal = baseRate + imbalanceComponent + uncertaintyComponent + basisComponent
  return {
    baseRate,
    imbalanceComponent,
    uncertaintyComponent,
    basisComponent,
    total: Math.max(-0.60, Math.min(0.60, rawTotal)),
  }
}

function calcLiq(entry: number, leverage: number, side: 'long' | 'short', collateral: number, mark: number, U: number) {
  const { mmRate } = calcRiskRegime(U)
  const dynamicBuffer = mmRate * (1 + U * 0.5)
  const size = entry * leverage
  const mmRequired = size * dynamicBuffer
  let liqPrice: number, unrealizedPnl: number
  if (side === 'long') {
    unrealizedPnl = (mark - entry) * (size / entry)
    liqPrice = entry * (1 - (collateral - mmRequired) / size)
  } else {
    unrealizedPnl = (entry - mark) * (size / entry)
    liqPrice = entry * (1 + (collateral - mmRequired) / size)
  }
  const equity = collateral + unrealizedPnl
  const marginRatio = equity / size
  return { liqPrice, marginRatio, dynamicBuffer, mmRequired, unrealizedPnl, isLiquidatable: marginRatio < dynamicBuffer }
}

const REGIMES = [
  { label: 'Calm', range: 'U < 0.4', leverage: '20x', mm: '2.5%', color: C.green },
  { label: 'Elevated', range: '0.4 ≤ U < 0.7', leverage: '10x', mm: '4.0%', color: C.gold },
  { label: 'Stressed', range: '0.7 ≤ U < 1.0', leverage: '5x', mm: '6.5%', color: '#e67e22' },
  { label: 'Crisis', range: 'U ≥ 1.0', leverage: '2x', mm: '10.0%', color: C.red },
]

const SCENARIOS = [
  { label: '5x Long @ $95', entry: 95, leverage: 5, side: 'long' as const, collateral: 1000 },
  { label: '3x Short @ $110', entry: 110, leverage: 3, side: 'short' as const, collateral: 1500 },
  { label: '10x Long @ $85', entry: 85, leverage: 10, side: 'long' as const, collateral: 800 },
]

function pct(n: number, d = 1) { return (n * 100).toFixed(d) + '%' }

export default function RiskTab() {
  const cur = CURRENT_STATE
  const funding = calcFundingComponents(cur.longOI, cur.shortOI, cur.U, cur.markPrice, cur.price)
  const regime = calcRiskRegime(cur.U)

  const [entry, setEntry] = useState(95)
  const [leverage, setLeverage] = useState(5)
  const [side, setSide] = useState<'long' | 'short'>('long')
  const [collateral, setCollateral] = useState(1000)

  const liq = calcLiq(entry, leverage, side, collateral, cur.markPrice, cur.U)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Funding breakdown */}
      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: 24 }}>
        <div style={{ fontSize: 12, color: C.dim, fontWeight: 600, letterSpacing: 0.8, marginBottom: 16 }}>
          FUNDING RATE BREAKDOWN (ANNUALIZED)
        </div>
        <div style={{ fontFamily: 'monospace', fontSize: 14, lineHeight: 2.0 }}>
          <div>
            <span style={{ color: C.dim }}>r_total = r_base + r_imbalance + r_uncertainty + r_basis</span>
          </div>
          <div>
            <span style={{ color: C.dim }}>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; = </span>
            <span style={{ color: C.blue }}>{pct(funding.baseRate)}</span>
            <span style={{ color: C.dim }}> + </span>
            <span style={{ color: funding.imbalanceComponent >= 0 ? C.green : C.red }}>{funding.imbalanceComponent >= 0 ? '+' : ''}{pct(funding.imbalanceComponent)}</span>
            <span style={{ color: C.dim }}> + </span>
            <span style={{ color: C.purple }}>{pct(funding.uncertaintyComponent)}</span>
            <span style={{ color: C.dim }}> + </span>
            <span style={{ color: funding.basisComponent >= 0 ? C.gold : C.red }}>{funding.basisComponent >= 0 ? '+' : ''}{pct(funding.basisComponent)}</span>
          </div>
          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 8, marginTop: 4 }}>
            <span style={{ color: C.dim }}>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; = </span>
            <span style={{ color: C.gold, fontSize: 18, fontWeight: 800 }}>{pct(funding.total)}</span>
            <span style={{ color: C.dim }}> annualized</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 16, marginTop: 16, flexWrap: 'wrap', fontSize: 12 }}>
          {[
            { label: 'Base Rate', desc: 'Baseline LP compensation (fixed 5%)', color: C.blue },
            { label: 'Imbalance', desc: '0.20 × (longOI − shortOI) / totalOI', color: C.green },
            { label: 'Uncertainty', desc: '0.10 × U (higher U = more carry)', color: C.purple },
            { label: 'Basis', desc: '0.15 × (mark − fair) / fair', color: C.gold },
          ].map(c => (
            <div key={c.label} style={{ background: '#0d1e35', borderRadius: 6, padding: '10px 14px', flex: '1 1 180px' }}>
              <div style={{ color: c.color, fontWeight: 700, marginBottom: 4 }}>{c.label}</div>
              <div style={{ color: C.dim, fontSize: 11 }}>{c.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Regime table */}
      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: 20 }}>
        <div style={{ fontSize: 12, color: C.dim, fontWeight: 600, letterSpacing: 0.8, marginBottom: 16 }}>
          RISK REGIMES · CURRENT: <span style={{ color: regime.regime === 'calm' ? C.green : regime.regime === 'elevated' ? C.gold : C.red }}>{regime.regime.toUpperCase()}</span>
          <span style={{ color: C.dim, fontWeight: 400 }}> (U = {cur.U.toFixed(4)})</span>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr>
              {['Regime', 'U Range', 'Max Leverage', 'Maint. Margin', 'Status'].map(h => (
                <th key={h} style={{ padding: '8px 12px', color: C.dim, borderBottom: `1px solid ${C.border}`, fontWeight: 600, fontSize: 11, textAlign: 'left' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {REGIMES.map(r => {
              const isActive = r.label.toLowerCase() === regime.regime
              return (
                <tr key={r.label} style={{ background: isActive ? r.color + '11' : 'transparent', borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{ color: r.color, fontWeight: isActive ? 800 : 600 }}>
                      {isActive ? '▶ ' : ''}{r.label}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px', color: C.dim, fontFamily: 'monospace' }}>{r.range}</td>
                  <td style={{ padding: '10px 12px', color: C.text, fontWeight: 700 }}>{r.leverage}</td>
                  <td style={{ padding: '10px 12px', color: C.text }}>{r.mm}</td>
                  <td style={{ padding: '10px 12px' }}>
                    {isActive
                      ? <span style={{ color: r.color, fontWeight: 700, fontSize: 11 }}>● ACTIVE</span>
                      : <span style={{ color: C.dim, fontSize: 11 }}>—</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Interactive liquidation calculator */}
      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: 20 }}>
        <div style={{ fontSize: 12, color: C.dim, fontWeight: 600, letterSpacing: 0.8, marginBottom: 16 }}>
          LIQUIDATION CALCULATOR (LIVE)
        </div>
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 320px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[
              { label: 'Entry Price ($)', value: entry, set: setEntry, min: 1, max: 1000, step: 0.5 },
              { label: 'Leverage (x)', value: leverage, set: setLeverage, min: 1, max: 20, step: 1 },
              { label: 'Collateral ($)', value: collateral, set: setCollateral, min: 1, max: 100000, step: 100 },
            ].map(f => (
              <div key={f.label}>
                <label style={{ fontSize: 12, color: C.dim, display: 'block', marginBottom: 6 }}>{f.label}</label>
                <input
                  type="number"
                  value={f.value}
                  min={f.min} max={f.max} step={f.step}
                  onChange={e => f.set(+e.target.value)}
                  style={{
                    background: '#0d1e35', border: `1px solid ${C.border}`, borderRadius: 6,
                    color: C.text, padding: '8px 12px', fontSize: 14, width: '100%',
                    outline: 'none', fontFamily: 'monospace',
                  }}
                />
              </div>
            ))}
            <div>
              <label style={{ fontSize: 12, color: C.dim, display: 'block', marginBottom: 6 }}>Side</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {(['long', 'short'] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => setSide(s)}
                    style={{
                      flex: 1, padding: '8px', borderRadius: 6, cursor: 'pointer',
                      background: side === s ? (s === 'long' ? C.green : C.red) + '33' : '#0d1e35',
                      border: `1px solid ${side === s ? (s === 'long' ? C.green : C.red) : C.border}`,
                      color: side === s ? (s === 'long' ? C.green : C.red) : C.dim,
                      fontWeight: 700, fontSize: 13, textTransform: 'uppercase',
                    }}
                  >{s}</button>
                ))}
              </div>
            </div>
          </div>
          <div style={{ flex: '1 1 280px', background: '#0d1e35', borderRadius: 8, padding: 20 }}>
            <div style={{ fontSize: 12, color: C.dim, marginBottom: 16, fontWeight: 600 }}>RESULT</div>
            {[
              { label: 'Current Mark Price', value: `$${cur.markPrice.toFixed(2)}`, color: C.gold },
              { label: 'Position Size', value: `$${(entry * leverage).toFixed(2)}`, color: C.text },
              { label: 'Unrealized PnL', value: `${liq.unrealizedPnl >= 0 ? '+' : ''}$${liq.unrealizedPnl.toFixed(2)}`, color: liq.unrealizedPnl >= 0 ? C.green : C.red },
              { label: 'Margin Ratio', value: pct(liq.marginRatio), color: liq.isLiquidatable ? C.red : C.green },
              { label: 'Dynamic Buffer', value: pct(liq.dynamicBuffer), color: C.purple },
              { label: 'MM Required', value: `$${liq.mmRequired.toFixed(2)}`, color: C.text },
              { label: 'Liquidation Price', value: `$${liq.liqPrice.toFixed(2)}`, color: liq.isLiquidatable ? C.red : C.gold },
            ].map(r => (
              <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, fontSize: 13 }}>
                <span style={{ color: C.dim }}>{r.label}</span>
                <span style={{ color: r.color, fontWeight: 700, fontFamily: 'monospace' }}>{r.value}</span>
              </div>
            ))}
            <div style={{
              marginTop: 16, padding: '12px 16px', borderRadius: 6,
              background: liq.isLiquidatable ? C.red + '22' : C.green + '22',
              border: `1px solid ${liq.isLiquidatable ? C.red : C.green}44`,
              textAlign: 'center', fontWeight: 800, fontSize: 14,
              color: liq.isLiquidatable ? C.red : C.green,
            }}>
              {liq.isLiquidatable ? '⚠️ LIQUIDATABLE' : '✅ SAFE'}
            </div>
          </div>
        </div>
      </div>

      {/* Example scenarios */}
      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: 20 }}>
        <div style={{ fontSize: 12, color: C.dim, fontWeight: 600, letterSpacing: 0.8, marginBottom: 16 }}>
          EXAMPLE SCENARIOS
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr>
              {['Scenario', 'Entry', 'Mark', 'PnL', 'Margin', 'Liq Price', 'Status'].map(h => (
                <th key={h} style={{ padding: '8px 12px', color: C.dim, borderBottom: `1px solid ${C.border}`, fontWeight: 600, fontSize: 11, textAlign: 'left' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SCENARIOS.map(sc => {
              const r = calcLiq(sc.entry, sc.leverage, sc.side, sc.collateral, cur.markPrice, cur.U)
              return (
                <tr key={sc.label} style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: '10px 12px', color: C.text }}>{sc.label}</td>
                  <td style={{ padding: '10px 12px', color: C.dim, fontFamily: 'monospace' }}>${sc.entry}</td>
                  <td style={{ padding: '10px 12px', color: C.gold, fontFamily: 'monospace' }}>${cur.markPrice.toFixed(2)}</td>
                  <td style={{ padding: '10px 12px', color: r.unrealizedPnl >= 0 ? C.green : C.red, fontFamily: 'monospace' }}>
                    {r.unrealizedPnl >= 0 ? '+' : ''}${r.unrealizedPnl.toFixed(2)}
                  </td>
                  <td style={{ padding: '10px 12px', color: C.text, fontFamily: 'monospace' }}>{pct(r.marginRatio)}</td>
                  <td style={{ padding: '10px 12px', color: C.gold, fontFamily: 'monospace' }}>${r.liqPrice.toFixed(2)}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{ color: r.isLiquidatable ? C.red : C.green, fontWeight: 700, fontSize: 11 }}>
                      {r.isLiquidatable ? '⚠️ LIQ' : '✅ SAFE'}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
