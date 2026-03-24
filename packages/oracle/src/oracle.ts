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
  /** λ: discount applied to S_o in the combined-S pricing formula. Default 0.75. */
  optionalityDiscount: number
  /** Initial S_q (current-quality component) at launch. */
  launchSq: number
  /** Initial S_o (forward-optionality component) at launch. */
  launchSo: number
}

export const GIANTS_CONFIG: OracleConfig = {
  launchPrice: 100.0,
  launchS: -0.15,
  // launchSq + λ×launchSo = -0.20 + 0.75×0.067 = -0.15 ✓ (matches launchS for backward compat)
  launchSq: -0.20,   // launch current quality (Giants entered 2025 as a below-avg team)
  launchSo: 0.067,   // launch forward optionality (new season = some upside potential)
  optionalityDiscount: 0.75,
  launchV: 0.6,
  // alpha: 0.35 (calibrated from 0.30) — S is better shaped post-calibration;
  // price should respond proportionally more to latent-strength changes.
  alpha: 0.35,
  beta: 0.40,
  // processNoise: 0.002 (calibrated from 0.005) — original was expanding V too
  // aggressively between games. At 0.002/day: ~0.014/week, ~0.06/offseason-month.
  // V still widens meaningfully over an offseason; just doesn't sprint.
  processNoise: 0.002,
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

/**
 * calcCombinedS
 * Combine S_q and S_o into a single latent strength for pricing.
 * Formula: S = S_q + λ × S_o  (λ = config.optionalityDiscount, default 0.75)
 * Use: calcFairPrice(calcCombinedS(S_q, S_o, cfg), V, cfg)
 */
export function calcCombinedS(S_q: number, S_o: number, config: OracleConfig): number {
  return S_q + config.optionalityDiscount * S_o
}

/**
 * applyObservationsSplit
 * Like applyObservations but routes each observation to S_q, S_o, or both
 * based on obs.component:
 *   'current_quality'    → updates S_q only
 *   'forward_optionality'→ updates S_o only
 *   'combined'           → updates both S_q and S_o (same K, one V update)
 *
 * V is updated once per observation regardless of routing (information reduces total uncertainty).
 * The existing applyObservations(S, V, ...) is preserved for backward compatibility.
 */
export function applyObservationsSplit(
  S_q_in: number,
  S_o_in: number,
  V_in: number,
  observations: Observation[],
  config: OracleConfig,
  daysSinceLastUpdate: number,
): { S_q: number; S_o: number; V: number; attributions: Record<string, number> } {
  let S_q = S_q_in
  let S_o = S_o_in
  let V = V_in + config.processNoise * daysSinceLastUpdate
  const attributions: Record<string, number> = {}

  const sorted = [...observations].sort((a, b) => b.confidence - a.confidence)
  for (const obs of sorted) {
    const weight = obs.confidence * obs.recencyWeight
    if (weight < 0.01) continue
    const R = obs.noiseVariance / weight
    const K = V / (V + R)

    const Sq_before = S_q
    const So_before = S_o

    if (obs.component === 'current_quality' || obs.component === 'combined') {
      S_q = S_q + K * (obs.observedStrength - S_q)
    }
    if (obs.component === 'forward_optionality' || obs.component === 'combined') {
      S_o = S_o + K * (obs.observedStrength - S_o)
    }
    V = Math.max(0.001, (1 - K) * V)

    // Attribution: track total delta per source (combined delta for display)
    const delta = (S_q - Sq_before) + (S_o - So_before)
    attributions[obs.source] = (attributions[obs.source] ?? 0) + delta
  }
  return { S_q, S_o, V, attributions }
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

/**
 * applyOffseasonTransitionSplit
 * Split-state version of applyOffseasonTransition.
 * Routes each offseason event to the correct latent component:
 *   - Passive decay      → S_q only (proven quality regresses toward mean)
 *   - Coaching change    → S_o only (hire improves future optionality, not immediate quality)
 *   - Roster moves       → S_q if confidence > 0.70 (proven veterans), S_o otherwise
 *   - Sentiment          → combined (both S_q and S_o, same K)
 *   - V expansion/floor  → applies to shared V (no split)
 *
 * The existing applyOffseasonTransition(S, V, transition, config) is preserved unchanged.
 */
export function applyOffseasonTransitionSplit(
  S_q_in: number,
  S_o_in: number,
  V_in: number,
  transition: OffseasonTransition,
  config: OracleConfig,
): { S_q: number; S_o: number; V: number; attributions: Record<string, number> } {
  let S_q = S_q_in
  let S_o = S_o_in
  let V = V_in
  const attributions: Record<string, number> = {}

  // 1. Passive time decay + V expansion
  //    S_q regresses toward mean (proven quality fades without new evidence).
  //    S_o does NOT decay (forward optionality is about events yet to happen).
  const decayFactor = 0.0006
  const passiveDecay = -S_q * decayFactor * transition.daysFromSeasonEndToNow
  S_q += passiveDecay
  V = Math.min(2.0, V + 0.0030 * transition.daysFromSeasonEndToNow)
  attributions['offseason_decay'] = passiveDecay

  // 2. Coaching change → Kalman update on S_o ONLY.
  //    The hire projects future optionality; immediate quality is unchanged.
  //    z_o = S_o + qualitySignal * 0.30  (the HC adds that much forward optionality)
  if (transition.coachingChange) {
    const cc = transition.coachingChange
    const projectedImprovement = cc.qualitySignal * 0.30
    const z_o = S_o + projectedImprovement
    const R = 0.70 + (1 - cc.confidence) * 1.40
    const { S: S_o_new, V: V_new } = kalmanUpdate(S_o, V, z_o, R)
    const delta = S_o_new - S_o
    attributions['coaching_reset'] = delta
    S_o = S_o_new
    V = Math.max(0.001, V_new)
    // Regime change: direct variance addition (new system = genuinely unproven)
    V = Math.min(2.0, V + cc.varianceAddition)
  }

  // 3. Roster moves — DIRECT S adjustment (no Kalman, no V compression).
  //    confidence > 0.70 → proven veterans → updates S_q
  //    confidence ≤ 0.70 → prospects / scheme fits → updates S_o
  let rosterDeltaQ = 0
  let rosterDeltaO = 0
  for (const move of transition.rosterMoves) {
    const scaledImpact = move.impact * move.confidence * 0.18
    if (move.confidence > 0.70) {
      rosterDeltaQ += scaledImpact
    } else {
      rosterDeltaO += scaledImpact
    }
  }
  S_q += rosterDeltaQ
  S_o += rosterDeltaO
  attributions['roster_moves'] = rosterDeltaQ + rosterDeltaO

  // 4. Post-offseason sentiment → combined (updates both S_q and S_o with same K).
  //    One V update regardless (information reduces total uncertainty).
  if (transition.sentimentPost) {
    const sent = transition.sentimentPost
    const composite = (
      sent.beatReporter * 0.35 +
      sent.nationalMedia * 0.30 +
      sent.fanSentiment * 0.20 +
      sent.overall * 0.15
    )
    // z for each component = component + nudge (small: sentiment is leading, not confirming)
    const nudge = composite * 0.12
    const z_q = S_q + nudge
    const z_o = S_o + nudge
    const R = 0.80 + sent.dispersion * 0.50
    const K = V / (V + R)
    const Sq_before = S_q
    const So_before = S_o
    S_q = S_q + K * (z_q - S_q)  // = S_q + K * nudge
    S_o = S_o + K * (z_o - S_o)  // = S_o + K * nudge
    V = Math.max(0.001, (1 - K) * V)
    attributions['sentiment_narrative'] = (S_q - Sq_before) + (S_o - So_before)
  }

  // 5. Enforce minimum V (regime change = uncertainty floor).
  const V_floor = transition.coachingChange ? 0.355 : 0.18
  V = Math.max(V_floor, V)

  return { S_q, S_o, V, attributions }
}
