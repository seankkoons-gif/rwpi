/**
 * types.ts — Calibration types for the Prophet RWP Oracle
 *
 * Defines the parameter space, objective structure, and result types
 * used by the calibration search and benchmark pipeline.
 */

// ─── Calibration parameter space ─────────────────────────────────────────────

export interface CalibrationParams {
  // Noise variances (R in Kalman update) per observation type
  gameNoiseVariance: number          // 0.42 — primary signal source
  injuryNoiseVariance: number        // 0.55 — injury reports
  oddsNoiseVariance: number          // 0.20 — market odds (most precise)
  sentimentNoiseVariance: number     // 0.45 — social/media sentiment
  projectionNoiseVariance: number    // 0.80 — forward-looking projections

  // Game observation math params
  tanhSaturationPoint: number        // 28 — margin/(this) in tanh(); saturates around 2 TDs
  marginWeight: number               // 0.40 — coefficient on tanh(margin) in core signal
  efficiencyWeight: number           // 0.30 — coefficient on (3rd down + red zone) factors
  opponentScaleBase: number          // 0.50 — base of opponentScale = base + factor * oppStrength
  opponentScaleFactor: number        // 0.50 — scale factor multiplier on opponent strength
  garbageDampenThreshold: number     // 21 — margin (pts) at which garbage-time dampening kicks in
  garbageDampenFactor: number        // 0.75 — multiplier on garbage-time plays
  eliteLossMultiplierFactor: number  // 0.50 — penalty multiplier for losses to strong opponents
  winCeilingBase: number             // 0.42 — base win ceiling vs avg opponent
  winCeilingFactor: number           // 0.50 — slope of win ceiling vs opponent strength

  // Kalman process noise (state uncertainty growth per day)
  processNoise: number               // 0.005 — V += processNoise * daysSince

  // Offseason dynamics
  offseasonMeanReversion: number     // 0.0006 — daily mean reversion rate (S decay toward 0)

  // Price formula params
  alpha: number                      // 0.30 — S sensitivity in exp(alpha*S - 0.5*beta*V)
  beta: number                       // 0.40 — V penalty in price formula

  // Ornstein-Uhlenbeck drift (DEFERRED — leave disabled)
  ouEnabled: boolean                 // false
  ouTheta: number                    // 0.02 — OU mean-reversion rate

  // Funding rate params (for market engine)
  fundingBase: number                // 0.05 — annual base funding rate
  fundingImbalanceWeight: number     // 0.20 — OI imbalance contribution
  fundingUncertaintyWeight: number   // 0.10 — uncertainty contribution
  fundingBasisWeight: number         // 0.15 — mark/fair basis contribution
  fundingAsymmetricLongPenalty: number  // 0.0 — asymmetric penalty on longs (experiment)

  // Covariance smoothing experiment
  covSmoothingEnabled: boolean       // false — exponential decay after each game update
  covSmoothingHalfLifeHours: number  // 1.0 — half-life for covariance smoothing
}

export const DEFAULT_CALIBRATION_PARAMS: CalibrationParams = {
  gameNoiseVariance: 0.42,
  injuryNoiseVariance: 0.55,
  oddsNoiseVariance: 0.20,
  sentimentNoiseVariance: 0.45,
  projectionNoiseVariance: 0.80,
  tanhSaturationPoint: 28,
  marginWeight: 0.40,
  efficiencyWeight: 0.30,
  opponentScaleBase: 0.50,
  opponentScaleFactor: 0.50,
  garbageDampenThreshold: 21,
  garbageDampenFactor: 0.75,
  eliteLossMultiplierFactor: 0.50,
  winCeilingBase: 0.42,
  winCeilingFactor: 0.50,
  processNoise: 0.005,
  offseasonMeanReversion: 0.0006,
  alpha: 0.30,
  beta: 0.40,
  ouEnabled: false,
  ouTheta: 0.02,
  fundingBase: 0.05,
  fundingImbalanceWeight: 0.20,
  fundingUncertaintyWeight: 0.10,
  fundingBasisWeight: 0.15,
  fundingAsymmetricLongPenalty: 0.0,
  covSmoothingEnabled: false,
  covSmoothingHalfLifeHours: 1.0,
}

// ─── Calibration objective ────────────────────────────────────────────────────

export interface CalibrationObjective {
  weights: {
    logLoss: number
    calibrationError: number
    stabilityPenalty: number
    overreactionPenalty: number
    offseasonRealismPenalty: number
    paramSimplicityPenalty: number
  }
  overreactionThreshold: number   // 0.12 — |ΔS| above this is "overreaction"
  badTeamRecoveryMaxS: number     // -0.05 — a bad team (S < -0.20) after 90d silence must be ≤ this
}

export const DEFAULT_OBJECTIVE: CalibrationObjective = {
  weights: {
    logLoss: 1.0,
    calibrationError: 0.5,
    stabilityPenalty: 0.3,
    overreactionPenalty: 0.4,
    offseasonRealismPenalty: 0.3,
    paramSimplicityPenalty: 0.1,
  },
  overreactionThreshold: 0.12,
  badTeamRecoveryMaxS: -0.05,
}

// ─── Historical game format (for calibration dataset) ────────────────────────

export interface HistoricalGame {
  gameId: string
  season: number
  week: number
  homeTeamId: string
  awayTeamId: string
  homeScore: number
  awayScore: number
  homeWon: boolean
  margin: number          // homeScore - awayScore (signed)
  // Box-score (generated deterministically)
  homeThirdDownPct: number
  awayThirdDownPct: number
  homeRedZonePct: number
  awayRedZonePct: number
  homeSpecialTeams: number
  awaySpecialTeams: number
  homeTurnovers: number
  awayTurnovers: number
  homeSacks: number        // sacks inflicted by home team
  awaySacks: number
  isPrimetime: boolean
  isUpset: boolean
  // True strengths (for dataset validation, not used during calibration)
  homeTrueStrength: number
  awayTrueStrength: number
}

export interface TeamStrengthProfile {
  teamId: string
  teamName: string
  baseStrength: number                       // initial S
  seasonStrengths: Record<number, number>    // season → S
}

// ─── Replay result ────────────────────────────────────────────────────────────

export interface ReplayResult {
  gameId: string
  season: number
  week: number
  homeTeamId: string
  awayTeamId: string
  homeS_before: number
  homeV_before: number
  homeS_after: number
  homeV_after: number
  awayS_before: number
  awayV_before: number
  awayS_after: number
  awayV_after: number
  predictedHomeWinProb: number
  homeWon: boolean
  homeDeltaS: number
  awayDeltaS: number
}

// ─── Giants calibration report ────────────────────────────────────────────────

export interface GiantsCalibrationReport {
  season2025FinalS: number
  mar24Price: number
  mar24S: number
  bigWeakWinMaxDeltaS: number        // max ΔS for a blowout win vs weak opponent
  eliteBlowoutLossDeltaS: number     // ΔS for a blowout loss to elite opponent
  harbaughPriceImpact: number        // price impact of Harbaugh hire
  offseasonVAfter90Days: number      // V after 90 days of silence
  verdict: {
    weakWinBounded: boolean          // weak win capped < 0.13
    eliteLossMeaningful: boolean     // elite loss at least -0.03
    harbaughImpactBounded: boolean   // Harbaugh price impact in [-5, +5]
    offseasonUncertaintyReal: boolean // V after 90 days > 0.10
  }
}

// ─── Full calibration run result ──────────────────────────────────────────────

export interface CalibrationRunResult {
  runId: string
  params: CalibrationParams
  scores: {
    total: number
    logLoss: number
    calibrationError: number
    stabilityPenalty: number
    overreactionPenalty: number
    offseasonRealismPenalty: number
    paramSimplicityPenalty: number
  }
  eloBenchmark: {
    logLoss: number
    brierScore: number
    vsRWPI: 'RWPI_WINS' | 'ELO_WINS' | 'TIED'
  }
  giantsReport: GiantsCalibrationReport
  timestamp: number
}

// ─── NFL team metadata ────────────────────────────────────────────────────────

export interface NFLTeam {
  teamId: string
  teamName: string
  abbreviation: string
  conference: 'AFC' | 'NFC'
  division: string   // e.g. 'AFC East'
}

export const NFL_TEAMS_2025: NFLTeam[] = [
  // AFC East
  { teamId: 'buf', teamName: 'Buffalo Bills',       abbreviation: 'BUF', conference: 'AFC', division: 'AFC East' },
  { teamId: 'mia', teamName: 'Miami Dolphins',      abbreviation: 'MIA', conference: 'AFC', division: 'AFC East' },
  { teamId: 'ne',  teamName: 'New England Patriots',abbreviation: 'NE',  conference: 'AFC', division: 'AFC East' },
  { teamId: 'nyj', teamName: 'New York Jets',       abbreviation: 'NYJ', conference: 'AFC', division: 'AFC East' },
  // AFC North
  { teamId: 'bal', teamName: 'Baltimore Ravens',    abbreviation: 'BAL', conference: 'AFC', division: 'AFC North' },
  { teamId: 'cin', teamName: 'Cincinnati Bengals',  abbreviation: 'CIN', conference: 'AFC', division: 'AFC North' },
  { teamId: 'cle', teamName: 'Cleveland Browns',    abbreviation: 'CLE', conference: 'AFC', division: 'AFC North' },
  { teamId: 'pit', teamName: 'Pittsburgh Steelers', abbreviation: 'PIT', conference: 'AFC', division: 'AFC North' },
  // AFC South
  { teamId: 'hou', teamName: 'Houston Texans',      abbreviation: 'HOU', conference: 'AFC', division: 'AFC South' },
  { teamId: 'ind', teamName: 'Indianapolis Colts',  abbreviation: 'IND', conference: 'AFC', division: 'AFC South' },
  { teamId: 'jax', teamName: 'Jacksonville Jaguars',abbreviation: 'JAX', conference: 'AFC', division: 'AFC South' },
  { teamId: 'ten', teamName: 'Tennessee Titans',    abbreviation: 'TEN', conference: 'AFC', division: 'AFC South' },
  // AFC West
  { teamId: 'den', teamName: 'Denver Broncos',      abbreviation: 'DEN', conference: 'AFC', division: 'AFC West' },
  { teamId: 'kc',  teamName: 'Kansas City Chiefs',  abbreviation: 'KC',  conference: 'AFC', division: 'AFC West' },
  { teamId: 'lv',  teamName: 'Las Vegas Raiders',   abbreviation: 'LV',  conference: 'AFC', division: 'AFC West' },
  { teamId: 'lac', teamName: 'Los Angeles Chargers',abbreviation: 'LAC', conference: 'AFC', division: 'AFC West' },
  // NFC East
  { teamId: 'dal', teamName: 'Dallas Cowboys',      abbreviation: 'DAL', conference: 'NFC', division: 'NFC East' },
  { teamId: 'nyg', teamName: 'New York Giants',     abbreviation: 'NYG', conference: 'NFC', division: 'NFC East' },
  { teamId: 'phi', teamName: 'Philadelphia Eagles', abbreviation: 'PHI', conference: 'NFC', division: 'NFC East' },
  { teamId: 'was', teamName: 'Washington Commanders',abbreviation: 'WAS',conference: 'NFC', division: 'NFC East' },
  // NFC North
  { teamId: 'chi', teamName: 'Chicago Bears',       abbreviation: 'CHI', conference: 'NFC', division: 'NFC North' },
  { teamId: 'det', teamName: 'Detroit Lions',       abbreviation: 'DET', conference: 'NFC', division: 'NFC North' },
  { teamId: 'gb',  teamName: 'Green Bay Packers',   abbreviation: 'GB',  conference: 'NFC', division: 'NFC North' },
  { teamId: 'min', teamName: 'Minnesota Vikings',   abbreviation: 'MIN', conference: 'NFC', division: 'NFC North' },
  // NFC South
  { teamId: 'atl', teamName: 'Atlanta Falcons',     abbreviation: 'ATL', conference: 'NFC', division: 'NFC South' },
  { teamId: 'car', teamName: 'Carolina Panthers',   abbreviation: 'CAR', conference: 'NFC', division: 'NFC South' },
  { teamId: 'no',  teamName: 'New Orleans Saints',  abbreviation: 'NO',  conference: 'NFC', division: 'NFC South' },
  { teamId: 'tb',  teamName: 'Tampa Bay Buccaneers',abbreviation: 'TB',  conference: 'NFC', division: 'NFC South' },
  // NFC West
  { teamId: 'ari', teamName: 'Arizona Cardinals',   abbreviation: 'ARI', conference: 'NFC', division: 'NFC West' },
  { teamId: 'lar', teamName: 'Los Angeles Rams',    abbreviation: 'LAR', conference: 'NFC', division: 'NFC West' },
  { teamId: 'sf',  teamName: 'San Francisco 49ers', abbreviation: 'SF',  conference: 'NFC', division: 'NFC West' },
  { teamId: 'sea', teamName: 'Seattle Seahawks',    abbreviation: 'SEA', conference: 'NFC', division: 'NFC West' },
]
