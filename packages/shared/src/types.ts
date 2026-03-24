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
}
