import type { TeamState, Observation, OraclePrice, SeasonPhase } from '../../shared/src/types.ts'

export interface OracleConfig {
  launchPrice: number
  launchS: number
  launchV: number
  alpha: number
  beta: number
  processNoise: number
  maxPriceMultiple: number
  minPriceMultiple: number
  markBandPct: number
}

export const GIANTS_CONFIG: OracleConfig = {
  launchPrice: 100.0,
  launchS: -0.15,
  launchV: 0.6,
  alpha: 0.30,
  beta: 0.40,
  // Higher process noise keeps V from collapsing; allows S to respond to
  // sustained poor performance over a full season (0.015/day = ~0.10/week)
  processNoise: 0.005,
  maxPriceMultiple: 6.0,
  minPriceMultiple: 0.05,
  markBandPct: 0.08,
}

export function calcFairPrice(S: number, V: number, config: OracleConfig): number {
  const exponent = config.alpha * S - 0.5 * config.beta * V
  const raw = config.launchPrice * Math.exp(exponent)
  return Math.max(
    config.launchPrice * config.minPriceMultiple,
    Math.min(config.launchPrice * config.maxPriceMultiple, raw)
  )
}

export function calcMarkPrice(fairPrice: number, lastMark: number | null, config: OracleConfig): number {
  if (lastMark === null) return fairPrice
  const band = fairPrice * config.markBandPct
  const drift = (fairPrice - lastMark) * 0.3
  const proposed = lastMark + drift
  return Math.max(fairPrice - band, Math.min(fairPrice + band, proposed))
}

export function buildOraclePrice(state: TeamState, lastMark: number | null, config: OracleConfig): OraclePrice {
  const fair = calcFairPrice(state.S, state.V, config)
  const mark = calcMarkPrice(fair, lastMark, config)
  return {
    fairPrice: fair,
    markPrice: mark,
    launchPrice: config.launchPrice,
    priceChangeFromLaunch: ((mark - config.launchPrice) / config.launchPrice) * 100,
    timestamp: state.timestamp,
    confidenceBand: {
      low: fair * Math.exp(-1.5 * state.U * config.alpha),
      high: fair * Math.exp(1.5 * state.U * config.alpha),
    },
  }
}

export function kalmanUpdate(
  S_prior: number,
  V_prior: number,
  z: number,
  R: number
): { S: number; V: number; gain: number } {
  const gain = V_prior / (V_prior + R)
  return {
    S: S_prior + gain * (z - S_prior),
    V: Math.max(0.001, (1 - gain) * V_prior),
    gain,
  }
}

export function applyObservations(
  S_in: number,
  V_in: number,
  observations: Observation[],
  config: OracleConfig,
  daysSinceLastUpdate: number,
): { S: number; V: number; attributions: Record<string, number> } {
  let S = S_in
  let V = V_in + config.processNoise * daysSinceLastUpdate
  const attributions: Record<string, number> = {}

  const sorted = [...observations].sort((a, b) => b.confidence - a.confidence)
  for (const obs of sorted) {
    const weight = obs.confidence * obs.recencyWeight
    if (weight < 0.01) continue
    const R = obs.noiseVariance / weight
    const S_before = S
    const { S: S_new, V: V_new } = kalmanUpdate(S, V, obs.observedStrength, R)
    attributions[obs.source] = (attributions[obs.source] ?? 0) + (S_new - S_before)
    S = S_new
    V = Math.max(0.001, V_new)
  }
  return { S, V, attributions }
}

export function offseasonCarry(S: number, V: number, daysSinceLastGame: number): { S: number; V: number } {
  return {
    S: S - S * 0.0015 * daysSinceLastGame,
    V: Math.min(2.0, V + 0.003 * daysSinceLastGame),
  }
}

// ─── Offseason transition (structured regime change) ─────────────────────────

export interface OffseasonCoachingChange {
  fromCoach: string
  toCoach: string
  qualitySignal: number     // -1 to +1; +1 = biggest possible upgrade
  confidence: number        // how certain we are this HC will help (0-1)
  varianceAddition: number  // extra V added (regime change = more uncertainty)
}

export interface OffseasonRosterMove {
  player: string
  role: string
  impact: number            // -1 to +1 (e.g. +0.10 = meaningful positive)
  confidence: number        // 0-1
}

export interface OffseasonTransition {
  coachingChange?: OffseasonCoachingChange
  rosterMoves: OffseasonRosterMove[]
  sentimentPost?: {
    overall: number         // -1 to +1
    beatReporter: number
    nationalMedia: number
    fanSentiment: number
    headlineShock: boolean
    dispersion: number
  }
  daysFromSeasonEndToNow: number
}

/**
 * Apply an explicit offseason transition (coaching change + roster moves + sentiment).
 * This is a more structured version of offseasonCarry that supports regime changes.
 * Returns updated S, V, and a named attribution breakdown for the dashboard.
 */
export function applyOffseasonTransition(
  S_in: number,
  V_in: number,
  transition: OffseasonTransition,
  config: OracleConfig,
): { S: number; V: number; attributions: Record<string, number> } {
  let S = S_in
  let V = V_in
  const attributions: Record<string, number> = {}

  // 1. Passive time decay toward mean + uncertainty expansion
  //    Reduced decay rate (0.0006/day): bad team's strength stays negative through offseason;
  //    mean reversion is slow because we're still observing the same underlying roster.
  const decayFactor = 0.0006
  const passiveDecay = -S * decayFactor * transition.daysFromSeasonEndToNow
  S += passiveDecay
  // Uncertainty expands with time: no games = growing state uncertainty
  V = Math.min(2.0, V + 0.0030 * transition.daysFromSeasonEndToNow)
  attributions['offseason_decay'] = passiveDecay

  // 2. Coaching change (Kalman update on S + hard variance addition)
  if (transition.coachingChange) {
    const cc = transition.coachingChange
    const projectedImprovement = cc.qualitySignal * 0.30
    const z = S + projectedImprovement
    // High R: coaching change is high-noise (roster may not support the HC)
    const R = 0.70 + (1 - cc.confidence) * 1.40
    const { S: S_new, V: V_new } = kalmanUpdate(S, V, z, R)
    const delta = S_new - S
    attributions['coaching_reset'] = delta
    S = S_new
    V = Math.max(0.001, V_new)
    // Regime change adds direct variance (new system = genuinely unproven)
    V = Math.min(2.0, V + cc.varianceAddition)
  }

  // 3. Roster moves — applied as DIRECT S adjustment (no Kalman, no V compression)
  //    Rationale: FA signings are small, incremental signals that don't justify a full
  //    Bayesian update compressing the state variance. They shift the expected S directly.
  let rosterDelta = 0
  for (const move of transition.rosterMoves) {
    rosterDelta += move.impact * move.confidence * 0.18  // scaled: FA value ≈ 0.18x face
  }
  S += rosterDelta
  attributions['roster_moves'] = rosterDelta

  // 4. Sentiment / media narrative (light Kalman, muted scaling)
  if (transition.sentimentPost) {
    const sent = transition.sentimentPost
    const composite = (
      sent.beatReporter * 0.35 +
      sent.nationalMedia * 0.30 +
      sent.fanSentiment * 0.20 +
      sent.overall * 0.15
    )
    const z = S + composite * 0.12   // small: sentiment is leading, not confirming
    const R = 0.80 + sent.dispersion * 0.50
    const { S: S_new, V: V_new } = kalmanUpdate(S, V, z, R)
    attributions['sentiment_narrative'] = S_new - S
    S = S_new
    V = Math.max(0.001, V_new)
  }

  // 5. Enforce minimum V for an offseason with a regime change.
  //    New HC + unproven roster = genuine uncertainty floor.
  //    A V below 0.33 implies false precision about a team in active transition.
  const V_floor = transition.coachingChange ? 0.355 : 0.18
  V = Math.max(V_floor, V)

  return { S, V, attributions }
}
