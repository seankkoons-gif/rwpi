/**
 * risk-engine.ts
 *
 * Risk application layer for the Prophet RWP Oracle.
 * Wraps market-engine.ts with V_risk-aware calculations.
 *
 * This module is the ONLY place in the system that translates
 * oracle belief state (V_model) into user-facing risk metrics.
 * All market-facing functions here accept both V_model and V_risk
 * so callers can pass the appropriate variance for the context.
 *
 * ─── What uses V_risk vs V_model ──────────────────────────────
 *
 * V_risk (smoothed):
 *   - Maintenance margin rate
 *   - Max leverage cap for existing positions
 *   - Dynamic liquidation buffer width
 *   - Funding rate uncertainty component (when fundingUseVRisk=true)
 *
 * V_model (immediate):
 *   - Fair price calculation
 *   - Confidence bands
 *   - Kalman gain for future updates
 *   - New position max leverage (under 'strict' policy)
 *
 * ─── Usage ────────────────────────────────────────────────────
 *
 * In production:
 *   const smoother = new CovarianceSmoother(V_initial, DEFAULT_SMOOTHING_CONFIG)
 *   // After Kalman update:
 *   smoother.onModelUpdate(V_model_new, Date.now())
 *   // For liquidation check on EXISTING position:
 *   const V_eff = smoother.getVRisk()
 *   const check = riskLiquidationCheck(position, markPrice, V_eff)
 *   // For NEW position opening:
 *   const V_new = smoother.getVRiskForNewPosition()
 *   const maxLev = riskGetMaxLeverage(V_new)
 */

import { calcRiskRegime, calcFunding, calcLiquidation, buildMarketState } from '../market-engine.ts'
import type { Position, LiquidationCheck, MarketState } from '../../../shared/src/types.ts'
import { advanceVRisk, getNewPositionV } from './covariance-smoother.ts'
import type { CovSmoothingConfig } from './covariance-smoother.ts'

export interface RiskSnapshot {
  /** Effective variance used for risk metrics. */
  V_eff: number
  /** Source of V_eff: 'smoothed' or 'immediate' */
  V_source: 'smoothed' | 'immediate'
  /** Uncertainty derived from V_eff. */
  U_eff: number
  /** Risk regime under V_eff. */
  regime: ReturnType<typeof calcRiskRegime>
  /** Maintenance margin rate. */
  mmRate: number
  /** Max leverage cap. */
  leverageCap: number
  /** Dynamic buffer (mmRate × (1 + U_eff × 0.5)). */
  dynamicBuffer: number
  /** Whether smoothing is active (V_risk ≠ V_model). */
  smoothingActive: boolean
  /** Minutes remaining until V_risk converges to V_model. */
  minutesToConverge?: number
}

/**
 * Compute a full risk snapshot for an oracle state, using V_risk for mechanics.
 */
export function getRiskSnapshot(
  V_model: number,
  V_risk: number,
  smoothingEnabled: boolean,
  minutesToConverge?: number,
): RiskSnapshot {
  const V_eff = smoothingEnabled ? V_risk : V_model
  const U_eff = Math.sqrt(V_eff)
  const regime = calcRiskRegime(U_eff)
  const dynamicBuffer = regime.mmRate * (1 + U_eff * 0.5)

  return {
    V_eff,
    V_source: smoothingEnabled ? 'smoothed' : 'immediate',
    U_eff,
    regime,
    mmRate: regime.mmRate,
    leverageCap: regime.leverageCap,
    dynamicBuffer,
    smoothingActive: smoothingEnabled && Math.abs(V_risk - V_model) > 0.001,
    minutesToConverge,
  }
}

/**
 * Compute a risk snapshot for a NEW position opening.
 * Under 'strict' policy: uses max(V_risk, V_model) to prevent gaming.
 */
export function getRiskSnapshotForNewPosition(
  V_model: number,
  V_risk: number,
  config: Pick<CovSmoothingConfig, 'enabled' | 'newPositionPolicy'>,
): RiskSnapshot {
  const V_eff = config.enabled
    ? getNewPositionV(V_risk, V_model, config.newPositionPolicy)
    : V_model
  return getRiskSnapshot(V_model, V_eff, false)  // V_eff already resolved
}

/**
 * Liquidation check using V_risk (existing position protection).
 */
export function riskLiquidationCheck(
  position: Position,
  markPrice: number,
  V_risk: number,
): LiquidationCheck {
  return calcLiquidation(position, markPrice, Math.sqrt(V_risk))
}

/**
 * Build market state using V_risk for risk regime/leverage.
 * When fundingUseVRisk=true, the funding rate uncertainty component
 * also uses U derived from V_risk (prevents sudden funding spikes at game settlement).
 * When false, funding uses V_model's U (more immediately responsive).
 */
export function riskBuildMarketState(
  longOI: number,
  shortOI: number,
  V_model: number,
  V_risk: number,
  markPrice: number,
  fairPrice: number,
  fundingUseVRisk: boolean,
): MarketState {
  // buildMarketState takes a single U; we call it twice and patch the funding rate
  const U_risk = Math.sqrt(V_risk)
  const state = buildMarketState(longOI, shortOI, U_risk, markPrice, fairPrice)

  if (!fundingUseVRisk) {
    // Recompute funding with V_model's U and splice it back in
    const U_model = Math.sqrt(V_model)
    const funding = calcFunding(longOI, shortOI, U_model, markPrice, fairPrice)
    const annualizedRate = Math.max(-0.60, Math.min(0.60,
      funding.baseRate + funding.imbalanceComponent + funding.uncertaintyComponent + funding.basisComponent
    ))
    return {
      ...state,
      fundingRate: annualizedRate,
      fundingRateHourly: annualizedRate / 8760,
    }
  }

  return state
}

// ─── Comparison utilities for benchmarking ──────────────────────────────────

export interface SmoothingComparison {
  scenario: string
  V_pre: number
  V_post: number  // V_model immediately after game
  /** Risk snapshots at t=0 (immediately after game). */
  instant: RiskSnapshot
  /** Risk snapshots with smoothing at t=0. */
  smooth_t0: RiskSnapshot
  /** At t=30min. */
  smooth_t30: RiskSnapshot
  /** At t=60min. */
  smooth_t60: RiskSnapshot
  /** At t=90min. */
  smooth_t90: RiskSnapshot
  /** Max leverage jump (instant): leverageCap_pre - leverageCap_post. */
  instantLeverageJump: number
  /** Max leverage jump (smooth at t=0): leverageCap_pre - leverageCap_smooth_t0. */
  smoothedLeverageJump: number
  /** Liq threshold jump (mm rate × entry price) for a hypothetical $100 entry. */
  instantMmJump: number
  smoothedMmJump: number
}

/**
 * Compare instant vs smoothed risk mechanics over a postgame scenario.
 * Used in the covariance smoothing harness and benchmark report.
 */
export function compareSmoothing(
  scenario: string,
  V_pre: number,
  V_post: number,
  tauMinutes: number = 90,
): SmoothingComparison {
  const U_pre = Math.sqrt(V_pre)
  const regime_pre = calcRiskRegime(U_pre)

  function snap(V: number, smoothingActive: boolean): RiskSnapshot {
    return getRiskSnapshot(V, V, smoothingActive)
  }

  const V_t30 = advanceVRisk(V_post, V_pre, 30, tauMinutes)
  const V_t60 = advanceVRisk(V_post, V_pre, 60, tauMinutes)
  const V_t90 = advanceVRisk(V_post, V_pre, 90, tauMinutes)

  const instant = snap(V_post, false)
  const smooth_t0 = snap(V_pre, true)   // at t=0, V_risk is still V_pre
  const smooth_t30 = snap(V_t30, true)
  const smooth_t60 = snap(V_t60, true)
  const smooth_t90 = snap(V_t90, true)

  return {
    scenario,
    V_pre,
    V_post,
    instant,
    smooth_t0,
    smooth_t30,
    smooth_t60,
    smooth_t90,
    instantLeverageJump: regime_pre.leverageCap - instant.leverageCap,
    smoothedLeverageJump: regime_pre.leverageCap - smooth_t0.leverageCap,
    instantMmJump: (instant.mmRate - regime_pre.mmRate) * 100,   // in pct pts
    smoothedMmJump: (smooth_t0.mmRate - regime_pre.mmRate) * 100,
  }
}
