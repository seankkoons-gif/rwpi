/**
 * elo.ts — Elo baseline for Prophet RWP Oracle calibration
 *
 * A clean, hard-to-fool Elo model that serves as the sanity-check baseline.
 * If RWPI can't beat Elo on win prediction, the Kalman machinery is adding noise.
 * If RWPI matches or beats Elo, it earns the right to be more than a win predictor.
 *
 * Based on the 538/FiveThirtyEight NFL Elo model (natesilver.net).
 */

export interface EloConfig {
  initialRating: number         // 1500
  kFactor: number               // 32
  homeAdvantage: number         // 65 rating points
  marginOfVictoryEnabled: boolean
  offseasonReversion: number    // 0.33 (fraction pulled toward 1500 each offseason)
}

export const DEFAULT_ELO_CONFIG: EloConfig = {
  initialRating: 1500,
  kFactor: 32,
  homeAdvantage: 65,
  marginOfVictoryEnabled: true,
  offseasonReversion: 0.33,
}

export interface EloTeamState {
  teamId: string
  rating: number
}

export interface EloGameInput {
  gameId: string
  season: number
  week: number
  homeTeamId: string
  awayTeamId: string
  homeWon: boolean
  margin: number   // |homeScore - awayScore|, unsigned
}

export interface EloUpdate {
  gameId: string
  season: number
  week: number
  homeTeamId: string
  awayTeamId: string
  homeRatingBefore: number
  awayRatingBefore: number
  homeRatingAfter: number
  awayRatingAfter: number
  predictedHomeWinProb: number
  actualHomeWon: boolean
  eloDiff: number  // homeRating - awayRating (with home advantage)
  movMultiplier: number
}

/**
 * Standard Elo win probability formula.
 * homeAdv is added to ratingA's effective rating (already in rating-point units).
 */
export function expectedWinProb(ratingA: number, ratingB: number, homeAdv: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA - homeAdv) / 400))
}

/**
 * MOV multiplier from the 538 formula.
 * ln(|margin| + 1) * 2.2 / (eloDiff * 0.001 + 2.2)
 * eloDiff = rating of winner - rating of loser (at time of game, with home advantage).
 * Larger margins count more, but the gain diminishes for teams with a large rating gap.
 */
export function movMultiplier(margin: number, eloDiff: number): number {
  return (Math.log(Math.abs(margin) + 1) * 2.2) / (eloDiff * 0.001 + 2.2)
}

/**
 * Apply a single game update to both team states.
 */
export function updateRatings(
  homeState: EloTeamState,
  awayState: EloTeamState,
  game: EloGameInput,
  config: EloConfig,
): { homeState: EloTeamState; awayState: EloTeamState; update: EloUpdate } {
  const homeRatingEff = homeState.rating + config.homeAdvantage
  const predictedHomeWinProb = expectedWinProb(homeState.rating, awayState.rating, config.homeAdvantage)
  const actualHomeWon = game.homeWon ? 1 : 0

  // MOV multiplier: use winner rating minus loser rating (with home adj)
  const eloDiff = game.homeWon
    ? homeRatingEff - awayState.rating
    : awayState.rating - homeRatingEff

  const mov = config.marginOfVictoryEnabled ? movMultiplier(game.margin, eloDiff) : 1.0

  const k = config.kFactor
  const homeRatingAfter = homeState.rating + k * mov * (actualHomeWon - predictedHomeWinProb)
  const awayRatingAfter = awayState.rating + k * mov * ((1 - actualHomeWon) - (1 - predictedHomeWinProb))

  return {
    homeState: { ...homeState, rating: homeRatingAfter },
    awayState: { ...awayState, rating: awayRatingAfter },
    update: {
      gameId: game.gameId,
      season: game.season,
      week: game.week,
      homeTeamId: game.homeTeamId,
      awayTeamId: game.awayTeamId,
      homeRatingBefore: homeState.rating,
      awayRatingBefore: awayState.rating,
      homeRatingAfter,
      awayRatingAfter,
      predictedHomeWinProb,
      actualHomeWon: game.homeWon,
      eloDiff,
      movMultiplier: mov,
    },
  }
}

/**
 * Pull all ratings toward 1500 by fraction each offseason.
 * Fraction=0.33 means: newRating = rating + 0.33 * (1500 - rating)
 * = 0.67 * rating + 0.33 * 1500
 */
export function applyOffseasonReversion(
  states: Map<string, EloTeamState>,
  fraction: number,
): Map<string, EloTeamState> {
  const result = new Map<string, EloTeamState>()
  for (const [teamId, state] of states) {
    const reverted = state.rating + fraction * (1500 - state.rating)
    result.set(teamId, { ...state, rating: reverted })
  }
  return result
}

/**
 * Full deterministic replay over multiple seasons.
 * Processes games in season/week order.
 * Returns all per-game EloUpdate records.
 */
export function replaySeasons(
  games: EloGameInput[],
  config: EloConfig,
): EloUpdate[] {
  // Initialize all teams at 1500
  const teamStates = new Map<string, EloTeamState>()
  const getTeam = (id: string): EloTeamState => {
    if (!teamStates.has(id)) {
      teamStates.set(id, { teamId: id, rating: config.initialRating })
    }
    return teamStates.get(id)!
  }

  const sorted = [...games].sort((a, b) =>
    a.season !== b.season ? a.season - b.season : a.week - b.week
  )

  const updates: EloUpdate[] = []
  let lastSeason: number | null = null

  for (const game of sorted) {
    // Apply offseason reversion between seasons
    if (lastSeason !== null && game.season !== lastSeason) {
      const reverted = applyOffseasonReversion(teamStates, config.offseasonReversion)
      for (const [id, state] of reverted) {
        teamStates.set(id, state)
      }
    }
    lastSeason = game.season

    const homeState = getTeam(game.homeTeamId)
    const awayState = getTeam(game.awayTeamId)

    const { homeState: newHome, awayState: newAway, update } = updateRatings(
      homeState, awayState, game, config
    )

    teamStates.set(game.homeTeamId, newHome)
    teamStates.set(game.awayTeamId, newAway)
    updates.push(update)
  }

  return updates
}

export interface EloPrediction {
  gameId: string
  predictedProb: number   // P(home wins)
  actualOutcome: number   // 1 = home won, 0 = away won
}

export interface EloMetrics {
  logLoss: number
  brierScore: number
  calibrationError: number  // MAE across decile buckets
  totalGames: number
}

/**
 * Compute Elo prediction quality metrics.
 */
export function computeEloMetrics(updates: EloUpdate[]): EloMetrics {
  const n = updates.length
  if (n === 0) return { logLoss: 0, brierScore: 0, calibrationError: 0, totalGames: 0 }

  const predictions: EloPrediction[] = updates.map(u => ({
    gameId: u.gameId,
    predictedProb: u.predictedHomeWinProb,
    actualOutcome: u.actualHomeWon ? 1 : 0,
  }))

  // Log loss
  let logLossSum = 0
  for (const p of predictions) {
    const clampedP = Math.max(0.01, Math.min(0.99, p.predictedProb))
    const y = p.actualOutcome
    logLossSum += -(y * Math.log(clampedP) + (1 - y) * Math.log(1 - clampedP))
  }
  const logLoss = logLossSum / n

  // Brier score
  let brierSum = 0
  for (const p of predictions) {
    brierSum += Math.pow(p.predictedProb - p.actualOutcome, 2)
  }
  const brierScore = brierSum / n

  // Calibration: bucket into 10 deciles, compare predicted vs actual rates
  const buckets: { sumPred: number; sumActual: number; count: number }[] = Array.from(
    { length: 10 },
    () => ({ sumPred: 0, sumActual: 0, count: 0 })
  )
  for (const p of predictions) {
    const bucket = Math.min(9, Math.floor(p.predictedProb * 10))
    buckets[bucket].sumPred += p.predictedProb
    buckets[bucket].sumActual += p.actualOutcome
    buckets[bucket].count++
  }
  let calibrationSum = 0
  let calibrationBuckets = 0
  for (const b of buckets) {
    if (b.count > 0) {
      const avgPred = b.sumPred / b.count
      const avgActual = b.sumActual / b.count
      calibrationSum += Math.abs(avgPred - avgActual)
      calibrationBuckets++
    }
  }
  const calibrationError = calibrationBuckets > 0 ? calibrationSum / calibrationBuckets : 0

  return { logLoss, brierScore, calibrationError, totalGames: n }
}
