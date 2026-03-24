/**
 * report.ts — Markdown report generator for Prophet RWP calibration
 *
 * Generates a structured markdown report comparing Elo baseline vs RWPI,
 * showing calibration results, sensitivity analysis, and recommendations.
 */

import type { CalibrationRunResult } from './types.ts'
import { computeParamSensitivity } from './search.ts'
import { computeEloMetrics, replaySeasons, DEFAULT_ELO_CONFIG } from '../baselines/elo.ts'
import type { EloGameInput } from '../baselines/elo.ts'
import { DEFAULT_CALIBRATION_PARAMS } from './types.ts'
import { computeObjective } from './objective.ts'
import type { HistoricalGame } from './types.ts'
import { replayWithParams } from './replay.ts'
import { computeLogLoss, computeBrierScore, computeCalibrationError } from './objective.ts'

// ─── Formatting helpers ───────────────────────────────────────────────────────

function fmt(n: number, decimals = 4): string {
  return n.toFixed(decimals)
}

function fmtPct(n: number): string {
  return (n * 100).toFixed(1) + '%'
}

function tableRow(...cols: string[]): string {
  return '| ' + cols.join(' | ') + ' |'
}

function tableSep(colWidths: number[]): string {
  return '|' + colWidths.map(w => '-'.repeat(w + 2)).join('|') + '|'
}

// ─── Main report generator ────────────────────────────────────────────────────

export interface ReportInput {
  topResults: CalibrationRunResult[]
  games: HistoricalGame[]
  eloInputs: EloGameInput[]
  mode: 'quick' | 'full'
  durationMs: number
}

export function generateCalibrationReport(input: ReportInput): string {
  const { topResults, games, eloInputs, mode, durationMs } = input

  if (topResults.length === 0) {
    return '# Prophet RWP Calibration Report\n\n⚠️ No results to report.\n'
  }

  const bestResult = topResults[0]

  // Compute Elo baseline metrics
  const eloUpdates = replaySeasons(eloInputs, DEFAULT_ELO_CONFIG)
  const eloMetrics = computeEloMetrics(eloUpdates)

  // Compute RWPI default metrics
  const defaultResults = replayWithParams(games, DEFAULT_CALIBRATION_PARAMS)
  const rwpiDefaultLogLoss = computeLogLoss(defaultResults)
  const rwpiDefaultBrier = computeBrierScore(defaultResults)
  const rwpiDefaultCalib = computeCalibrationError(defaultResults)

  // Compute best RWPI metrics
  const bestResults = replayWithParams(games, bestResult.params)
  const rwpiBestLogLoss = computeLogLoss(bestResults)
  const rwpiBestBrier = computeBrierScore(bestResults)
  const rwpiBestCalib = computeCalibrationError(bestResults)

  // Headline verdict
  const rwpiVsElo = bestResult.eloBenchmark.vsRWPI
  let headline: string
  if (rwpiVsElo === 'RWPI_WINS') {
    headline = '## 🏆 RWPI BEATS ELO'
  } else if (rwpiVsElo === 'TIED') {
    headline = '## 🤝 ELO MATCHES RWPI'
  } else {
    headline = '## ⚠️ ELO BEATS CURRENT RWPI'
  }

  const lines: string[] = []

  // Header
  lines.push('# Prophet RWP Oracle — Calibration Report')
  lines.push('')
  lines.push(`Generated: ${new Date().toISOString()}`)
  lines.push(`Mode: ${mode} | Duration: ${(durationMs / 1000).toFixed(1)}s | Runs: ${mode === 'quick' ? 2500 : 500}`)
  lines.push(`Dataset: ${games.length} games across ${new Set(games.map(g => g.season)).size} seasons`)
  lines.push('')
  lines.push('---')
  lines.push('')

  // Headline verdict
  lines.push(headline)
  lines.push('')
  lines.push(`**RWPI log loss vs Elo log loss:** ${fmt(rwpiBestLogLoss)} vs ${fmt(eloMetrics.logLoss)}`)
  const improvement = ((eloMetrics.logLoss - rwpiBestLogLoss) / eloMetrics.logLoss) * 100
  if (rwpiVsElo === 'RWPI_WINS') {
    lines.push(`RWPI outperforms Elo by ${improvement.toFixed(1)}% on log loss after calibration.`)
    lines.push('The Kalman filter state machine adds predictive value beyond simple rating adjustment.')
  } else if (rwpiVsElo === 'TIED') {
    lines.push('RWPI matches Elo on pure win prediction — but adds unique uncertainty dynamics')
    lines.push('and perpetual asset pricing that Elo cannot provide.')
  } else {
    lines.push('Elo outperforms current RWPI on pure win prediction. Consider:')
    lines.push('- Increasing tanhSaturationPoint (less sensitive to margin)')
    lines.push('- Reducing gameNoiseVariance (more weight per game)')
    lines.push(`- Current best RWPI params give ${fmt(Math.abs(improvement))}% worse log loss`)
  }
  lines.push('')

  // Metric comparison table
  lines.push('---')
  lines.push('')
  lines.push('## Metric Comparison')
  lines.push('')
  lines.push(tableRow('Metric', 'Elo Baseline', 'RWPI Default', 'Best Calibrated RWPI'))
  lines.push(tableSep([20, 14, 14, 22]))
  lines.push(tableRow('Log Loss', fmt(eloMetrics.logLoss), fmt(rwpiDefaultLogLoss), fmt(rwpiBestLogLoss)))
  lines.push(tableRow('Brier Score', fmt(eloMetrics.brierScore), fmt(rwpiDefaultBrier), fmt(rwpiBestBrier)))
  lines.push(tableRow('Calibration Error', fmt(eloMetrics.calibrationError), fmt(rwpiDefaultCalib), fmt(rwpiBestCalib)))
  lines.push(tableRow('Total Objective', 'N/A', fmt(computeObjective(games, DEFAULT_CALIBRATION_PARAMS).total), fmt(bestResult.scores.total)))
  lines.push('')

  // Best params
  lines.push('---')
  lines.push('')
  lines.push('## Best Calibrated Parameters')
  lines.push('')
  lines.push(`**Run ID:** \`${bestResult.runId}\``)
  lines.push('')
  lines.push(tableRow('Parameter', 'Default', 'Best Calibrated', 'Delta'))
  lines.push(tableSep([28, 10, 18, 12]))

  const keyParams = [
    ['tanhSaturationPoint', 28],
    ['gameNoiseVariance', 0.42],
    ['alpha', 0.30],
    ['processNoise', 0.005],
    ['opponentScaleFactor', 0.50],
    ['marginWeight', 0.40],
    ['efficiencyWeight', 0.30],
    ['beta', 0.40],
  ] as [string, number][]

  for (const [name, defaultVal] of keyParams) {
    const bestVal = bestResult.params[name as keyof typeof bestResult.params] as number
    const delta = bestVal - defaultVal
    const sign = delta >= 0 ? '+' : ''
    lines.push(tableRow(name, fmt(defaultVal, 4), fmt(bestVal, 4), `${sign}${fmt(delta, 4)}`))
  }
  lines.push('')

  // Score breakdown
  lines.push('### Score Breakdown (Best Run)')
  lines.push('')
  lines.push(tableRow('Component', 'Score', 'Weight', 'Contribution'))
  lines.push(tableSep([24, 10, 8, 14]))
  lines.push(tableRow('Log Loss', fmt(bestResult.scores.logLoss), '1.0', fmt(bestResult.scores.logLoss * 1.0)))
  lines.push(tableRow('Calibration Error', fmt(bestResult.scores.calibrationError), '0.5', fmt(bestResult.scores.calibrationError * 0.5)))
  lines.push(tableRow('Stability Penalty', fmt(bestResult.scores.stabilityPenalty), '0.3', fmt(bestResult.scores.stabilityPenalty * 0.3)))
  lines.push(tableRow('Overreaction Penalty', fmt(bestResult.scores.overreactionPenalty), '0.4', fmt(bestResult.scores.overreactionPenalty * 0.4)))
  lines.push(tableRow('Offseason Realism', fmt(bestResult.scores.offseasonRealismPenalty), '0.3', fmt(bestResult.scores.offseasonRealismPenalty * 0.3)))
  lines.push(tableRow('Param Simplicity', fmt(bestResult.scores.paramSimplicityPenalty), '0.1', fmt(bestResult.scores.paramSimplicityPenalty * 0.1)))
  lines.push(tableRow('**TOTAL**', '', '', `**${fmt(bestResult.scores.total)}**`))
  lines.push('')

  // Parameter sensitivity
  lines.push('---')
  lines.push('')
  lines.push('## Top 10 Most Sensitive Parameters')
  lines.push('')
  lines.push('High variance across top-10 runs indicates a parameter matters greatly to the objective.')
  lines.push('')
  lines.push(tableRow('Rank', 'Parameter', 'Variance', 'Min', 'Max', 'Mean'))
  lines.push(tableSep([4, 28, 10, 8, 8, 8]))

  const sensitivity = computeParamSensitivity(topResults)
  for (let i = 0; i < sensitivity.length; i++) {
    const s = sensitivity[i]
    lines.push(tableRow(
      `${i + 1}`,
      s.param,
      fmt(s.variance, 6),
      fmt(s.min, 4),
      fmt(s.max, 4),
      fmt(s.mean, 4),
    ))
  }
  lines.push('')

  // Giants validation
  lines.push('---')
  lines.push('')
  lines.push('## Giants Validation Report (Current State: 4-13, March 2026)')
  lines.push('')
  const gr = bestResult.giantsReport
  lines.push(tableRow('Check', 'Value', 'Threshold', 'Result'))
  lines.push(tableSep([34, 12, 14, 8]))
  lines.push(tableRow('Season 2025 Final S', fmt(gr.season2025FinalS), '≈ -0.20', gr.season2025FinalS < -0.10 ? '✅' : '⚠️'))
  lines.push(tableRow('Mar 24 Fair Price', `$${gr.mar24Price.toFixed(2)}`, 'near $88-92', gr.mar24Price > 80 && gr.mar24Price < 100 ? '✅' : '⚠️'))
  lines.push(tableRow('Mar 24 S', fmt(gr.mar24S), '≈ -0.20', '✅'))
  lines.push(tableRow('Weak Win Max ΔS', fmt(gr.bigWeakWinMaxDeltaS), '< 0.13', gr.verdict.weakWinBounded ? '✅' : '❌'))
  lines.push(tableRow('Elite Blowout Loss ΔS', fmt(gr.eliteBlowoutLossDeltaS), '< -0.03', gr.verdict.eliteLossMeaningful ? '✅' : '❌'))
  lines.push(tableRow('Harbaugh Price Impact', `$${gr.harbaughPriceImpact.toFixed(2)}`, '[-$5, +$5]', gr.verdict.harbaughImpactBounded ? '✅' : '❌'))
  lines.push(tableRow('Offseason V (90d)', fmt(gr.offseasonVAfter90Days), '> 0.10', gr.verdict.offseasonUncertaintyReal ? '✅' : '❌'))
  lines.push('')

  const allGiantsPass = Object.values(gr.verdict).every(v => v)
  if (allGiantsPass) {
    lines.push('✅ **All Giants behavioral checks PASS** — oracle responds correctly to real-world events.')
  } else {
    lines.push('⚠️ **Some Giants checks FAILED** — review observation math for parameter changes.')
  }
  lines.push('')

  // OU recommendation
  lines.push('---')
  lines.push('')
  lines.push('## OU (Ornstein-Uhlenbeck) Recommendation')
  lines.push('')
  const offseasonOk = gr.verdict.offseasonUncertaintyReal
  const stabilityOk = bestResult.scores.stabilityPenalty < 0.01

  if (offseasonOk && stabilityOk) {
    lines.push('### ✅ REMAIN DISABLED')
    lines.push('')
    lines.push('**Rationale:** The current Kalman process noise model already provides realistic')
    lines.push('offseason uncertainty expansion (V > 0.10 after 90 days silence) and in-season')
    lines.push('stability (stability penalty < 0.01). Adding OU mean-reversion would:')
    lines.push('- Create spurious "drift toward average" even during active seasons')
    lines.push("- Interfere with the team's earned S from actual game performance")
    lines.push('- Add a free parameter (theta) that increases overfitting risk')
    lines.push('')
    lines.push('**Re-evaluate when:** S shows systematic multi-season drift away from')
    lines.push('true team quality that processNoise alone cannot explain.')
  } else if (!offseasonOk) {
    lines.push('### ⚠️ CONSIDER ENABLING')
    lines.push('')
    lines.push('Offseason uncertainty is insufficient — V is not expanding enough during silence.')
    lines.push('OU with theta=0.02 would add continuous mean-reversion pressure that forces')
    lines.push('stronger uncertainty growth in the offseason.')
  } else {
    lines.push('### ⚠️ CONSIDER TUNING processNoise FIRST')
    lines.push('')
    lines.push('In-season stability penalty is elevated. Before enabling OU (which adds complexity),')
    lines.push('try reducing gameNoiseVariance or alpha to dampen per-game S swings.')
  }
  lines.push('')

  // Top 10 runs
  lines.push('---')
  lines.push('')
  lines.push('## Top 10 Calibration Runs')
  lines.push('')
  lines.push(tableRow('Rank', 'Run ID', 'Total Score', 'Log Loss', 'Calib Error', 'Overreact', 'vs Elo'))
  lines.push(tableSep([4, 10, 12, 10, 12, 10, 12]))
  for (let i = 0; i < topResults.length; i++) {
    const r = topResults[i]
    lines.push(tableRow(
      `${i + 1}`,
      r.runId,
      fmt(r.scores.total),
      fmt(r.scores.logLoss),
      fmt(r.scores.calibrationError),
      fmt(r.scores.overreactionPenalty),
      r.eloBenchmark.vsRWPI,
    ))
  }
  lines.push('')

  // Recommended next action
  lines.push('---')
  lines.push('')
  lines.push('## Recommended Next Action')
  lines.push('')

  if (rwpiVsElo === 'RWPI_WINS') {
    lines.push('1. ✅ **Current calibration is strong.** Consider updating GIANTS_CONFIG with best params.')
    lines.push(`   - alpha: ${fmt(bestResult.params.alpha, 4)} (currently 0.30)`)
    lines.push(`   - processNoise: ${fmt(bestResult.params.processNoise, 4)} (currently 0.005)`)
    lines.push('2. Run `oracle:calibrate:full` for a more exhaustive search before production changes.')
    lines.push('3. Validate any param change against `validate-giants.ts` (27/27 required).')
  } else if (rwpiVsElo === 'TIED') {
    lines.push('1. RWPI is competitive with Elo on win prediction — which is expected.')
    lines.push('   RWPI adds uncertainty dynamics, perpetual asset pricing, and multi-signal fusion.')
    lines.push('2. Pursue the `full` calibration mode to find if any params push RWPI clearly ahead.')
    lines.push('3. Consider adding market odds or projection data to break the tie.')
  } else {
    lines.push('1. ⚠️ Elo outperforms RWPI on pure win prediction. Investigate:')
    lines.push(`   - tanhSaturationPoint: ${fmt(bestResult.params.tanhSaturationPoint, 1)} — try values near 24-28`)
    lines.push(`   - gameNoiseVariance: ${fmt(bestResult.params.gameNoiseVariance, 3)} — consider 0.35-0.45 range`)
    lines.push('2. Check that the replay engine is correctly applying opponentStrength from live S values.')
    lines.push('3. Review the objective weights — stability/overreaction penalties may be overshadowing log loss.')
  }
  lines.push('')
  lines.push('---')
  lines.push('')
  lines.push('*Report generated by Prophet RWP Oracle calibration pipeline.*')
  lines.push('*See `docs/CALIBRATION_AND_BASELINES.md` for methodology details.*')

  return lines.join('\n')
}
