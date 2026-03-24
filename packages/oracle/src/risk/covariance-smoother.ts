/**
 * covariance-smoother.ts
 *
 * Implements the two-variance-track risk layer for the Prophet RWP Oracle.
 *
 * Design principle (per system spec):
 *   The Kalman filter updates belief variance (V_model) immediately — that is
 *   mathematically correct. However, the risk engine (liquidation thresholds,
 *   leverage caps, maintenance margin) should NOT see instantaneous V compression.
 *   Postgame V collapse creates a "trap door" effect: positions that were safe under
 *   wide pregame buffers suddenly face tight buffers at exactly the moment holders
 *   are most exposed. That is bad market design even if the filter update is correct.
 *
 * Two variance tracks:
 *   V_model  — immediate Kalman posterior; truth about the belief state
 *   V_risk   — smoothed convergence toward V_model; used for ALL risk mechanics
 *
 * Smoothing formula (exponential decay toward target):
 *   V_risk(t) = V_model + (V_risk_prev - V_model) * exp(-Δt / τ)
 *
 *   τ (tau) is the smoothing time constant.
 *   Default: 90 minutes. Range tested: 60–120 minutes.
 *   At 3τ (270 min), V_risk is within ~5% of V_model — effectively converged.
 *
 * Abuse prevention (new position policy):
 *   New positions use max(V_risk, V_model) as effective variance.
 *   This prevents users from taking outsized exposure in the brief lag window
 *   after a volatility event while V_risk is still elevated.
 *   Existing positions use V_risk (protected from instant threshold cliffs).
 *
 * What V_risk governs:
 *   - Maintenance margin rate (via RegimeConfig.mmRate)
 *   - Max leverage cap (via RegimeConfig.leverageCap)
 *   - Dynamic liquidation buffer (liquidation price calculation)
 *   - Funding uncertainty component (optional — see fundingUseVRisk flag)
 *
 * What V_model governs (unaffected by smoothing):
 *   - Oracle belief state (S, V in oracle.ts)
 *   - Fair price calculation (P = P₀ × exp(αS − ½βV))
 *   - Kalman gain for future updates
 *   - Confidence bands in oracle price
 *
 * ─── Note on τ selection ───────────────────────────────────────────────────
 *   τ=60min: faster convergence, less cliff but shorter protection window
 *   τ=90min: ~3 hours to full convergence; covers typical halftime-to-final arc
 *   τ=120min: more conservative; may lag too long for injury/news events
 *   Default 90min recommended. Configurable per deployment.
 */

export interface CovSmoothingConfig {
  /** Whether smoothing is enabled. Default: true (production mode). */
  enabled: boolean
  /** Smoothing time constant in minutes. Default: 90. */
  tauMinutes: number
  /**
   * Policy for NEW position openings during the smoothing window.
   * 'strict': new positions use max(V_risk, V_model) — prevents abuse
   * 'smoothed': new positions use V_risk (more lenient, not recommended)
   */
  newPositionPolicy: 'strict' | 'smoothed'
  /**
   * Whether the funding rate uncertainty component also uses V_risk.
   * Default: true — smoothing the funding rate prevents sudden rate spikes
   * that could trigger stop-losses right after game settlement.
   */
  fundingUseVRisk: boolean
}

export const DEFAULT_SMOOTHING_CONFIG: CovSmoothingConfig = {
  enabled: true,
  tauMinutes: 90,
  newPositionPolicy: 'strict',
  fundingUseVRisk: true,
}

export const NO_SMOOTHING_CONFIG: CovSmoothingConfig = {
  enabled: false,
  tauMinutes: 0,
  newPositionPolicy: 'smoothed',
  fundingUseVRisk: false,
}

export interface SmoothingState {
  /** Current Kalman posterior variance (belief layer). */
  V_model: number
  /** Smoothed risk variance (risk application layer). */
  V_risk: number
  /** Timestamp of last model update (ms). */
  lastModelUpdateMs: number
  /** Whether we are currently in a smoothing window (V_risk != V_model). */
  inSmoothingWindow: boolean
  /** How many minutes until V_risk is within 1% of V_model. */
  minutesToConvergence: number
}

/**
 * CovarianceSmoother
 *
 * Maintains the two-variance-track state and computes V_risk at any point in time.
 * This is a stateful class — one instance per team/oracle in the live system.
 * For batch/replay use, use the stateless helper functions below instead.
 */
export class CovarianceSmoother {
  private V_model: number
  private V_risk: number
  private lastModelUpdateMs: number
  private readonly config: CovSmoothingConfig

  constructor(V_initial: number, config: CovSmoothingConfig = DEFAULT_SMOOTHING_CONFIG) {
    this.V_model = V_initial
    this.V_risk = V_initial
    this.lastModelUpdateMs = Date.now()
    this.config = config
  }

  /**
   * Called immediately when the Kalman filter produces a new V_model.
   * Advances V_risk to the current time using the OLD V_model target,
   * then locks in the new V_model target for future advancement.
   */
  onModelUpdate(V_model_new: number, nowMs: number = Date.now()): void {
    // Advance V_risk to NOW using current target BEFORE setting new target
    this.V_risk = this.advanceTo(nowMs)
    this.lastModelUpdateMs = nowMs
    this.V_model = V_model_new
  }

  /**
   * Get V_risk at a specific time. Non-mutating (does not advance internal state).
   */
  getVRisk(nowMs: number = Date.now()): number {
    if (!this.config.enabled) return this.V_model
    return this.advanceTo(nowMs)
  }

  /**
   * Get the effective variance for a NEW position opening.
   * Uses max(V_risk, V_model) under 'strict' policy to prevent abuse.
   */
  getVRiskForNewPosition(nowMs: number = Date.now()): number {
    const V_risk_now = this.getVRisk(nowMs)
    if (this.config.newPositionPolicy === 'strict') {
      return Math.max(V_risk_now, this.V_model)
    }
    return V_risk_now
  }

  /**
   * Get full smoothing state for monitoring/reporting.
   */
  getState(nowMs: number = Date.now()): SmoothingState {
    const V_risk_now = this.advanceTo(nowMs)
    const diff = Math.abs(V_risk_now - this.V_model)
    const converged = diff < 0.001
    // Solve for t when |V_risk(t) - V_model| < 0.01 * |V_risk_0 - V_model|
    const V_risk_0 = this.V_risk
    const initialDiff = Math.abs(V_risk_0 - this.V_model)
    const minutesToConvergence = initialDiff < 0.0001
      ? 0
      : Math.max(0, this.config.tauMinutes * Math.log(initialDiff / 0.001) / Math.LN10 * Math.LN10)

    return {
      V_model: this.V_model,
      V_risk: V_risk_now,
      lastModelUpdateMs: this.lastModelUpdateMs,
      inSmoothingWindow: !converged,
      minutesToConvergence,
    }
  }

  private advanceTo(nowMs: number): number {
    if (!this.config.enabled) return this.V_model
    const dtMs = Math.max(0, nowMs - this.lastModelUpdateMs)
    const tauMs = this.config.tauMinutes * 60 * 1000
    if (tauMs === 0) return this.V_model
    return this.V_model + (this.V_risk - this.V_model) * Math.exp(-dtMs / tauMs)
  }
}

// ─── Stateless helpers for replay/testing ────────────────────────────────────

/**
 * Advance V_risk toward V_model target over elapsed time.
 * Pure function — for use in calibration replay and harness tests.
 *
 * @param V_model   Current Kalman posterior (target for V_risk)
 * @param V_risk    Current smoothed risk variance
 * @param dtMinutes Elapsed time in minutes since last model update
 * @param tauMinutes Smoothing time constant
 * @returns Updated V_risk
 */
export function advanceVRisk(
  V_model: number,
  V_risk: number,
  dtMinutes: number,
  tauMinutes: number,
): number {
  if (tauMinutes <= 0) return V_model
  return V_model + (V_risk - V_model) * Math.exp(-dtMinutes / tauMinutes)
}

/**
 * Compute the effective V for a new position (abuse-prevention).
 * Under strict policy: max(V_risk, V_model).
 */
export function getNewPositionV(
  V_risk: number,
  V_model: number,
  policy: CovSmoothingConfig['newPositionPolicy'],
): number {
  return policy === 'strict' ? Math.max(V_risk, V_model) : V_risk
}

/**
 * Compute how many minutes until V_risk is within `tolerancePct` percent of V_model.
 * Used for reporting: "smoothing window closes in N minutes."
 */
export function minutesToConverge(
  V_model: number,
  V_risk_initial: number,
  tauMinutes: number,
  toleranceFraction: number = 0.01,
): number {
  const diff = Math.abs(V_risk_initial - V_model)
  if (diff < 1e-6) return 0
  const targetDiff = diff * toleranceFraction
  // diff * exp(-t/tau) = targetDiff  →  t = -tau * ln(targetDiff/diff)
  return Math.max(0, -tauMinutes * Math.log(toleranceFraction))
}

/**
 * Run a single postgame smoothing scenario for testing/reporting.
 * Returns V_risk at each time point (in minutes after game end).
 */
export function smoothingProfile(
  V_pre: number,
  V_post: number,
  tauMinutes: number,
  sampleMinutes: number[] = [0, 15, 30, 45, 60, 90, 120, 180, 240],
): Array<{ minutes: number; V_risk: number; pctToTarget: number }> {
  return sampleMinutes.map(t => {
    const V_risk = advanceVRisk(V_post, V_pre, t, tauMinutes)
    const totalRange = Math.abs(V_pre - V_post)
    const pctToTarget = totalRange < 1e-6 ? 100 : 100 * (1 - Math.abs(V_risk - V_post) / totalRange)
    return { minutes: t, V_risk: +V_risk.toFixed(5), pctToTarget: +pctToTarget.toFixed(1) }
  })
}
