import { runGiantsSimulation } from './run-giants.ts'
import { GIANTS_CONFIG, calcCombinedS } from './oracle.ts'
import { calcLiquidation } from './market-engine.ts'
import type { Position } from '../../shared/src/types.ts'

const snapshots = runGiantsSimulation()
const current = snapshots[snapshots.length - 1]
const launch = { price: GIANTS_CONFIG.launchPrice, S: GIANTS_CONFIG.launchS }

function fmt(n: number, d = 2): string { return n.toFixed(d) }
function pct(n: number, d = 1): string { return (n * 100).toFixed(d) + '%' }
function fmtPrice(n: number): string { return '$' + n.toFixed(2) }
function fmtTs(ts: number): string {
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

console.log('')
console.log('╔══════════════════════════════════════════════════════════════╗')
console.log('║          PROPHET RWP ORACLE — NY Giants Asset                ║')
console.log('║          Team-Performance Synthetic Perpetual                ║')
console.log('╚══════════════════════════════════════════════════════════════╝')
console.log('')

// ── Core State ──────────────────────────────────────────────────────────────
console.log('┌─ CORE STATE ─────────────────────────────────────────────────┐')
console.log(`│  Launch Price:       ${fmtPrice(GIANTS_CONFIG.launchPrice).padEnd(12)} (Sep 5, 2025 — 2025 season launch)    │`)
console.log(`│  Fair Price:         ${fmtPrice(current.price).padEnd(12)}                              │`)
console.log(`│  Mark Price:         ${fmtPrice(current.markPrice).padEnd(12)}                              │`)
const changePct = ((current.markPrice - GIANTS_CONFIG.launchPrice) / GIANTS_CONFIG.launchPrice * 100)
const changeSign = changePct >= 0 ? '+' : ''
console.log(`│  Change from Launch: ${(changeSign + changePct.toFixed(1) + '%').padEnd(12)}                              │`)
console.log('│                                                              │')
// Three-component state (present on the final offseason snapshot)
if (current.S_q !== undefined && current.S_o !== undefined) {
  const Sq = current.S_q
  const So = current.S_o
  const combinedS = calcCombinedS(Sq, So, GIANTS_CONFIG)
  const sqSign = Sq >= 0 ? '+' : ''
  const soSign = So >= 0 ? '+' : ''
  const csSign = combinedS >= 0 ? '+' : ''
  console.log(`│  Current Quality S_q:${(sqSign + fmt(Sq, 4)).padEnd(11)} (on-field: 4-13 season, injuries)   │`)
  console.log(`│  Fwd Optionality S_o:${(soSign + fmt(So, 4)).padEnd(11)} (Harbaugh hire, FA, draft capital)  │`)
  console.log(`│  Combined S:         ${(csSign + fmt(combinedS, 4)).padEnd(11)} (S_q + 0.75 × S_o)              │`)
} else {
  console.log(`│  Latent Strength S:  ${fmt(current.S, 4).padEnd(12)}(neg = below avg)          │`)
}
console.log(`│  Variance V:         ${fmt(current.V, 4).padEnd(12)}                              │`)
console.log(`│  Uncertainty U:      ${fmt(current.U, 4).padEnd(12)}(σ of latent state)        │`)
console.log(`│  Season Phase:       ${current.seasonPhase.toUpperCase().padEnd(12)}                              │`)
console.log('└──────────────────────────────────────────────────────────────┘')
console.log('')

// ── Market State ─────────────────────────────────────────────────────────────
console.log('┌─ MARKET STATE ───────────────────────────────────────────────┐')
console.log(`│  Funding Rate:       ${pct(current.fundingRate).padEnd(12)}annualized                    │`)
console.log(`│  Funding (hourly):   ${pct(current.fundingRate / 8760, 5).padEnd(12)}                              │`)
console.log(`│  Long OI:            $${(current.longOI / 1000).toFixed(0)}K`.padEnd(47) + '│')
console.log(`│  Short OI:           $${(current.shortOI / 1000).toFixed(0)}K`.padEnd(47) + '│')
console.log(`│  Total OI:           $${((current.longOI + current.shortOI) / 1000).toFixed(0)}K`.padEnd(47) + '│')
console.log('└──────────────────────────────────────────────────────────────┘')
console.log('')

// ── Example Liquidation Check ────────────────────────────────────────────────
const examplePosition: Position = {
  id: 'demo-long-1',
  side: 'long',
  entryPrice: 95.0,
  leverage: 5,
  collateral: 1000,
  size: 5000,
  timestamp: Date.now(),
}
const liqCheck = calcLiquidation(examplePosition, current.markPrice, current.U)

console.log('┌─ LIQUIDATION CHECK (Example: 5x Long @ $95.00) ─────────────┐')
console.log(`│  Entry Price:        ${fmtPrice(examplePosition.entryPrice).padEnd(12)}                              │`)
console.log(`│  Current Mark:       ${fmtPrice(current.markPrice).padEnd(12)}                              │`)
console.log(`│  Collateral:         ${fmtPrice(examplePosition.collateral).padEnd(12)}                              │`)
console.log(`│  Position Size:      ${fmtPrice(examplePosition.size).padEnd(12)}                              │`)
console.log(`│  Unrealized PnL:     ${fmtPrice(liqCheck.unrealizedPnl).padEnd(12)}                              │`)
console.log(`│  Margin Ratio:       ${pct(liqCheck.marginRatio).padEnd(12)}                              │`)
console.log(`│  Liq. Price:         ${fmtPrice(liqCheck.liquidationPrice).padEnd(12)}                              │`)
console.log(`│  Dynamic Buffer:     ${pct(liqCheck.dynamicBuffer).padEnd(12)}                              │`)
console.log(`│  Is Liquidatable:    ${(liqCheck.isLiquidatable ? '⚠️  YES' : '✅ NO').padEnd(12)}                              │`)
console.log('└──────────────────────────────────────────────────────────────┘')
console.log('')

// ── Price History Table ───────────────────────────────────────────────────────
console.log('┌─ PRICE HISTORY (Last 5 Snapshots) ───────────────────────────┐')
console.log('│  Date          Week  Event                    Price   Mark   │')
console.log('│  ─────────────────────────────────────────────────────────── │')
const last5 = snapshots.slice(-5)
for (const snap of last5) {
  const date = fmtTs(snap.timestamp).padEnd(15)
  const week = (snap.week ? `W${snap.week}` : 'OFF').padEnd(5)
  const event = (snap.event ?? '').slice(0, 24).padEnd(24)
  const price = fmtPrice(snap.price).padEnd(7)
  const mark = fmtPrice(snap.markPrice)
  console.log(`│  ${date}${week}${event}${price} ${mark}  │`)
}
console.log('└──────────────────────────────────────────────────────────────┘')
console.log('')

// ── Season Summary ────────────────────────────────────────────────────────────
const wins = snapshots.filter(s => s.seasonPhase === 'regular' && (s.event?.startsWith('✅') || s.event?.startsWith('🔥'))).length
const losses = snapshots.filter(s => s.seasonPhase === 'regular' && (s.event?.startsWith('❌') || s.event?.startsWith('💥'))).length
const ties = snapshots.filter(s => s.seasonPhase === 'regular' && s.event?.startsWith('🤝')).length
console.log('┌─ SEASON SUMMARY ─────────────────────────────────────────────┐')
console.log(`│  2025 Record:  ${wins}-${losses}-${ties}  |  Missed Playoffs                         │`)
console.log(`│  S Δ from launch: ${(current.S - GIANTS_CONFIG.launchS >= 0 ? '+' : '')}${fmt(current.S - GIANTS_CONFIG.launchS, 4)}                                    │`)
console.log(`│  Oracle snapshots generated: ${String(snapshots.length).padEnd(3)}                             │`)
console.log('└──────────────────────────────────────────────────────────────┘')
console.log('')
