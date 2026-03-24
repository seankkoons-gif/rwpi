import type { StateSnapshot } from '../../shared/src/types.ts'
import { GIANTS_CONFIG, applyObservations, buildOraclePrice, applyOffseasonTransition } from './oracle.ts'
import { gameResultObservation, injuryObservation, sentimentObservation, oddsObservation } from './observations.ts'
import { buildMarketState } from './market-engine.ts'
import {
  GIANTS_2025_GAMES,
  GIANTS_2025_INJURIES,
  GIANTS_2025_SENTIMENT,
  GIANTS_2025_ODDS,
  MARCH_2026_TRANSITION,
} from './seed-giants.ts'

const SEASON_START_2025 = new Date('2025-09-05T18:00:00Z').getTime()
const WEEK_MS = 7 * 24 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

export function runGiantsSimulation(): StateSnapshot[] {
  const snapshots: StateSnapshot[] = []

  // Launch state: Giants enter 2025 as a below-average team
  let S = GIANTS_CONFIG.launchS   // -0.15
  let V = GIANTS_CONFIG.launchV   // 0.60
  let lastMark: number | null = null
  let longOI = 500_000
  let shortOI = 500_000
  let lastUpdateTs = SEASON_START_2025

  // ─── Simulate 2025 regular season ──────────────────────────────────────────
  for (const game of GIANTS_2025_GAMES) {
    const gameTs = SEASON_START_2025 + (game.week - 1) * WEEK_MS
    const daysSince = Math.max(1, (gameTs - lastUpdateTs) / DAY_MS)
    lastUpdateTs = gameTs

    const observations = []

    // Game result
    observations.push(gameResultObservation(game, gameTs))

    // Injuries near this week (±4 days)
    for (const inj of GIANTS_2025_INJURIES) {
      if (Math.abs(inj.timestamp - gameTs) < 4 * DAY_MS) {
        observations.push(injuryObservation(inj))
      }
    }

    // Sentiment near this week (±4 days)
    for (const snap of GIANTS_2025_SENTIMENT) {
      if (Math.abs(snap.timestamp - gameTs) < 4 * DAY_MS) {
        observations.push(sentimentObservation(snap))
      }
    }

    // Market odds near this week (±4 days)
    for (const odds of GIANTS_2025_ODDS) {
      if (Math.abs(odds.timestamp - gameTs) < 4 * DAY_MS) {
        observations.push(oddsObservation(odds.impliedWinProb, odds.timestamp))
      }
    }

    const { S: S_new, V: V_new, attributions } = applyObservations(S, V, observations, GIANTS_CONFIG, daysSince)
    S = S_new
    V = V_new
    const U = Math.sqrt(V)

    const teamState = {
      teamId: 'nyg', teamName: 'New York Giants',
      S, V, U, timestamp: gameTs, seasonPhase: 'regular' as const,
    }
    const oraclePrice = buildOraclePrice(teamState, lastMark, GIANTS_CONFIG)
    lastMark = oraclePrice.markPrice

    const oiShift = game.win ? 25_000 : -15_000
    const marginBoost = Math.abs(game.margin) * 500
    if (game.win) {
      longOI = Math.max(100_000, longOI + oiShift + marginBoost)
      shortOI = Math.max(100_000, shortOI - oiShift * 0.5)
    } else {
      shortOI = Math.max(100_000, shortOI + Math.abs(oiShift) + marginBoost)
      longOI = Math.max(100_000, longOI - Math.abs(oiShift) * 0.5)
    }

    const marketState = buildMarketState(longOI, shortOI, U, oraclePrice.markPrice, oraclePrice.fairPrice)

    let event: string
    if (game.margin <= -20) event = `💥 Blowout Loss vs ${game.opponent}`
    else if (game.margin >= 20) event = `🔥 Dominant Win vs ${game.opponent}`
    else if (game.win) event = `✅ Win vs ${game.opponent}`
    else event = `❌ Loss vs ${game.opponent} (${game.margin})`

    snapshots.push({
      timestamp: gameTs,
      S, V, U,
      price: oraclePrice.fairPrice,
      markPrice: oraclePrice.markPrice,
      fundingRate: marketState.fundingRate,
      longOI, shortOI,
      seasonPhase: 'regular',
      event,
      week: game.week,
      attributions: {
        gamePerformance: attributions['game_result'] ?? 0,
        injuries: attributions['injury_shock'] ?? 0,
        sentiment: attributions['sentiment'] ?? 0,
        marketOdds: attributions['market_odds'] ?? 0,
        specialTeams: game.specialTeamsScore * 0.002,
      },
    })
  }

  // S/V at end of 2025 regular season
  const S_end2025 = S
  const V_end2025 = V
  const endOfSeasonTs = SEASON_START_2025 + 16 * WEEK_MS  // ~Jan 2, 2026

  // ─── March 24, 2026 offseason transition ────────────────────────────────────
  // Apply: coaching reset (John Harbaugh), roster FA moves, sentiment, offseason decay
  const { S: S_mar26, V: V_mar26, attributions: offAttr } = applyOffseasonTransition(
    S_end2025,
    V_end2025,
    {
      coachingChange: {
        fromCoach: MARCH_2026_TRANSITION.coachingChange.fromCoach,
        toCoach: MARCH_2026_TRANSITION.coachingChange.toCoach,
        qualitySignal: MARCH_2026_TRANSITION.coachingChange.qualitySignal,
        confidence: MARCH_2026_TRANSITION.coachingChange.confidence,
        varianceAddition: MARCH_2026_TRANSITION.coachingChange.varianceAddition,
      },
      rosterMoves: MARCH_2026_TRANSITION.rosterMoves,
      sentimentPost: MARCH_2026_TRANSITION.sentimentPost,
      daysFromSeasonEndToNow: MARCH_2026_TRANSITION.daysFromSeasonEndToMar24,
    },
    GIANTS_CONFIG,
  )

  const mar24Ts = new Date('2026-03-24T12:00:00Z').getTime()
  const U_mar26 = Math.sqrt(V_mar26)

  const mar26TeamState = {
    teamId: 'nyg', teamName: 'New York Giants',
    S: S_mar26, V: V_mar26, U: U_mar26,
    timestamp: mar24Ts, seasonPhase: 'offseason' as const,
  }
  const mar26Price = buildOraclePrice(mar26TeamState, lastMark, GIANTS_CONFIG)
  const mar26Market = buildMarketState(longOI, shortOI, U_mar26, mar26Price.markPrice, mar26Price.fairPrice)

  snapshots.push({
    timestamp: mar24Ts,
    S: S_mar26, V: V_mar26, U: U_mar26,
    price: mar26Price.fairPrice,
    markPrice: mar26Price.markPrice,
    fundingRate: mar26Market.fundingRate,
    longOI, shortOI,
    seasonPhase: 'offseason',
    event: '📅 Current State — March 24, 2026 (Offseason)',
    attributions: {
      // Season-level damage:
      gamePerformance: snapshots.reduce((a, s) => a + (s.attributions?.gamePerformance ?? 0), 0),
      injuries: snapshots.reduce((a, s) => a + (s.attributions?.injuries ?? 0), 0),
      sentiment: snapshots.reduce((a, s) => a + (s.attributions?.sentiment ?? 0), 0),
      // Offseason:
      offseasonDecay: offAttr['offseason_decay'] ?? 0,
      coachingReset: offAttr['coaching_reset'] ?? 0,
      rosterMoves: offAttr['roster_moves'] ?? 0,
      sentimentNarrative: offAttr['sentiment_narrative'] ?? 0,
      // Point differential drag (informational, not Kalman-derived):
      pointDifferentialDrag: -0.058,  // anchored to 2025's -58 pd / 1000 as normalized signal
    },
  })

  return snapshots
}
