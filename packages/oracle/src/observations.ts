import type { GameResult, InjuryReport, SentimentSnapshot, Observation, ProjectionReport } from '../../shared/src/types.ts'

let _obsCounter = 0
function obsId(source: string): string {
  return `${source}-${Date.now()}-${++_obsCounter}`
}

/**
 * gameResultObservation
 * Converts a GameResult into an Observation for the Kalman filter.
 * Formula for observedStrength:
 *   base = win ? +0.3 : -0.3
 *   marginFactor = tanh(margin / 28)              (normalized, saturates at ~2 TDs)
 *   efficiencyFactor = (thirdDownPct - 0.38) * 0.5 + (redZonePct - 0.55) * 0.3
 *   stsBonus = specialTeamsScore * 0.01
 *   oppAdj = opponentStrength * 0.15              (tougher opponent = more signal)
 *   observedStrength = base + 0.4*marginFactor + 0.3*efficiencyFactor + stsBonus + oppAdj
 *   clamped to [-1.2, 1.2]
 */
export function gameResultObservation(result: GameResult, ts: number): Observation {
  const base = result.win ? 0.30 : -0.30
  const marginFactor = Math.tanh(result.margin / 28)    // saturates at ~±2 TDs
  const efficiencyFactor =
    (result.thirdDownPct - 0.38) * 0.5 + (result.redZonePct - 0.55) * 0.3
  const stsBonus = result.specialTeamsScore * 0.01
  const turnoverPenalty = result.turnovers * -0.025
  const sackBonus = result.sacks * 0.015

  // Opponent-quality scale: beating a weak team counts less; losing to elite counts more.
  // Range: oppStrength=-0.40 → scale=0.30;  oppStrength=+0.50 → scale=0.75
  const opponentScale = Math.max(0.25, 0.5 + 0.5 * result.opponentStrength)

  // Garbage-time dampener: blowouts vs clearly weak opponents get a 0.75× haircut.
  // Proxy: |margin|>21 AND opponent is below average.
  // Prevents "dominated a bad team by 30" from registering as franchise-quality evidence.
  const garbageDampen = (Math.abs(result.margin) > 21 && result.opponentStrength < -0.10) ? 0.75 : 1.0

  // Move turnovers and sacks INSIDE the opponent-scale/garbage-dampen envelope.
  // Winning the TO battle against a bad team should not escape the opponent-quality discount.
  const coreSignal = base + 0.4 * marginFactor + 0.3 * efficiencyFactor + stsBonus + turnoverPenalty + sackBonus

  // For losses to strong opponents, add a quality-penalty multiplier:
  //   losing badly to an elite team (opp=+0.50) gets 1.25× the loss signal.
  //   losing to a weak team gets no bonus multiplier.
  const eliteLossPenalty = (!result.win && result.opponentStrength > 0)
    ? 1.0 + result.opponentStrength * 0.50
    : 1.0

  const scaledCore = coreSignal * opponentScale * garbageDampen * eliteLossPenalty

  // Win ceiling: limits how much a win vs a weak opponent can push S.
  // vs Panthers (opp=-0.40): ceiling = 0.22.  vs Eagles (opp=+0.50): ceiling = 0.67.
  // Losses have a symmetric floor (can always fall to -0.80).
  const oppAdjustedCap = result.win
    ? Math.max(0.18, 0.42 + result.opponentStrength * 0.50)
    : 0.80

  const rawStrength = scaledCore

  const observedStrength = Math.max(-0.80, Math.min(oppAdjustedCap, rawStrength))

  // Confidence: limited so the prior (S) carries real weight vs any single game.
  const confidence = Math.min(0.80, 0.58 + Math.abs(marginFactor) * 0.10 + Math.abs(result.opponentStrength) * 0.05)

  // noiseVariance raised vs earlier version → lower Kalman gain → S moves less per game.
  // This is intentional: one game is weak evidence; the full season is strong evidence.
  const noiseVariance = result.primetime ? 0.30 : 0.42

  return {
    id: obsId('game_result'),
    source: 'game_result',
    observedStrength,
    confidence,
    noiseVariance,
    recencyWeight: 1.0,
    directionality: result.win ? 1 : -1,
    decayWindowDays: 21,
    timestamp: ts,
    metadata: {
      week: result.week,
      opponent: result.opponent,
      score: `${result.pointsScored}-${result.pointsAllowed}`,
      margin: result.margin,
      opponentScale: +opponentScale.toFixed(3),
      garbageDampen,
      oppAdjustedCap: +oppAdjustedCap.toFixed(3),
      coreSignal: +coreSignal.toFixed(4),
    },
    provenance: `NYG vs ${result.opponent} W${result.week} 2025`,
  }
}

/**
 * injuryObservation
 * Status multipliers: out=1.0, doubtful=0.7, questionable=0.4, probable=0.1
 * observedStrength = -(impactWeight * statusMultiplier)
 * Higher impact players (QB=0.9, WR1=0.6, etc.) create stronger negative observations
 */
export function injuryObservation(injury: InjuryReport): Observation {
  const statusMultipliers: Record<string, number> = {
    out: 1.0,
    doubtful: 0.7,
    questionable: 0.4,
    probable: 0.1,
  }
  const mult = statusMultipliers[injury.status] ?? 0.5
  const observedStrength = -(injury.impactWeight * mult)

  return {
    id: obsId('injury_shock'),
    source: 'injury_shock',
    observedStrength: Math.max(-1.0, observedStrength),
    // Injury reports are noisy: severity is uncertain, backup quality is unknown,
    // recovery timelines shift. High noiseVariance limits Kalman gain so even a
    // major injury doesn't produce a catastrophic single-update S swing.
    confidence: injury.impactWeight > 0.60 ? 0.75 : 0.65,
    noiseVariance: 0.55,
    recencyWeight: 1.0,
    directionality: -1,
    decayWindowDays: 14,
    timestamp: injury.timestamp,
    metadata: {
      player: injury.playerName,
      position: injury.position,
      status: injury.status,
      impactWeight: injury.impactWeight,
      statusMultiplier: mult,
    },
    provenance: `Injury: ${injury.playerName} (${injury.position}) — ${injury.status}`,
  }
}

/**
 * sentimentObservation
 * Weighted composite: beatReporter*0.35 + nationalMedia*0.25 + fanSentiment*0.20 + momentum*0.20
 * headlineShock doubles the magnitude for extreme events
 * observedStrength mapped from [-1,1] sentiment scale to oracle strength scale
 */
export function sentimentObservation(snap: SentimentSnapshot): Observation {
  const composite =
    snap.beatReporter * 0.35 +
    snap.nationalMedia * 0.25 +
    snap.fanSentiment * 0.20 +
    snap.momentum * 0.20

  const shockMultiplier = snap.headlineShock ? 1.8 : 1.0
  const observedStrength = Math.max(-0.8, Math.min(0.8, composite * shockMultiplier * 0.6))

  // Low dispersion = higher confidence (consensus)
  const dispersionPenalty = snap.dispersion * 0.3
  const confidence = Math.max(0.3, 0.65 - dispersionPenalty)

  return {
    id: obsId('sentiment'),
    source: 'sentiment',
    observedStrength,
    confidence,
    noiseVariance: 0.25 + snap.dispersion * 0.15,
    recencyWeight: 0.85,
    directionality: composite > 0 ? 1 : composite < 0 ? -1 : 0,
    decayWindowDays: 10,
    timestamp: snap.timestamp,
    metadata: {
      composite: +composite.toFixed(4),
      beatReporter: snap.beatReporter,
      nationalMedia: snap.nationalMedia,
      fanSentiment: snap.fanSentiment,
      momentum: snap.momentum,
      headlineShock: snap.headlineShock,
      dispersion: snap.dispersion,
    },
    provenance: `Sentiment composite at ${new Date(snap.timestamp).toLocaleDateString()}`,
  }
}

/**
 * oddsObservation
 * impliedWinProb from market odds converted to oracle strength
 * logit transform: logit(p) = log(p / (1-p))
 * League average win prob ≈ 0.5, so logit(0.5) = 0
 * observedStrength = logit(p) * 0.4 (scaled to oracle range)
 */
export function oddsObservation(impliedWinProb: number, ts: number): Observation {
  const clampedProb = Math.max(0.05, Math.min(0.95, impliedWinProb))
  const logit = Math.log(clampedProb / (1 - clampedProb))
  const observedStrength = Math.max(-1.0, Math.min(1.0, logit * 0.4))

  return {
    id: obsId('market_odds'),
    source: 'market_odds',
    observedStrength,
    confidence: 0.70,
    noiseVariance: 0.20,
    recencyWeight: 0.90,
    directionality: impliedWinProb > 0.5 ? 1 : impliedWinProb < 0.5 ? -1 : 0,
    decayWindowDays: 7,
    timestamp: ts,
    metadata: {
      impliedWinProb,
      logit: +logit.toFixed(4),
      favoriteStatus: impliedWinProb > 0.5 ? 'favorite' : 'underdog',
    },
    provenance: `Market odds: ${(impliedWinProb * 100).toFixed(1)}% implied win probability`,
  }
}

/**
 * projectionObservation
 * Converts a forward-looking projection (analytics model, Vegas win total,
 * coaching trajectory, roster rating, draft capital, SOS) into a weak
 * Kalman observation that nudges S toward the consensus expectation.
 *
 * Key design choices:
 * - noiseVariance is HIGH (0.60–0.75): projections are inherently uncertain.
 *   Even the best analytics models miss by ~1.5 wins/season. This keeps the
 *   Kalman gain low so projections nudge S rather than redefine it.
 * - recencyWeight decays with horizon: a 6-month-out projection counts less
 *   than a 30-day-out projection.
 * - Win-to-S conversion: 1 win ≈ 0.08 S units (8.5 wins = S 0.0 league avg).
 *   This is intentionally conservative — prevents a 7.5-win projection from
 *   single-handedly overriding a 4-13 season of observed evidence.
 *
 * Projection sources and their noise profiles:
 *   analytics         → nV=0.65, high model error (1.5-win RMSE for best models)
 *   market_consensus  → nV=0.60, Vegas is efficient but not perfect
 *   coaching_trajectory → nV=0.70, very context-dependent
 *   roster_rating     → nV=0.65, grades are noisy proxies
 *   draft_capital     → nV=0.75, picks haven't been made yet
 *   schedule_strength → nV=0.55, most deterministic of the group
 */

const NOISE_BY_KIND: Record<ProjectionReport['kind'], number> = {
  analytics:           0.65,
  market_consensus:    0.60,
  coaching_trajectory: 0.70,
  roster_rating:       0.65,
  draft_capital:       0.75,
  schedule_strength:   0.55,
}

/** Average wins for a league-average team (used for win → S conversion). */
const LEAGUE_AVG_WINS = 8.5
/** How much one win is worth in S units. Conservative to prevent projection dominance. */
const WINS_PER_S_UNIT = 0.08  // 1/0.08 = 12.5 wins per S unit across [-1, +1]

export function projectionObservation(proj: ProjectionReport): Observation {
  // Compute observedStrength from projectedS or projectedWins
  let observedStrength: number
  if (proj.projectedS !== undefined) {
    observedStrength = proj.projectedS
  } else if (proj.projectedWins !== undefined) {
    observedStrength = (proj.projectedWins - LEAGUE_AVG_WINS) * WINS_PER_S_UNIT
  } else {
    throw new Error(`ProjectionReport must provide projectedS or projectedWins: ${proj.provenance}`)
  }

  // Clamp to reasonable oracle range
  observedStrength = Math.max(-1.0, Math.min(1.0, observedStrength))

  // recencyWeight decays with horizon: 30d = 0.90, 90d = 0.75, 180d = 0.60, 365d = 0.45
  const recencyWeight = Math.max(0.40, 0.95 - (proj.horizonDays / 365) * 0.55)

  const noiseVariance = NOISE_BY_KIND[proj.kind]

  return {
    id: obsId('projection_signal'),
    source: 'projection_signal',
    observedStrength,
    confidence: proj.confidence,
    noiseVariance,
    recencyWeight,
    directionality: observedStrength > 0.05 ? 1 : observedStrength < -0.05 ? -1 : 0,
    decayWindowDays: Math.max(30, Math.round(proj.horizonDays / 3)),
    timestamp: proj.timestamp,
    metadata: {
      kind: proj.kind,
      projectedWins: proj.projectedWins,
      projectedS: proj.projectedS,
      horizonDays: proj.horizonDays,
      noiseVariance,
      recencyWeight: +recencyWeight.toFixed(3),
    },
    provenance: proj.provenance,
  }
}
