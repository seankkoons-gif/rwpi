#!/usr/bin/env node
/**
 * calibrate.ts — Calibration search CLI for Prophet RWP Oracle
 *
 * Usage:
 *   node --experimental-strip-types packages/oracle/src/cli/calibrate.ts
 *   node --experimental-strip-types packages/oracle/src/cli/calibrate.ts --mode quick
 *   node --experimental-strip-types packages/oracle/src/cli/calibrate.ts --mode full
 *
 * Quick mode: 2,500 grid combinations, <30 seconds
 * Full mode: 500 random iterations, <5 minutes
 */

import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { generateNFLDataset } from '../calibration/dataset.ts'
import { runQuickSearch, runFullSearch } from '../calibration/search.ts'
import { generateCalibrationReport } from '../calibration/report.ts'
import type { CalibrationRunResult } from '../calibration/types.ts'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// ─── Parse args ───────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const modeArg = args.includes('--mode') ? args[args.indexOf('--mode') + 1] : 'quick'
const mode = (modeArg === 'full' ? 'full' : 'quick') as 'quick' | 'full'
const saveReport = !args.includes('--no-report')

// ─── Banner ───────────────────────────────────────────────────────────────────

console.log('')
console.log('╔══════════════════════════════════════════════════════════════╗')
console.log('║      PROPHET RWP ORACLE — CALIBRATION SEARCH                ║')
console.log(`║      Mode: ${mode.padEnd(52)}║`)
console.log('╚══════════════════════════════════════════════════════════════╝')
console.log('')

// ─── Generate dataset ─────────────────────────────────────────────────────────

process.stdout.write('📊 Generating synthetic NFL dataset (seed=42)... ')
const t0 = Date.now()
const dataset = generateNFLDataset(42)
console.log(`done (${Date.now() - t0}ms)`)
console.log(`   ${dataset.games.length} games | ${dataset.teams.length} teams | ${dataset.seasons.join(', ')}`)
console.log('')

// ─── Run calibration ──────────────────────────────────────────────────────────

const totalRuns = mode === 'quick' ? 2500 : 500
let lastPct = -1

function onProgress(completed: number, total: number, bestScore: number) {
  const pct = Math.floor(completed / total * 100)
  if (pct !== lastPct && pct % 10 === 0) {
    lastPct = pct
    process.stdout.write(`  [${pct.toString().padStart(3)}%] ${completed}/${total} runs, best=${bestScore.toFixed(4)}\n`)
  }
}

console.log(`🔍 Running ${mode} calibration (${totalRuns} combinations)...`)
console.log('')

const t1 = Date.now()
let topResults: CalibrationRunResult[]

if (mode === 'quick') {
  topResults = runQuickSearch(dataset.games, dataset.eloInputs, undefined, { onProgress, maxResults: 10, verbose: true })
} else {
  topResults = runFullSearch(dataset.games, dataset.eloInputs, undefined, { onProgress, maxResults: 10, verbose: true })
}

const searchMs = Date.now() - t1
console.log('')
console.log(`✅ Search complete in ${(searchMs / 1000).toFixed(1)}s`)
console.log('')

// ─── Print results ────────────────────────────────────────────────────────────

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('  TOP 10 CALIBRATION RUNS')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('')

for (let i = 0; i < topResults.length; i++) {
  const r = topResults[i]
  const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`
  console.log(`  ${medal} Run ${r.runId}: total=${r.scores.total.toFixed(4)} logLoss=${r.scores.logLoss.toFixed(4)} vsElo=${r.eloBenchmark.vsRWPI}`)
}
console.log('')

// ─── Best params detail ───────────────────────────────────────────────────────

const best = topResults[0]
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('  BEST PARAMETER SET')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('')
const defaults = {
  tanhSaturationPoint: 28, gameNoiseVariance: 0.42, alpha: 0.30,
  processNoise: 0.005, opponentScaleFactor: 0.50, marginWeight: 0.40,
  efficiencyWeight: 0.30, beta: 0.40,
}
for (const [key, defaultVal] of Object.entries(defaults)) {
  const bestVal = best.params[key as keyof typeof best.params] as number
  const delta = bestVal - defaultVal
  const sign = delta >= 0 ? '+' : ''
  const arrow = Math.abs(delta) < 0.001 ? '  ' : delta > 0 ? '↑' : '↓'
  console.log(`  ${arrow} ${key.padEnd(26)} ${defaultVal.toFixed(4).padStart(8)}  →  ${bestVal.toFixed(4).padStart(8)}  (${sign}${delta.toFixed(4)})`)
}
console.log('')
console.log(`  Score breakdown:`)
console.log(`    Log Loss:              ${best.scores.logLoss.toFixed(4)}`)
console.log(`    Calibration Error:     ${best.scores.calibrationError.toFixed(4)}`)
console.log(`    Stability Penalty:     ${best.scores.stabilityPenalty.toFixed(4)}`)
console.log(`    Overreaction Penalty:  ${best.scores.overreactionPenalty.toFixed(4)}`)
console.log(`    Offseason Realism:     ${best.scores.offseasonRealismPenalty.toFixed(4)}`)
console.log(`    Param Simplicity:      ${best.scores.paramSimplicityPenalty.toFixed(4)}`)
console.log(`    ─────────────────────────────`)
console.log(`    TOTAL:                 ${best.scores.total.toFixed(4)}`)
console.log('')
console.log(`  Elo Benchmark:`)
console.log(`    Elo log loss:          ${best.eloBenchmark.logLoss.toFixed(4)}`)
console.log(`    RWPI log loss:         ${best.scores.logLoss.toFixed(4)}`)
console.log(`    Verdict:               ${best.eloBenchmark.vsRWPI}`)
console.log('')

// ─── Giants report ────────────────────────────────────────────────────────────

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('  GIANTS BEHAVIORAL VALIDATION (BEST PARAMS)')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('')

const gr = best.giantsReport
const verdicts = gr.verdict
const check = (label: string, value: string, pass: boolean) => {
  console.log(`  ${pass ? '✅' : '❌'}  ${label.padEnd(38)} ${value}`)
}

check('Weak win ΔS bounded (<0.13)', gr.bigWeakWinMaxDeltaS.toFixed(4), verdicts.weakWinBounded)
check('Elite loss ΔS meaningful (< -0.03)', gr.eliteBlowoutLossDeltaS.toFixed(4), verdicts.eliteLossMeaningful)
check('Harbaugh price impact bounded', `$${gr.harbaughPriceImpact.toFixed(2)}`, verdicts.harbaughImpactBounded)
check('Offseason V real (>0.10 after 90d)', gr.offseasonVAfter90Days.toFixed(4), verdicts.offseasonUncertaintyReal)
console.log('')

const allPass = Object.values(verdicts).every(v => v)
if (allPass) {
  console.log('  ✅ All Giants behavioral checks PASS with best params')
} else {
  console.log('  ⚠️  Some Giants behavioral checks FAILED — review before updating GIANTS_CONFIG')
}
console.log('')

// ─── OU recommendation ────────────────────────────────────────────────────────

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('  FEATURE RECOMMENDATIONS')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('')
const offseasonOk = verdicts.offseasonUncertaintyReal
const stabilityOk = best.scores.stabilityPenalty < 0.01
if (offseasonOk && stabilityOk) {
  console.log('  OU (Ornstein-Uhlenbeck):  ✅ REMAIN DISABLED')
  console.log('    Rationale: processNoise provides sufficient offseason expansion')
  console.log('    Offseason V after 90d silence: ' + gr.offseasonVAfter90Days.toFixed(4) + ' > 0.10 ✓')
  console.log('    In-season stability penalty: ' + best.scores.stabilityPenalty.toFixed(4) + ' < 0.01 ✓')
} else if (!offseasonOk) {
  console.log('  OU (Ornstein-Uhlenbeck):  ⚠️  CONSIDER ENABLING (offseason V insufficient)')
} else {
  console.log('  OU (Ornstein-Uhlenbeck):  ⚠️  TUNE processNoise FIRST (stability elevated)')
}
console.log('')
console.log('  2D Drift State:           ✅ DEFERRED')
console.log('    Single-state S tracks well; adding drift dimension adds 2 params')
console.log('    without clear log loss improvement on current dataset size')
console.log('')
console.log('  Covariance Smoothing:     EXPERIMENT (see benchmark --report)')
console.log('  Funding Asymmetry:        EXPERIMENT (see benchmark --report)')
console.log('')

// ─── Generate markdown report ─────────────────────────────────────────────────

if (saveReport) {
  const reportContent = generateCalibrationReport({
    topResults,
    games: dataset.games,
    eloInputs: dataset.eloInputs,
    mode,
    durationMs: searchMs,
  })

  const reportsDir = join(__dirname, '../../../../reports')
  try { mkdirSync(reportsDir, { recursive: true }) } catch {}
  const reportPath = join(reportsDir, `calibration-${mode}-${Date.now()}.md`)
  writeFileSync(reportPath, reportContent)
  console.log(`📝 Markdown report saved: ${reportPath}`)
  console.log('')
}

// ─── Summary ─────────────────────────────────────────────────────────────────

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log(`  ✅ Calibration complete (${mode} mode, ${(searchMs/1000).toFixed(1)}s)`)
console.log(`  Best run: ${best.runId} | Score: ${best.scores.total.toFixed(4)} | vsElo: ${best.eloBenchmark.vsRWPI}`)
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('')
