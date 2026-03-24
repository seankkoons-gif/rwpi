/**
 * objective.ts — Calibration objective function for Prophet RWP Oracle
 *
 * Computes a composite score (lower = better) from replay results.
 * Combines predictive accuracy (log loss, Brier, calibration), stability,
 * and domain-specific checks (offseason realism, overreaction penalties).
 *
 * Design: RWPI is not a betting tool. We optimize for:
 *   1. Reasonable win probability predictions (log loss, calibration)
 *   2. Stability — S shouldn't whipsaw game-to-game
 *   3. Realism — bad teams stay bad; good teams stay good through an offseason
 *   4. Non-overreaction — no single game should catastrophically move S
 */

import type { ReplayResult } from './types.ts'
import type { CalibrationParams, CalibrationObjective } from './types.ts'
import { DEFAULT_OBJECTIVE } from './types.ts'
import { replayWithParams, projectOffseasonSilence, winProbFromS } from './replay.ts'
import type { HistoricalGame } from './types.ts'

// ─── Core metrics ─────────────────────────────────────────────────────────────

/**
 * Log loss: -mean(y*log(p) + (1-y)*log(1-p))
 * p clamped to [0.01, 0.99] to avoid log(0).
 */
export function computeLogLoss(results: ReplayResult[]): number {
  if (results.length === 0) return 0
  let sum = 0
  for (const r of results) {
    const p = Math.max(0.01, Math.min(0.99, r.predictedHomeWinProb))
    const y = r.homeWon ? 1 : 0
    sum += -(y * Math.log(p) + (1 - y) * Math.log(1 - p))
  }
  return sum / results.length
}

/**
 * Brier score: mean((p - y)^2)
 */
export function computeBrierScore(results: ReplayResult[]): number {
  if (results.length === 0) return 0
  let sum = 0
  for (const r of results) {
    const p = Math.max(0.01, Math.min(0.99, r.predictedHomeWinProb))
    const y = r.homeWon ? 1 : 0
    sum += Math.pow(p - y, 2)
  }
  return sum / results.length
}

/**
 * Calibration error: bucket predictions into 10 deciles,
 * compute mean absolute error between predicted and actual win rates.
 * Lower = better calibrated.
 */
export function computeCalibrationError(results: ReplayResult[]): number {
  if (results.length === 0) return 0

  const buckets: { sumPred: number; sumActual: number; count: number }[] = Array.from(
    { length: 10 },
    () => ({ sumPred: 0, sumActual: 0, count: 0 })
  )

  for (const r of results) {
    const p = Math.max(0.01, Math.min(0.99, r.predictedHomeWinProb))
    const bucketIdx = Math.min(9, Math.floor(p * 10))
    buckets[bucketIdx].sumPred += p
    buckets[bucketIdx].sumActual += r.homeWon ? 1 : 0
    buckets[bucketIdx].count++
  }

  let totalError = 0
  let activeBuckets = 0
  for (const b of buckets) {
    if (b.count > 0) {
      const avgPred = b.sumPred / b.count
      const avgActual = b.sumActual / b.count
      totalError += Math.abs(avgPred - avgActual)
      activeBuckets++
    }
  }

  return activeBuckets > 0 ? totalError / activeBuckets : 0
}

// ─── Stability penalties ──────────────────────────────────────────────────────

/**
 * Stability penalty: mean(|ΔS|^2) normalized across all games.
 * Penalizes wild S swings within a single week.
 */
export function computeStabilityPenalty(results: ReplayResult[]): number {
  if (results.length === 0) return 0
  let sum = 0
  let count = 0
  for (const r of results) {
    sum += Math.pow(Math.abs(r.homeDeltaS), 2)
    sum += Math.pow(Math.abs(r.awayDeltaS), 2)
    count += 2
  }
  return count > 0 ? sum / count : 0
}

/**
 * Overreaction penalty: fraction of games where |ΔS| > threshold.
 * A high fraction means the model is too sensitive to individual games.
 */
export function computeOverreactionPenalty(
  results: ReplayResult[],
  threshold: number,
): number {
  if (results.length === 0) return 0
  let overCount = 0
  let total = 0
  for (const r of results) {
    if (Math.abs(r.homeDeltaS) > threshold) overCount++
    if (Math.abs(r.awayDeltaS) > threshold) overCount++
    total += 2
  }
  return total > 0 ? overCount / total : 0
}

// ─── Offseason realism ────────────────────────────────────────────────────────

/**
 * Offseason realism penalty.
 * For teams ending any season with S < -0.20, project forward 90 days of silence.
 * If any such team has S > badTeamRecoveryMaxS after 90 days, add a penalty.
 * This catches params that make bad teams falsely recover just from time passing.
 */
export function computeOffseasonRealismPenalty(
  games: HistoricalGame[],
  params: CalibrationParams,
  objective: CalibrationObjective,
): number {
  // Find end-of-season S values by replaying and taking the last game of each season per team
  const replayResults = replayWithParams(games, params)

  // Map: teamId + season → last known S
  const seasonEndS = new Map<string, number>()
  for (const r of replayResults) {
    const key = `${r.homeTeamId}:${r.season}`
    const keyAway = `${r.awayTeamId}:${r.season}`
    // Update running end-of-season S (last game in season is the final value)
    seasonEndS.set(key, r.homeS_after)
    seasonEndS.set(keyAway, r.awayS_after)
  }

  const BAD_TEAM_THRESHOLD = -0.20
  const SILENCE_DAYS = 90
  let violations = 0
  let checks = 0

  for (const [, endS] of seasonEndS) {
    if (endS < BAD_TEAM_THRESHOLD) {
      const { S: projectedS } = projectOffseasonSilence(endS, 0.08, SILENCE_DAYS, params)
      if (projectedS > objective.badTeamRecoveryMaxS) {
        violations++
      }
      checks++
    }
  }

  return checks > 0 ? violations / checks : 0
}

// ─── Parameter simplicity penalty ────────────────────────────────────────────

/**
 * Penalize extreme parameter values (L2 regularization from defaults).
 * Prevents overfitting to the synthetic dataset by discouraging
 * very different params from the hand-tuned defaults.
 */
export function computeParamSimplicityPenalty(
  params: CalibrationParams,
): number {
  // Only apply to the 5 key search params
  const defaults = {
    tanhSaturationPoint: 28,
    gameNoiseVariance: 0.42,
    alpha: 0.30,
    processNoise: 0.005,
    opponentScaleFactor: 0.50,
  }
  const ranges = {
    tanhSaturationPoint: 20,     // normalize by expected range
    gameNoiseVariance: 0.60,
    alpha: 0.35,
    processNoise: 0.014,
    opponentScaleFactor: 0.60,
  }
  let penalty = 0
  for (const [key, defaultVal] of Object.entries(defaults)) {
    const k = key as keyof typeof defaults
    const diff = (params[k] as number - defaultVal) / ranges[k]
    penalty += diff * diff
  }
  return penalty / 5  // normalize to ~[0, 1]
}

// ─── Composite objective ──────────────────────────────────────────────────────

export interface ObjectiveScores {
  total: number
  logLoss: number
  calibrationError: number
  stabilityPenalty: number
  overreactionPenalty: number
  offseasonRealismPenalty: number
  paramSimplicityPenalty: number
  brierScore: number
}

/**
 * Compute the full objective score for a set of params on the given dataset.
 * Lower total = better.
 */
export function computeObjective(
  games: HistoricalGame[],
  params: CalibrationParams,
  objective: CalibrationObjective = DEFAULT_OBJECTIVE,
): ObjectiveScores {
  const results = replayWithParams(games, params)

  const logLoss = computeLogLoss(results)
  const brierScore = computeBrierScore(results)
  const calibrationError = computeCalibrationError(results)
  const stabilityPenalty = computeStabilityPenalty(results)
  const overreactionPenalty = computeOverreactionPenalty(results, objective.overreactionThreshold)
  const offseasonRealismPenalty = computeOffseasonRealismPenalty(games, params, objective)
  const paramSimplicityPenalty = computeParamSimplicityPenalty(params)

  const w = objective.weights
  const total =
    w.logLoss * logLoss +
    w.calibrationError * calibrationError +
    w.stabilityPenalty * stabilityPenalty +
    w.overreactionPenalty * overreactionPenalty +
    w.offseasonRealismPenalty * offseasonRealismPenalty +
    w.paramSimplicityPenalty * paramSimplicityPenalty

  return {
    total,
    logLoss,
    calibrationError,
    stabilityPenalty,
    overreactionPenalty,
    offseasonRealismPenalty,
    paramSimplicityPenalty,
    brierScore,
  }
}

// ─── Giants-specific calibration report ──────────────────────────────────────

import { GIANTS_CONFIG, applyObservations, calcFairPrice, applyOffseasonTransition } from '../oracle.ts'
import { gameResultObservation } from '../observations.ts'
import type { GameResult } from '../../../shared/src/types.ts'
import { GIANTS_2025_GAMES } from '../seed-giants.ts'

/**
 * Generate Giants-specific calibration report using live oracle (GIANTS_CONFIG).
 * Tests the 4 key behavioral properties that define correct model behavior.
 */
export function computeGiantsCalibrationReport(params: CalibrationParams) {
  const NOW = Date.now()

  // 1. Season 2025 final S
  let S = GIANTS_CONFIG.launchS
  let V = GIANTS_CONFIG.launchV
  for (const game of GIANTS_2025_GAMES) {
    const obs = gameResultObservation(game as GameResult, NOW)
    const { S: S_new, V: V_new } = applyObservations(S, V, [obs], GIANTS_CONFIG, 7)
    S = S_new
    V = V_new
  }
  const season2025FinalS = S

  // 2. Big weak win max ΔS (Panthers-style blowout win)
  const weakWinResult: GameResult = {
    week: 5, season: 2025, opponent: 'Carolina Panthers',
    home: true, pointsScored: 38, pointsAllowed: 14, win: true, margin: 24,
    offensiveYards: 425, defensiveYards: 195, turnovers: -2, sacks: 5,
    thirdDownPct: 0.62, redZonePct: 1.00, timeOfPossession: 36.8,
    penaltyYards: 25, specialTeamsScore: 4,
    kickingFGPct: 1.00, returnYards: 148, explosivePlays: 8,
    opponentStrength: -0.40, restDays: 7, primetime: false,
  }
  const weakWinObs = gameResultObservation(weakWinResult, NOW)
  const { S: S_weakWin } = applyObservations(-0.21, 0.12, [weakWinObs], GIANTS_CONFIG, 7)
  const bigWeakWinMaxDeltaS = S_weakWin - (-0.21)

  // 3. Elite blowout loss ΔS (Eagles W12 style)
  const eliteLossResult: GameResult = {
    week: 12, season: 2025, opponent: 'Philadelphia Eagles',
    home: false, pointsScored: 7, pointsAllowed: 34, win: false, margin: -27,
    offensiveYards: 195, defensiveYards: 415, turnovers: 3, sacks: 1,
    thirdDownPct: 0.18, redZonePct: 0.20, timeOfPossession: 21.0,
    penaltyYards: 75, specialTeamsScore: -3,
    kickingFGPct: 0.00, returnYards: 52, explosivePlays: 1,
    opponentStrength: 0.50, restDays: 7, primetime: true,
  }
  const eliteLossObs = gameResultObservation(eliteLossResult, NOW)
  const { S: S_eliteLoss } = applyObservations(-0.21, 0.12, [eliteLossObs], GIANTS_CONFIG, 7)
  const eliteBlowoutLossDeltaS = S_eliteLoss - (-0.21)

  // 4. Harbaugh coaching hire price impact
  const harbaughTransition = {
    daysFromSeasonEndToNow: 81,
    coachingChange: {
      fromCoach: 'Brian Daboll',
      toCoach: 'John Harbaugh',
      qualitySignal: 0.18,
      confidence: 0.68,
      varianceAddition: 0.16,
    },
    rosterMoves: [{ player: 'Jason Sanders', role: 'K', impact: 0.10, confidence: 0.82 }],
    sentimentPost: {
      overall: 0.15, beatReporter: 0.25, nationalMedia: 0.08,
      fanSentiment: 0.20, headlineShock: true, dispersion: 0.52,
    },
  }
  const noHarbaughTransition = {
    daysFromSeasonEndToNow: 81,
    rosterMoves: [{ player: 'Jason Sanders', role: 'K', impact: 0.10, confidence: 0.82 }],
    sentimentPost: {
      overall: -0.10, beatReporter: -0.12, nationalMedia: -0.08,
      fanSentiment: -0.10, headlineShock: false, dispersion: 0.35,
    },
  }
  const { S: S_withHC, V: V_withHC } = applyOffseasonTransition(
    season2025FinalS, V, harbaughTransition, GIANTS_CONFIG
  )
  const { S: S_withoutHC, V: V_withoutHC } = applyOffseasonTransition(
    season2025FinalS, V, noHarbaughTransition, GIANTS_CONFIG
  )
  const mar24Price = calcFairPrice(S_withHC, V_withHC, GIANTS_CONFIG)
  const mar24S = S_withHC
  const harbaughPriceImpact = calcFairPrice(S_withHC, V_withHC, GIANTS_CONFIG) -
    calcFairPrice(S_withoutHC, V_withoutHC, GIANTS_CONFIG)

  // 5. Offseason V after 90 days of silence
  const S0_for90d = -0.26
  const V0_for90d = 0.08
  const { V: V_after90d } = applyOffseasonTransition(
    S0_for90d, V0_for90d,
    { daysFromSeasonEndToNow: 90, rosterMoves: [] },
    GIANTS_CONFIG
  )

  return {
    season2025FinalS,
    mar24Price,
    mar24S,
    bigWeakWinMaxDeltaS,
    eliteBlowoutLossDeltaS,
    harbaughPriceImpact,
    offseasonVAfter90Days: V_after90d,
    verdict: {
      weakWinBounded: bigWeakWinMaxDeltaS >= 0.001 && bigWeakWinMaxDeltaS <= 0.13,
      eliteLossMeaningful: eliteBlowoutLossDeltaS <= -0.03,
      harbaughImpactBounded: harbaughPriceImpact >= -5.0 && harbaughPriceImpact <= 5.0,
      offseasonUncertaintyReal: V_after90d > 0.10,
    },
  }
}
