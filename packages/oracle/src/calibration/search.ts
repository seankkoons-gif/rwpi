/**
 * search.ts — Calibration parameter search for Prophet RWP Oracle
 *
 * Two search modes:
 *   Quick mode: 5-parameter grid (2,500 combinations), <30 seconds
 *   Full mode: 8-parameter random search (500 iterations), <5 minutes
 *
 * Deterministic: seeded PRNG (seed=42) for reproducibility.
 * No external dependencies.
 */

import type { CalibrationParams, CalibrationRunResult, HistoricalGame } from './types.ts'
import { DEFAULT_CALIBRATION_PARAMS } from './types.ts'
import type { CalibrationObjective } from './types.ts'
import { DEFAULT_OBJECTIVE } from './types.ts'
import { computeObjective, computeGiantsCalibrationReport } from './objective.ts'
import { replayWithParams } from './replay.ts'
import { computeLogLoss, computeBrierScore } from './objective.ts'
import { replaySeasons } from '../baselines/elo.ts'
import type { EloGameInput } from '../baselines/elo.ts'
import { DEFAULT_ELO_CONFIG, computeEloMetrics } from '../baselines/elo.ts'
import { SeededRng } from './dataset.ts'

// ─── Run ID hash ──────────────────────────────────────────────────────────────

/**
 * Simple deterministic hash of params for run identification.
 * FNV-1a inspired.
 */
export function hashParams(params: CalibrationParams): string {
  const vals = [
    params.tanhSaturationPoint,
    params.gameNoiseVariance,
    params.alpha,
    params.processNoise,
    params.opponentScaleFactor,
    params.marginWeight,
    params.efficiencyWeight,
    params.beta,
  ]
  let h = 2166136261
  for (const v of vals) {
    const bits = Math.round(v * 10000)
    h = ((h ^ bits) * 16777619) >>> 0
  }
  return h.toString(16).padStart(8, '0')
}

// ─── Elo benchmark helper ─────────────────────────────────────────────────────

function runEloBenchmark(eloInputs: EloGameInput[], rwpiLogLoss: number): CalibrationRunResult['eloBenchmark'] {
  const updates = replaySeasons(eloInputs, DEFAULT_ELO_CONFIG)
  const eloMetrics = computeEloMetrics(updates)

  let vsRWPI: 'RWPI_WINS' | 'ELO_WINS' | 'TIED'
  const diff = rwpiLogLoss - eloMetrics.logLoss
  if (diff < -0.01) vsRWPI = 'RWPI_WINS'
  else if (diff > 0.01) vsRWPI = 'ELO_WINS'
  else vsRWPI = 'TIED'

  return {
    logLoss: eloMetrics.logLoss,
    brierScore: eloMetrics.brierScore,
    vsRWPI,
  }
}

// ─── Single run evaluator ─────────────────────────────────────────────────────

function evaluateParams(
  params: CalibrationParams,
  games: HistoricalGame[],
  eloInputs: EloGameInput[],
  objective: CalibrationObjective,
  includeGiantsReport: boolean,
): CalibrationRunResult {
  const scores = computeObjective(games, params, objective)
  const eloResults = replayWithParams(games, params)
  const rwpiLogLoss = computeLogLoss(eloResults)
  const eloBenchmark = runEloBenchmark(eloInputs, rwpiLogLoss)
  const giantsReport = includeGiantsReport
    ? computeGiantsCalibrationReport(params)
    : {
        season2025FinalS: 0, mar24Price: 0, mar24S: 0,
        bigWeakWinMaxDeltaS: 0, eliteBlowoutLossDeltaS: 0,
        harbaughPriceImpact: 0, offseasonVAfter90Days: 0,
        verdict: {
          weakWinBounded: true, eliteLossMeaningful: true,
          harbaughImpactBounded: true, offseasonUncertaintyReal: true,
        },
      }

  return {
    runId: hashParams(params),
    params,
    scores: {
      total: scores.total,
      logLoss: scores.logLoss,
      calibrationError: scores.calibrationError,
      stabilityPenalty: scores.stabilityPenalty,
      overreactionPenalty: scores.overreactionPenalty,
      offseasonRealismPenalty: scores.offseasonRealismPenalty,
      paramSimplicityPenalty: scores.paramSimplicityPenalty,
    },
    eloBenchmark,
    giantsReport,
    timestamp: Date.now(),
  }
}

// ─── Quick mode grid search ───────────────────────────────────────────────────

const QUICK_GRID = {
  tanhSaturationPoint: [20, 24, 28, 32, 36],
  gameNoiseVariance: [0.28, 0.35, 0.42, 0.52, 0.65],
  alpha: [0.20, 0.25, 0.30, 0.35, 0.40],
  processNoise: [0.002, 0.005, 0.008, 0.012],
  opponentScaleFactor: [0.30, 0.40, 0.50, 0.60, 0.70],
}
// Total: 5 * 5 * 5 * 4 * 5 = 2,500 combinations

export interface SearchOptions {
  onProgress?: (completed: number, total: number, bestScore: number) => void
  maxResults?: number     // default 10
  verbose?: boolean
}

/**
 * Quick mode: grid search over 5 key parameters.
 * Expected runtime: <30 seconds for 2,500 combinations.
 */
export function runQuickSearch(
  games: HistoricalGame[],
  eloInputs: EloGameInput[],
  objective: CalibrationObjective = DEFAULT_OBJECTIVE,
  options: SearchOptions = {},
): CalibrationRunResult[] {
  const { onProgress, maxResults = 10 } = options
  const topN: CalibrationRunResult[] = []

  const { tanhSaturationPoint, gameNoiseVariance, alpha, processNoise, opponentScaleFactor } = QUICK_GRID
  const total = tanhSaturationPoint.length * gameNoiseVariance.length * alpha.length *
    processNoise.length * opponentScaleFactor.length

  let completed = 0
  let bestScore = Infinity

  for (const tanh of tanhSaturationPoint) {
    for (const gnv of gameNoiseVariance) {
      for (const a of alpha) {
        for (const pn of processNoise) {
          for (const osf of opponentScaleFactor) {
            const params: CalibrationParams = {
              ...DEFAULT_CALIBRATION_PARAMS,
              tanhSaturationPoint: tanh,
              gameNoiseVariance: gnv,
              alpha: a,
              processNoise: pn,
              opponentScaleFactor: osf,
            }

            // Only include Giants report for the best candidates (expensive)
            const result = evaluateParams(params, games, eloInputs, objective, false)
            completed++

            if (result.scores.total < bestScore) {
              bestScore = result.scores.total
            }

            // Maintain sorted top-N
            if (topN.length < maxResults || result.scores.total < topN[topN.length - 1].scores.total) {
              topN.push(result)
              topN.sort((a, b) => a.scores.total - b.scores.total)
              if (topN.length > maxResults) topN.pop()
            }

            if (onProgress && completed % 100 === 0) {
              onProgress(completed, total, bestScore)
            }
          }
        }
      }
    }
  }

  if (onProgress) onProgress(completed, total, bestScore)

  // Enrich top results with Giants report
  for (const result of topN) {
    result.giantsReport = computeGiantsCalibrationReport(result.params)
  }

  return topN
}

// ─── Full mode random search ──────────────────────────────────────────────────

const FULL_SEARCH_SEED = 42
const FULL_SEARCH_ITERATIONS = 500

const FULL_RANGES = {
  tanhSaturationPoint: [18, 40] as [number, number],
  gameNoiseVariance: [0.20, 0.80] as [number, number],
  alpha: [0.15, 0.50] as [number, number],
  beta: [0.25, 0.60] as [number, number],
  processNoise: [0.001, 0.015] as [number, number],
  opponentScaleFactor: [0.20, 0.80] as [number, number],
  marginWeight: [0.25, 0.60] as [number, number],
  efficiencyWeight: [0.10, 0.45] as [number, number],
}

/**
 * Full mode: random search over 8 parameters, 500 iterations, seed=42.
 * Expected runtime: <5 minutes.
 */
export function runFullSearch(
  games: HistoricalGame[],
  eloInputs: EloGameInput[],
  objective: CalibrationObjective = DEFAULT_OBJECTIVE,
  options: SearchOptions = {},
): CalibrationRunResult[] {
  const { onProgress, maxResults = 10 } = options
  const rng = new SeededRng(FULL_SEARCH_SEED)
  const topN: CalibrationRunResult[] = []
  const total = FULL_SEARCH_ITERATIONS
  let bestScore = Infinity

  for (let i = 0; i < FULL_SEARCH_ITERATIONS; i++) {
    const params: CalibrationParams = {
      ...DEFAULT_CALIBRATION_PARAMS,
      tanhSaturationPoint: rng.nextUniform(...FULL_RANGES.tanhSaturationPoint),
      gameNoiseVariance: rng.nextUniform(...FULL_RANGES.gameNoiseVariance),
      alpha: rng.nextUniform(...FULL_RANGES.alpha),
      beta: rng.nextUniform(...FULL_RANGES.beta),
      processNoise: rng.nextUniform(...FULL_RANGES.processNoise),
      opponentScaleFactor: rng.nextUniform(...FULL_RANGES.opponentScaleFactor),
      marginWeight: rng.nextUniform(...FULL_RANGES.marginWeight),
      efficiencyWeight: rng.nextUniform(...FULL_RANGES.efficiencyWeight),
    }

    const result = evaluateParams(params, games, eloInputs, objective, false)

    if (result.scores.total < bestScore) {
      bestScore = result.scores.total
    }

    if (topN.length < maxResults || result.scores.total < topN[topN.length - 1].scores.total) {
      topN.push(result)
      topN.sort((a, b) => a.scores.total - b.scores.total)
      if (topN.length > maxResults) topN.pop()
    }

    if (onProgress && (i + 1) % 50 === 0) {
      onProgress(i + 1, total, bestScore)
    }
  }

  if (onProgress) onProgress(FULL_SEARCH_ITERATIONS, total, bestScore)

  // Enrich top results with Giants report
  for (const result of topN) {
    result.giantsReport = computeGiantsCalibrationReport(result.params)
  }

  return topN
}

// ─── Parameter sensitivity analysis ──────────────────────────────────────────

/**
 * Compute variance of each parameter across the top-N results.
 * High variance = the parameter matters a lot (sensitive).
 * Returns top-10 most sensitive params sorted by variance.
 */
export function computeParamSensitivity(
  topResults: CalibrationRunResult[],
): Array<{ param: string; variance: number; min: number; max: number; mean: number }> {
  if (topResults.length < 2) return []

  const numericKeys = [
    'tanhSaturationPoint', 'gameNoiseVariance', 'alpha', 'processNoise',
    'opponentScaleFactor', 'marginWeight', 'efficiencyWeight', 'beta',
    'processNoise', 'offseasonMeanReversion',
  ] as const

  type NumericKey = keyof CalibrationParams

  const variances: Array<{ param: string; variance: number; min: number; max: number; mean: number }> = []

  for (const key of numericKeys) {
    const values = topResults.map(r => r.params[key as NumericKey] as number)
    const mean = values.reduce((a, b) => a + b, 0) / values.length
    const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length
    const min = Math.min(...values)
    const max = Math.max(...values)
    variances.push({ param: key, variance, min, max, mean })
  }

  return variances.sort((a, b) => b.variance - a.variance).slice(0, 10)
}
