export interface TeamState {
  teamId: string
  teamName: string
  S: number
  V: number
  U: number
  timestamp: number
  seasonPhase: SeasonPhase
}

export type SeasonPhase = 'preseason' | 'regular' | 'postseason' | 'offseason'

export interface OraclePrice {
  fairPrice: number
  markPrice: number
  launchPrice: number
  priceChangeFromLaunch: number
  timestamp: number
  confidenceBand: { low: number; high: number }
}

export type ObservationSource =
  | 'game_result'
  | 'efficiency'
  | 'injury_shock'
  | 'roster_change'
  | 'sentiment'
  | 'market_odds'
  | 'coaching_change'
  | 'postseason'
  | 'offseason_move'
  | 'preseason_signal'
  | 'schedule_adjustment'
  | 'attention'
  | 'projection_signal'

// ─── Projection types ────────────────────────────────────────────────────────

/** Source of a forward-looking projection. */
export type ProjectionSourceKind =
  | 'analytics'           // DVOA / EPA-based model forecast
  | 'market_consensus'    // Vegas season win total
  | 'coaching_trajectory' // Historical HC improvement curves
  | 'roster_rating'       // PFF/relative roster grade
  | 'draft_capital'       // Pick quality + projected positional improvement
  | 'schedule_strength'   // SOS projection (adjusted for expected opponent strength)

export interface ProjectionReport {
  kind: ProjectionSourceKind
  /** Projected season win total (e.g. 7.5). Converted to latent S internally. */
  projectedWins?: number
  /** Direct latent-strength estimate, bypasses win conversion if provided. */
  projectedS?: number
  /** How confident this projection source is (0–1). */
  confidence: number
  /** Days into the future this projection covers (used to set recencyWeight). */
  horizonDays: number
  timestamp: number
  provenance: string
}

export interface Observation {
  id: string
  source: ObservationSource
  observedStrength: number
  confidence: number
  noiseVariance: number
  recencyWeight: number
  directionality: 1 | -1 | 0
  decayWindowDays: number
  timestamp: number
  metadata: Record<string, unknown>
  provenance?: string
  /** Which latent-state component this observation updates. */
  component: 'current_quality' | 'forward_optionality' | 'combined'
}

/** Three-component latent state (S_q + λ×S_o + V). */
export interface ThreeComponentState {
  currentQuality: number      // S_q: on-field proven performance
  forwardOptionality: number  // S_o: unproven future upside
  combinedS: number           // S_q + λ × S_o
  variance: number            // V (shared)
  uncertainty: number         // sqrt(V)
}

export interface MarketState {
  longOI: number
  shortOI: number
  totalOI: number
  netImbalance: number
  fundingRate: number
  fundingRateHourly: number
  leverageCap: number
  maintenanceMarginRate: number
  riskRegime: RiskRegime
  lastUpdated: number
}

export type RiskRegime = 'calm' | 'elevated' | 'stressed' | 'crisis'

export interface Position {
  id: string
  side: 'long' | 'short'
  entryPrice: number
  leverage: number
  collateral: number
  size: number
  timestamp: number
}

export interface LiquidationCheck {
  position: Position
  currentMarkPrice: number
  unrealizedPnl: number
  marginRatio: number
  liquidationPrice: number
  isLiquidatable: boolean
  maintenanceMarginRequired: number
  dynamicBuffer: number
}

export interface FundingComponents {
  baseRate: number
  imbalanceComponent: number
  uncertaintyComponent: number
  basisComponent: number
  total: number
}

export interface GameResult {
  week: number
  season: number
  opponent: string
  home: boolean
  pointsScored: number
  pointsAllowed: number
  win: boolean
  margin: number
  offensiveYards: number
  defensiveYards: number
  turnovers: number
  sacks: number
  thirdDownPct: number
  redZonePct: number
  timeOfPossession: number
  penaltyYards: number
  specialTeamsScore: number
  kickingFGPct: number
  returnYards: number
  explosivePlays: number
  opponentStrength: number
  restDays: number
  weather?: string
  primetime: boolean
}

export interface InjuryReport {
  playerId: string
  playerName: string
  position: string
  status: 'out' | 'doubtful' | 'questionable' | 'probable'
  impactWeight: number
  timestamp: number
}

export interface SentimentSnapshot {
  overall: number
  momentum: number
  dispersion: number
  mediaVolume: number
  beatReporter: number
  nationalMedia: number
  fanSentiment: number
  headlineShock: boolean
  timestamp: number
}

export interface AttributionBreakdown {
  gamePerformance: number
  injuries: number
  sentiment: number
  marketOdds: number
  rosterCoaching: number
  postseason: number
  scheduleStrength: number
  specialTeams: number
  offseasonCarry: number
  projectionNudge: number         // forward-looking projection observations (weak signal)
  currentQualityDelta?: number    // total ΔS_q this period
  forwardOptionalityDelta?: number // total ΔS_o this period
  total: number
}

export interface StateSnapshot {
  timestamp: number
  S: number
  V: number
  U: number
  price: number
  markPrice: number
  fundingRate: number
  longOI: number
  shortOI: number
  seasonPhase: SeasonPhase
  event?: string
  week?: number
  attributions?: Partial<AttributionBreakdown>
  /** Three-component split state (present on the final offseason snapshot). */
  S_q?: number
  S_o?: number
}
