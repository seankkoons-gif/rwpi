import type { GameResult, InjuryReport, SentimentSnapshot, Observation } from '../../shared/src/types.ts'

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
  const marginFactor = Math.tanh(result.margin / 28)          // saturates at ~±2 TDs
  const efficiencyFactor =
    (result.thirdDownPct - 0.38) * 0.5 + (result.redZonePct - 0.55) * 0.3
  const stsBonus = result.specialTeamsScore * 0.01
  const turnoverPenalty = result.turnovers * -0.025
  const sackBonus = result.sacks * 0.015

  // Core signal scaled by opponent quality.
  // Beating a weak team (opponentStrength = -0.40) → scale 0.30
  // Beating a strong team (opponentStrength = +0.50) → scale 0.75
  // Losing to a strong team is penalized more; losing to a weak team is penalized more.
  const opponentScale = Math.max(0.25, 0.5 + 0.5 * result.opponentStrength)
  const coreSignal = base + 0.4 * marginFactor + 0.3 * efficiencyFactor + stsBonus
  const rawStrength = coreSignal * opponentScale + turnoverPenalty + sackBonus

  // Cap at ±0.80 so no single game dominates the state estimate
  const observedStrength = Math.max(-0.80, Math.min(0.80, rawStrength))

  // Confidence: lower than before to allow the prior (S) more weight vs individual games
  const confidence = 0.60 + Math.abs(marginFactor) * 0.10 + Math.abs(result.opponentStrength) * 0.05
  // Higher noiseVariance (0.30) → lower Kalman gain → S moves less per game
  const noiseVariance = result.primetime ? 0.24 : 0.32

  return {
    id: obsId('game_result'),
    source: 'game_result',
    observedStrength,
    confidence: Math.min(0.85, confidence),
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
    confidence: 0.85,
    noiseVariance: 0.15,
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
