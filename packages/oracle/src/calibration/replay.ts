/**
 * replay.ts — Replay engine for calibration
 *
 * Wraps the Kalman filter logic with overridable CalibrationParams.
 * IMPORTANT: Does NOT modify oracle.ts. Replicates the observation math
 * from observations.ts with params substituted, then uses the core
 * kalmanUpdate function from oracle.ts.
 *
 * Also implements:
 * - Covariance smoothing experiment (covSmoothingEnabled)
 * - fundingAsymmetricLongPenalty wrapper (without touching market-engine.ts)
 */

import { kalmanUpdate } from '../oracle.ts'
import type { CalibrationParams } from './types.ts'
import type { ReplayResult, HistoricalGame } from './types.ts'
import { DEFAULT_CALIBRATION_PARAMS } from './types.ts'

// ─── Observation math (replicated from observations.ts with param overrides) ──

interface GameObservation {
  observedStrength: number
  confidence: number
  noiseVariance: number
  recencyWeight: number
}

/**
 * Compute game result observation with overridable params.
 * Replicates the math from observations.ts::gameResultObservation but
 * accepts CalibrationParams instead of hardcoded constants.
 */
function computeGameObservation(
  homeWon: boolean,
  margin: number,              // signed: homeScore - awayScore
  thirdDownPct: number,
  redZonePct: number,
  specialTeamsScore: number,
  turnovers: number,           // net: negative = bad for this team
  sacks: number,               // sacks inflicted by this team
  opponentStrength: number,    // S of opponent team
  isPrimetime: boolean,
  params: CalibrationParams,
): GameObservation {
  const { tanhSaturationPoint, marginWeight, efficiencyWeight,
          opponentScaleBase, opponentScaleFactor, garbageDampenThreshold,
          garbageDampenFactor, eliteLossMultiplierFactor,
          winCeilingBase, winCeilingFactor, gameNoiseVariance } = params

  const base = homeWon ? 0.30 : -0.30
  const marginFactor = Math.tanh(margin / tanhSaturationPoint)
  const efficiencyFactor =
    (thirdDownPct - 0.38) * 0.5 + (redZonePct - 0.55) * 0.3
  const stsBonus = specialTeamsScore * 0.01
  const turnoverPenalty = turnovers * -0.025
  const sackBonus = sacks * 0.015

  const opponentScale = Math.max(0.25, opponentScaleBase + opponentScaleFactor * opponentStrength)
  const garbageDampen = (Math.abs(margin) > garbageDampenThreshold && opponentStrength < -0.10)
    ? garbageDampenFactor
    : 1.0

  const coreSignal = base + marginWeight * marginFactor + efficiencyWeight * efficiencyFactor
    + stsBonus + turnoverPenalty + sackBonus

  const eliteLossPenalty = (!homeWon && opponentStrength > 0)
    ? 1.0 + opponentStrength * eliteLossMultiplierFactor
    : 1.0

  const scaledCore = coreSignal * opponentScale * garbageDampen * eliteLossPenalty

  const oppAdjustedCap = homeWon
    ? Math.max(0.18, winCeilingBase + winCeilingFactor * opponentStrength)
    : 0.80

  const observedStrength = Math.max(-0.80, Math.min(oppAdjustedCap, scaledCore))
  const confidence = Math.min(0.80, 0.58 + Math.abs(marginFactor) * 0.10 + Math.abs(opponentStrength) * 0.05)
  const noiseVariance = isPrimetime ? 0.30 : gameNoiseVariance

  return { observedStrength, confidence, noiseVariance, recencyWeight: 1.0 }
}

// ─── Per-team Kalman state ────────────────────────────────────────────────────

interface TeamKalmanState {
  S: number
  V: number
  lastGameWeek: number
  lastGameSeason: number
}

function makeInitialTeamState(): TeamKalmanState {
  return { S: 0.0, V: 0.60, lastGameWeek: 0, lastGameSeason: 0 }
}

/**
 * Apply a single Kalman update with a game observation and process noise.
 * Optionally apply covariance smoothing if enabled.
 */
function applyGameUpdate(
  state: TeamKalmanState,
  obs: GameObservation,
  params: CalibrationParams,
  daysSinceLastGame: number,
): TeamKalmanState {
  const V_prior = state.V + params.processNoise * daysSinceLastGame
  const weight = obs.confidence * obs.recencyWeight
  if (weight < 0.01) return { ...state, V: Math.max(0.001, V_prior) }

  const R = obs.noiseVariance / weight
  const { S: S_new, V: V_new } = kalmanUpdate(state.S, V_prior, obs.observedStrength, R)

  let V_final = Math.max(0.001, V_new)

  // Covariance smoothing experiment: exponential decay after update
  if (params.covSmoothingEnabled && params.covSmoothingHalfLifeHours > 0) {
    const lambda = Math.LN2 / params.covSmoothingHalfLifeHours
    const decayFactor = Math.exp(-lambda)  // applied once per game
    V_final = Math.max(0.001, V_final * decayFactor)
  }

  return { ...state, S: S_new, V: V_final }
}

// ─── Sigmoid win probability ──────────────────────────────────────────────────

/**
 * Win probability for home team from S states.
 * sigmoid(alpha * (S_home - S_away) + homeAdv)
 * homeAdv ≈ 0.15 in S units (corresponds to ~65 Elo points)
 */
export function winProbFromS(homeS: number, awayS: number, params: CalibrationParams): number {
  const HOME_ADV_S = 0.15
  const x = params.alpha * (homeS - awayS) + HOME_ADV_S
  return 1 / (1 + Math.exp(-x))
}

// ─── Core replay function ─────────────────────────────────────────────────────

const DAYS_PER_WEEK = 7

/**
 * Replay a sequence of historical games with the given CalibrationParams.
 * Team states are maintained across games (within and across seasons).
 * Between seasons, apply offseason mean reversion and process noise expansion.
 *
 * If teamFilter is provided, only return results for those teams (but all teams
 * are still updated to correctly track opponent strengths).
 */
export function replayWithParams(
  games: HistoricalGame[],
  params: CalibrationParams = DEFAULT_CALIBRATION_PARAMS,
  teamFilter?: string[],
): ReplayResult[] {
  const teamStates = new Map<string, TeamKalmanState>()
  const getState = (id: string): TeamKalmanState => {
    if (!teamStates.has(id)) teamStates.set(id, makeInitialTeamState())
    return teamStates.get(id)!
  }

  // Sort games chronologically
  const sorted = [...games].sort((a, b) =>
    a.season !== b.season ? a.season - b.season : a.week - b.week
  )

  const results: ReplayResult[] = []
  let lastSeason: number | null = null

  for (const game of sorted) {
    // Between seasons: apply offseason mean reversion and V expansion
    if (lastSeason !== null && game.season !== lastSeason) {
      const offseasonDays = 180  // approx 6 months between seasons
      for (const [id, state] of teamStates) {
        // Mean reversion: S decays toward 0
        const decayedS = state.S - state.S * params.offseasonMeanReversion * offseasonDays
        // V expands (more uncertainty after long offseason)
        const expandedV = Math.min(2.0, state.V + params.processNoise * offseasonDays * 3)
        teamStates.set(id, { ...state, S: decayedS, V: expandedV })
      }
    }
    lastSeason = game.season

    const homeState = getState(game.homeTeamId)
    const awayState = getState(game.awayTeamId)

    // Win probability prediction BEFORE updating
    const predictedHomeWinProb = winProbFromS(homeState.S, awayState.S, params)

    // Compute observations for home team
    const homeObs = computeGameObservation(
      game.homeWon,
      game.margin,
      game.homeThirdDownPct,
      game.homeRedZonePct,
      game.homeSpecialTeams,
      game.homeTurnovers - game.awayTurnovers,  // net turnovers (positive = bad)
      game.homeSacks,
      awayState.S,   // use current opponent S as opponentStrength
      game.isPrimetime,
      params,
    )

    // Compute observations for away team (mirror: away won = !homeWon, margin negated)
    const awayObs = computeGameObservation(
      !game.homeWon,
      -game.margin,
      game.awayThirdDownPct,
      game.awayRedZonePct,
      game.awaySpecialTeams,
      game.awayTurnovers - game.homeTurnovers,
      game.awaySacks,
      homeState.S,
      game.isPrimetime,
      params,
    )

    const daysSinceHomeLastGame = homeState.lastGameWeek > 0
      ? (game.week - homeState.lastGameWeek) * DAYS_PER_WEEK
      : DAYS_PER_WEEK

    const daysSinceAwayLastGame = awayState.lastGameWeek > 0
      ? (game.week - awayState.lastGameWeek) * DAYS_PER_WEEK
      : DAYS_PER_WEEK

    const newHomeState = applyGameUpdate(homeState, homeObs, params, daysSinceHomeLastGame)
    const newAwayState = applyGameUpdate(awayState, awayObs, params, daysSinceAwayLastGame)

    // Update tracking
    teamStates.set(game.homeTeamId, {
      ...newHomeState,
      lastGameWeek: game.week,
      lastGameSeason: game.season,
    })
    teamStates.set(game.awayTeamId, {
      ...newAwayState,
      lastGameWeek: game.week,
      lastGameSeason: game.season,
    })

    // Only record results for filtered teams (or all if no filter)
    const homeInFilter = !teamFilter || teamFilter.includes(game.homeTeamId)
    const awayInFilter = !teamFilter || teamFilter.includes(game.awayTeamId)

    if (homeInFilter || awayInFilter) {
      results.push({
        gameId: game.gameId,
        season: game.season,
        week: game.week,
        homeTeamId: game.homeTeamId,
        awayTeamId: game.awayTeamId,
        homeS_before: homeState.S,
        homeV_before: homeState.V,
        homeS_after: newHomeState.S,
        homeV_after: newHomeState.V,
        awayS_before: awayState.S,
        awayV_before: awayState.V,
        awayS_after: newAwayState.S,
        awayV_after: newAwayState.V,
        predictedHomeWinProb,
        homeWon: game.homeWon,
        homeDeltaS: newHomeState.S - homeState.S,
        awayDeltaS: newAwayState.S - awayState.S,
      })
    }
  }

  return results
}

// ─── Funding asymmetric long penalty wrapper ──────────────────────────────────

/**
 * Experiment: asymmetric funding penalty on long positions.
 * Does NOT modify market-engine.ts. Wraps the funding rate with an
 * additional penalty for long imbalance.
 *
 * fundingAsymmetricLongPenalty > 0 increases funding rate when longs dominate.
 * This makes the market more expensive to hold long during bullish runs.
 */
export function applyAsymmetricFundingPenalty(
  baseFundingRate: number,
  longOI: number,
  shortOI: number,
  params: CalibrationParams,
): number {
  if (params.fundingAsymmetricLongPenalty <= 0) return baseFundingRate

  const totalOI = longOI + shortOI
  if (totalOI <= 0) return baseFundingRate

  const longFraction = longOI / totalOI  // [0, 1]
  const longExcess = Math.max(0, longFraction - 0.5)  // only when longs > 50%
  const penalty = params.fundingAsymmetricLongPenalty * longExcess * 2  // max at 100% long

  return Math.max(-0.60, Math.min(0.60, baseFundingRate + penalty))
}

// ─── Offseason state projection ───────────────────────────────────────────────

/**
 * Project a team's S/V forward in silence (no games) for N days.
 * Used for offseason realism check in objective function.
 */
export function projectOffseasonSilence(
  S0: number,
  V0: number,
  days: number,
  params: CalibrationParams,
): { S: number; V: number } {
  // Mean reversion: S decays toward 0
  const S = S0 - S0 * params.offseasonMeanReversion * days
  // V expands with process noise
  const V = Math.min(2.0, V0 + params.processNoise * days)
  return { S, V }
}
