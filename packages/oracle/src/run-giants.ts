import type { StateSnapshot } from '../../shared/src/types.ts'
import {
  GIANTS_CONFIG,
  applyObservations,
  applyObservationsSplit,
  applyOffseasonTransitionSplit,
  buildOraclePrice,
  calcCombinedS,
} from './oracle.ts'
import { gameResultObservation, injuryObservation, sentimentObservation, oddsObservation, projectionObservation } from './observations.ts'
import { buildMarketState } from './market-engine.ts'
import {
  GIANTS_2025_GAMES,
  GIANTS_2025_INJURIES,
  GIANTS_2025_SENTIMENT,
  GIANTS_2025_ODDS,
  MARCH_2026_TRANSITION,
  GIANTS_2026_PROJECTIONS,
} from './seed-giants.ts'

const SEASON_START_2025 = new Date('2025-09-05T18:00:00Z').getTime()
const WEEK_MS = 7 * 24 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

export function runGiantsSimulation(): StateSnapshot[] {
  const snapshots: StateSnapshot[] = []

  // Launch state: Giants enter 2025 with split S_q / S_o components
  let S_q = GIANTS_CONFIG.launchSq   // -0.20 (current quality: below-avg roster)
  let S_o = GIANTS_CONFIG.launchSo   // +0.067 (forward optionality: new season upside)
  let V = GIANTS_CONFIG.launchV      // 0.60
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

    // Game result (current_quality)
    observations.push(gameResultObservation(game, gameTs))

    // Injuries near this week (±4 days) — current_quality
    for (const inj of GIANTS_2025_INJURIES) {
      if (Math.abs(inj.timestamp - gameTs) < 4 * DAY_MS) {
        observations.push(injuryObservation(inj))
      }
    }

    // Sentiment near this week (±4 days) — combined
    for (const snap of GIANTS_2025_SENTIMENT) {
      if (Math.abs(snap.timestamp - gameTs) < 4 * DAY_MS) {
        observations.push(sentimentObservation(snap))
      }
    }

    // Market odds near this week (±4 days) — current_quality
    for (const odds of GIANTS_2025_ODDS) {
      if (Math.abs(odds.timestamp - gameTs) < 4 * DAY_MS) {
        observations.push(oddsObservation(odds.impliedWinProb, odds.timestamp))
      }
    }

    const { S_q: Sq_new, S_o: So_new, V: V_new, attributions } =
      applyObservationsSplit(S_q, S_o, V, observations, GIANTS_CONFIG, daysSince)
    S_q = Sq_new
    S_o = So_new
    V = V_new

    const combinedS = calcCombinedS(S_q, S_o, GIANTS_CONFIG)
    const U = Math.sqrt(V)

    const teamState = {
      teamId: 'nyg', teamName: 'New York Giants',
      S: combinedS, V, U, timestamp: gameTs, seasonPhase: 'regular' as const,
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
      S: combinedS, V, U,
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

  // S_q / S_o / V at end of 2025 regular season
  const S_q_end2025 = S_q
  const S_o_end2025 = S_o
  const V_end2025 = V

  // ─── March 24, 2026 offseason transition (split version) ────────────────────
  const mar24Ts = new Date('2026-03-24T12:00:00Z').getTime()

  const { S_q: S_q_mar26, S_o: S_o_mar26, V: V_mar26, attributions: offAttr } =
    applyOffseasonTransitionSplit(
      S_q_end2025,
      S_o_end2025,
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

  // ─── 2026 forward-looking projections ───────────────────────────────────────
  // Composite all projections into a SINGLE Kalman update (forward_optionality component)
  // to prevent 6 independent observations from compounding at high V.
  let S_q_proj = S_q_mar26
  let S_o_proj = S_o_mar26
  let V_proj = V_mar26

  if (GIANTS_2026_PROJECTIONS.length > 0) {
    const projObs = GIANTS_2026_PROJECTIONS.map(projectionObservation)

    // Weighted average of observedStrength (weight by confidence)
    const totalWeight = projObs.reduce((s, o) => s + o.confidence, 0)
    const avgZ = projObs.reduce((s, o) => s + o.observedStrength * o.confidence, 0) / totalWeight
    const avgConf = totalWeight / projObs.length

    // Cross-projection spread → noiseVariance floor
    const maxZ = Math.max(...projObs.map(o => o.observedStrength))
    const minZ = Math.min(...projObs.map(o => o.observedStrength))
    const spread = maxZ - minZ
    const compositeNV = Math.max(0.80, 0.60 + spread * 0.60)

    // Build one composite observation (forward_optionality) for the full projection consensus
    const compositeObs = [{
      id: 'proj-composite-2026',
      source: 'projection_signal' as const,
      component: 'forward_optionality' as const,
      observedStrength: avgZ,
      confidence: avgConf,
      noiseVariance: compositeNV,
      recencyWeight: 0.75,
      directionality: (avgZ > 0.05 ? 1 : avgZ < -0.05 ? -1 : 0) as 1 | -1 | 0,
      decayWindowDays: 60,
      timestamp: mar24Ts,
      metadata: { kind: 'composite', sourceCount: projObs.length, avgZ, spread, compositeNV },
      provenance: `Composite 2026 projection (n=${projObs.length}): avgZ=${avgZ.toFixed(3)}, spread=${spread.toFixed(3)}`,
    }]

    const result = applyObservationsSplit(S_q_mar26, S_o_mar26, V_mar26, compositeObs, GIANTS_CONFIG, 0)
    S_q_proj = result.S_q
    S_o_proj = result.S_o
    V_proj = result.V
  }

  const S_final_q = S_q_proj
  const S_final_o = S_o_proj
  const V_final = V_proj
  const S_final = calcCombinedS(S_final_q, S_final_o, GIANTS_CONFIG)
  const U_mar26 = Math.sqrt(V_final)

  const mar26TeamState = {
    teamId: 'nyg', teamName: 'New York Giants',
    S: S_final, V: V_final, U: U_mar26,
    timestamp: mar24Ts, seasonPhase: 'offseason' as const,
  }
  const mar26Price = buildOraclePrice(mar26TeamState, lastMark, GIANTS_CONFIG)
  const mar26Market = buildMarketState(longOI, shortOI, U_mar26, mar26Price.markPrice, mar26Price.fairPrice)

  snapshots.push({
    timestamp: mar24Ts,
    S: S_final, V: V_final, U: U_mar26,
    S_q: S_final_q,
    S_o: S_final_o,
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
      offseasonCarry: offAttr['offseason_decay'] ?? 0,
      rosterCoaching: (offAttr['coaching_reset'] ?? 0) + (offAttr['roster_moves'] ?? 0),
      // Projection nudge (S_o delta from projections):
      projectionNudge: S_o_proj - S_o_mar26,
      // Three-component deltas:
      currentQualityDelta: S_final_q - GIANTS_CONFIG.launchSq,
      forwardOptionalityDelta: S_final_o - GIANTS_CONFIG.launchSo,
    },
  })

  return snapshots
}
