import type {
  Position,
  LiquidationCheck,
  FundingComponents,
  MarketState,
  RiskRegime,
} from '../../shared/src/types.ts'

export interface RegimeConfig {
  regime: RiskRegime
  leverageCap: number
  mmRate: number
}

/**
 * calcRiskRegime
 * Maps uncertainty U to a risk regime with associated leverage caps and margin requirements.
 * U < 0.4 → calm:    20x leverage, 2.5% mm
 * U < 0.7 → elevated: 10x leverage, 4.0% mm
 * U < 1.0 → stressed: 5x leverage,  6.5% mm
 * U >= 1.0 → crisis:  2x leverage, 10.0% mm
 */
export function calcRiskRegime(U: number): RegimeConfig {
  if (U < 0.4) return { regime: 'calm', leverageCap: 20, mmRate: 0.025 }
  if (U < 0.7) return { regime: 'elevated', leverageCap: 10, mmRate: 0.04 }
  if (U < 1.0) return { regime: 'stressed', leverageCap: 5, mmRate: 0.065 }
  return { regime: 'crisis', leverageCap: 2, mmRate: 0.10 }
}

/**
 * calcFunding
 * Computes 4-component funding rate (annualized):
 *
 *   r_base = 0.05 (5% baseline, compensates liquidity providers)
 *
 *   r_imbalance = 0.20 * (longOI - shortOI) / max(totalOI, 1)
 *     (positive → longs pay shorts, negative → shorts pay longs)
 *
 *   r_uncertainty = 0.10 * U
 *     (higher uncertainty → higher carry cost for both sides)
 *
 *   r_basis = 0.15 * (markPrice - fairPrice) / fairPrice
 *     (convergence force: if mark > fair, longs pay extra)
 *
 *   r_total = clamp(r_base + r_imbalance + r_uncertainty + r_basis, -0.60, +0.60)
 */
export function calcFunding(
  longOI: number,
  shortOI: number,
  U: number,
  markPrice: number,
  fairPrice: number,
): FundingComponents {
  const totalOI = longOI + shortOI
  const baseRate = 0.05
  const imbalanceComponent = totalOI > 0
    ? 0.20 * (longOI - shortOI) / totalOI
    : 0
  const uncertaintyComponent = 0.10 * U
  const basisComponent = fairPrice > 0
    ? 0.15 * (markPrice - fairPrice) / fairPrice
    : 0

  const raw = baseRate + imbalanceComponent + uncertaintyComponent + basisComponent
  const total = Math.max(-0.60, Math.min(0.60, raw))

  return { baseRate, imbalanceComponent, uncertaintyComponent, basisComponent, total }
}

/**
 * calcLiquidation
 * dynamicBuffer = mmRate * (1 + U * 0.5)
 * maintenanceMarginRequired = size * dynamicBuffer
 * For longs: liquidationPrice = entryPrice * (1 - (collateral - maintenanceRequired) / size)
 * For shorts: liquidationPrice = entryPrice * (1 + (collateral - maintenanceRequired) / size)
 * isLiquidatable when marginRatio < dynamicBuffer
 */
export function calcLiquidation(
  position: Position,
  markPrice: number,
  U: number,
): LiquidationCheck {
  const { regime, mmRate } = calcRiskRegime(U)
  const dynamicBuffer = mmRate * (1 + U * 0.5)
  const maintenanceMarginRequired = position.size * dynamicBuffer

  let unrealizedPnl: number
  let liquidationPrice: number

  if (position.side === 'long') {
    unrealizedPnl = (markPrice - position.entryPrice) * (position.size / position.entryPrice)
    liquidationPrice = position.entryPrice * (1 - (position.collateral - maintenanceMarginRequired) / position.size)
  } else {
    unrealizedPnl = (position.entryPrice - markPrice) * (position.size / position.entryPrice)
    liquidationPrice = position.entryPrice * (1 + (position.collateral - maintenanceMarginRequired) / position.size)
  }

  const equity = position.collateral + unrealizedPnl
  const marginRatio = equity / position.size

  return {
    position,
    currentMarkPrice: markPrice,
    unrealizedPnl,
    marginRatio,
    liquidationPrice,
    isLiquidatable: marginRatio < dynamicBuffer,
    maintenanceMarginRequired,
    dynamicBuffer,
  }
}

/**
 * buildMarketState
 * Assembles the full MarketState from components.
 */
export function buildMarketState(
  longOI: number,
  shortOI: number,
  U: number,
  markPrice: number,
  fairPrice: number,
): MarketState {
  const totalOI = longOI + shortOI
  const netImbalance = totalOI > 0 ? (longOI - shortOI) / totalOI : 0
  const { regime, leverageCap, mmRate } = calcRiskRegime(U)
  const funding = calcFunding(longOI, shortOI, U, markPrice, fairPrice)

  return {
    longOI,
    shortOI,
    totalOI,
    netImbalance,
    fundingRate: funding.total,
    fundingRateHourly: funding.total / 8760,
    leverageCap,
    maintenanceMarginRate: mmRate,
    riskRegime: regime,
    lastUpdated: Date.now(),
  }
}
