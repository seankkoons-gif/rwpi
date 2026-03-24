import type { GameResult, InjuryReport, SentimentSnapshot } from '../../shared/src/types.ts'

// NY Giants 2025 Regular Season — 17 games, final record 4-13
// Totals: 381 points scored / 439 points allowed / -58 point differential
// 4th place NFC East. Head coach: Brian Daboll (fired Jan 2026).
// Source: seeded realistic approximation for RWP Oracle demo.

const SEASON_START_2025 = new Date('2025-09-05T18:00:00Z').getTime()
const WEEK_MS = 7 * 24 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

function weekTs(week: number, dayOffset = 0): number {
  return SEASON_START_2025 + (week - 1) * WEEK_MS + dayOffset * DAY_MS
}

export const GIANTS_2025_GAMES: GameResult[] = [
  {
    week: 1, season: 2025, opponent: 'Philadelphia Eagles',
    home: false, pointsScored: 10, pointsAllowed: 34, win: false, margin: -24,
    offensiveYards: 215, defensiveYards: 395, turnovers: 2, sacks: 1,
    thirdDownPct: 0.22, redZonePct: 0.20, timeOfPossession: 22.5,
    penaltyYards: 65, specialTeamsScore: -2,
    kickingFGPct: 0.50, returnYards: 58, explosivePlays: 1,
    opponentStrength: 0.50, restDays: 7, primetime: true,
  },
  {
    week: 2, season: 2025, opponent: 'Dallas Cowboys',
    home: true, pointsScored: 23, pointsAllowed: 28, win: false, margin: -5,
    offensiveYards: 285, defensiveYards: 308, turnovers: 0, sacks: 3,
    thirdDownPct: 0.40, redZonePct: 0.50, timeOfPossession: 29.8,
    penaltyYards: 45, specialTeamsScore: 1,
    kickingFGPct: 1.00, returnYards: 88, explosivePlays: 3,
    opponentStrength: 0.28, restDays: 7, primetime: false,
  },
  {
    week: 3, season: 2025, opponent: 'Washington Commanders',
    home: true, pointsScored: 20, pointsAllowed: 27, win: false, margin: -7,
    offensiveYards: 265, defensiveYards: 330, turnovers: 1, sacks: 2,
    thirdDownPct: 0.35, redZonePct: 0.50, timeOfPossession: 28.2,
    penaltyYards: 50, specialTeamsScore: 0,
    kickingFGPct: 0.67, returnYards: 78, explosivePlays: 2,
    opponentStrength: 0.18, restDays: 7, primetime: false,
  },
  {
    week: 4, season: 2025, opponent: 'Chicago Bears',
    home: true, pointsScored: 27, pointsAllowed: 31, win: false, margin: -4,
    offensiveYards: 310, defensiveYards: 320, turnovers: 1, sacks: 3,
    thirdDownPct: 0.42, redZonePct: 0.60, timeOfPossession: 30.5,
    penaltyYards: 40, specialTeamsScore: 1,
    kickingFGPct: 0.75, returnYards: 92, explosivePlays: 4,
    opponentStrength: 0.00, restDays: 7, primetime: false,
  },
  {
    week: 5, season: 2025, opponent: 'Carolina Panthers',
    home: true, pointsScored: 38, pointsAllowed: 14, win: true, margin: 24,
    offensiveYards: 425, defensiveYards: 195, turnovers: -2, sacks: 5,
    thirdDownPct: 0.62, redZonePct: 1.00, timeOfPossession: 36.8,
    penaltyYards: 25, specialTeamsScore: 4,
    kickingFGPct: 1.00, returnYards: 148, explosivePlays: 8,
    opponentStrength: -0.40, restDays: 7, primetime: false,
  },
  {
    week: 6, season: 2025, opponent: 'Miami Dolphins',
    home: false, pointsScored: 24, pointsAllowed: 31, win: false, margin: -7,
    offensiveYards: 298, defensiveYards: 345, turnovers: 1, sacks: 2,
    thirdDownPct: 0.38, redZonePct: 0.50, timeOfPossession: 28.0,
    penaltyYards: 55, specialTeamsScore: -1,
    kickingFGPct: 0.67, returnYards: 82, explosivePlays: 3,
    opponentStrength: 0.12, restDays: 7, primetime: false,
  },
  {
    week: 7, season: 2025, opponent: 'Dallas Cowboys',
    home: false, pointsScored: 17, pointsAllowed: 28, win: false, margin: -11,
    offensiveYards: 255, defensiveYards: 335, turnovers: 2, sacks: 2,
    thirdDownPct: 0.33, redZonePct: 0.40, timeOfPossession: 26.2,
    penaltyYards: 60, specialTeamsScore: -1,
    kickingFGPct: 0.50, returnYards: 72, explosivePlays: 2,
    opponentStrength: 0.28, restDays: 7, primetime: false,
  },
  {
    week: 8, season: 2025, opponent: 'New England Patriots',
    home: true, pointsScored: 31, pointsAllowed: 10, win: true, margin: 21,
    offensiveYards: 388, defensiveYards: 198, turnovers: -2, sacks: 4,
    thirdDownPct: 0.58, redZonePct: 0.88, timeOfPossession: 34.5,
    penaltyYards: 30, specialTeamsScore: 3,
    kickingFGPct: 1.00, returnYards: 132, explosivePlays: 7,
    opponentStrength: -0.32, restDays: 7, primetime: false,
  },
  {
    week: 9, season: 2025, opponent: 'New Orleans Saints',
    home: false, pointsScored: 14, pointsAllowed: 21, win: false, margin: -7,
    offensiveYards: 248, defensiveYards: 295, turnovers: 1, sacks: 2,
    thirdDownPct: 0.32, redZonePct: 0.40, timeOfPossession: 27.0,
    penaltyYards: 50, specialTeamsScore: 0,
    kickingFGPct: 0.67, returnYards: 76, explosivePlays: 2,
    opponentStrength: 0.00, restDays: 7, primetime: false,
  },
  {
    week: 10, season: 2025, opponent: 'Washington Commanders',
    home: false, pointsScored: 20, pointsAllowed: 28, win: false, margin: -8,
    offensiveYards: 268, defensiveYards: 315, turnovers: 1, sacks: 3,
    thirdDownPct: 0.38, redZonePct: 0.50, timeOfPossession: 28.5,
    penaltyYards: 55, specialTeamsScore: -1,
    kickingFGPct: 0.67, returnYards: 80, explosivePlays: 2,
    opponentStrength: 0.18, restDays: 7, primetime: false,
  },
  {
    week: 11, season: 2025, opponent: 'Cleveland Browns',
    home: true, pointsScored: 34, pointsAllowed: 17, win: true, margin: 17,
    offensiveYards: 368, defensiveYards: 225, turnovers: -1, sacks: 4,
    thirdDownPct: 0.55, redZonePct: 0.80, timeOfPossession: 33.8,
    penaltyYards: 35, specialTeamsScore: 2,
    kickingFGPct: 1.00, returnYards: 118, explosivePlays: 6,
    opponentStrength: -0.12, restDays: 7, primetime: false,
  },
  {
    week: 12, season: 2025, opponent: 'Philadelphia Eagles',
    home: false, pointsScored: 7, pointsAllowed: 34, win: false, margin: -27,
    offensiveYards: 195, defensiveYards: 415, turnovers: 3, sacks: 1,
    thirdDownPct: 0.18, redZonePct: 0.20, timeOfPossession: 21.0,
    penaltyYards: 75, specialTeamsScore: -3,
    kickingFGPct: 0.00, returnYards: 52, explosivePlays: 1,
    opponentStrength: 0.50, restDays: 7, primetime: true,
  },
  {
    week: 13, season: 2025, opponent: 'Pittsburgh Steelers',
    home: true, pointsScored: 20, pointsAllowed: 24, win: false, margin: -4,
    offensiveYards: 278, defensiveYards: 298, turnovers: 1, sacks: 3,
    thirdDownPct: 0.40, redZonePct: 0.50, timeOfPossession: 29.5,
    penaltyYards: 45, specialTeamsScore: 0,
    kickingFGPct: 0.75, returnYards: 85, explosivePlays: 3,
    opponentStrength: 0.25, restDays: 7, primetime: false,
  },
  {
    week: 14, season: 2025, opponent: 'Atlanta Falcons',
    home: false, pointsScored: 21, pointsAllowed: 28, win: false, margin: -7,
    offensiveYards: 265, defensiveYards: 310, turnovers: 1, sacks: 2,
    thirdDownPct: 0.36, redZonePct: 0.50, timeOfPossession: 27.8,
    penaltyYards: 50, specialTeamsScore: -1,
    kickingFGPct: 0.67, returnYards: 78, explosivePlays: 2,
    opponentStrength: 0.10, restDays: 7, primetime: false,
  },
  {
    week: 15, season: 2025, opponent: 'Tampa Bay Buccaneers',
    home: true, pointsScored: 21, pointsAllowed: 28, win: false, margin: -7,
    offensiveYards: 272, defensiveYards: 318, turnovers: 1, sacks: 2,
    thirdDownPct: 0.37, redZonePct: 0.50, timeOfPossession: 28.0,
    penaltyYards: 45, specialTeamsScore: 0,
    kickingFGPct: 0.75, returnYards: 82, explosivePlays: 2,
    opponentStrength: -0.02, restDays: 7, primetime: false,
  },
  {
    week: 16, season: 2025, opponent: 'Baltimore Ravens',
    home: false, pointsScored: 18, pointsAllowed: 35, win: false, margin: -17,
    offensiveYards: 248, defensiveYards: 395, turnovers: 2, sacks: 1,
    thirdDownPct: 0.28, redZonePct: 0.33, timeOfPossession: 24.5,
    penaltyYards: 70, specialTeamsScore: -2,
    kickingFGPct: 0.67, returnYards: 65, explosivePlays: 2,
    opponentStrength: 0.45, restDays: 7, primetime: true,
  },
  {
    week: 17, season: 2025, opponent: 'Arizona Cardinals',
    home: true, pointsScored: 36, pointsAllowed: 21, win: true, margin: 15,
    offensiveYards: 388, defensiveYards: 248, turnovers: -1, sacks: 4,
    thirdDownPct: 0.57, redZonePct: 0.83, timeOfPossession: 34.2,
    penaltyYards: 30, specialTeamsScore: 3,
    kickingFGPct: 1.00, returnYards: 125, explosivePlays: 6,
    opponentStrength: -0.28, restDays: 7, primetime: false,
  },
]

// Season totals check: 381 scored, 439 allowed, 4-13 ✓

// ─── 2025 Injury reports ───────────────────────────────────────────────────────
export const GIANTS_2025_INJURIES: InjuryReport[] = [
  {
    // Tommy DeVito — starting QB, limited arm talent, chronic pressure issues
    playerId: 'tdevito-1',
    playerName: 'Tommy DeVito',
    position: 'QB',
    status: 'questionable',
    impactWeight: 0.70,
    timestamp: weekTs(4, 3),
  },
  {
    // Starting C injured — OL depth paper-thin
    playerId: 'john-michael-schmitz',
    playerName: 'John Michael Schmitz',
    position: 'C',
    status: 'out',
    impactWeight: 0.45,
    timestamp: weekTs(9, 2),
  },
  {
    // Dexter Lawrence — interior DL anchor, IR'd late season
    playerId: 'dexter-lawrence',
    playerName: 'Dexter Lawrence II',
    position: 'DT',
    status: 'out',
    impactWeight: 0.60,
    timestamp: weekTs(14, 3),
  },
]

// ─── 2025 Sentiment snapshots ──────────────────────────────────────────────────
export const GIANTS_2025_SENTIMENT: SentimentSnapshot[] = [
  {
    // Pre-season: cautious pessimism, 4th-year of Daboll rebuild
    overall: -0.15, momentum: -0.10, dispersion: 0.35, mediaVolume: 0.45,
    beatReporter: -0.20, nationalMedia: -0.10, fanSentiment: -0.15, headlineShock: false,
    timestamp: weekTs(1),
  },
  {
    // After Week 5 win (Panthers): brief optimism before reality check
    overall: 0.15, momentum: 0.30, dispersion: 0.30, mediaVolume: 0.55,
    beatReporter: 0.20, nationalMedia: 0.10, fanSentiment: 0.20, headlineShock: false,
    timestamp: weekTs(5, 1),
  },
  {
    // After Week 12 Eagles blowout: fan revolt, calls for Daboll firing
    overall: -0.75, momentum: -0.65, dispersion: 0.20, mediaVolume: 1.00,
    beatReporter: -0.80, nationalMedia: -0.70, fanSentiment: -0.80, headlineShock: true,
    timestamp: weekTs(12, 1),
  },
  {
    // End of season: acceptance, looking to offseason regime change
    overall: -0.30, momentum: 0.10, dispersion: 0.50, mediaVolume: 0.60,
    beatReporter: -0.35, nationalMedia: -0.25, fanSentiment: -0.30, headlineShock: false,
    timestamp: weekTs(17, 1),
  },
]

// ─── 2025 Market odds snapshots ───────────────────────────────────────────────
export const GIANTS_2025_ODDS: Array<{ impliedWinProb: number; timestamp: number }> = [
  { impliedWinProb: 0.38, timestamp: weekTs(1) },     // Moderate underdog entering season
  { impliedWinProb: 0.44, timestamp: weekTs(5) },     // Brief uptick after Panthers win
  { impliedWinProb: 0.30, timestamp: weekTs(10) },    // Sinking with record
  { impliedWinProb: 0.22, timestamp: weekTs(15) },    // Near-lock for top-5 pick
]

// ─── March 2026 Offseason transition ──────────────────────────────────────────
// Key events that affect S from end of 2025 season through March 24, 2026:

export const MARCH_2026_TRANSITION = {
  // John Harbaugh hired as Giants HC (announced January 14, 2026)
  // Fired from Baltimore after 17 years. One SB win (2012). Elite HC credentials.
  coachingChange: {
    fromCoach: 'Brian Daboll',
    toCoach: 'John Harbaugh',
    // qualitySignal represents the expected latent improvement from the HC change.
    // Harbaugh is elite (SB ring, 17 yrs Ravens) but roster is still 4-13 caliber.
    // Signal is muted: HC cannot overcome roster in year 1. Upside is FUTURE optionality.
    qualitySignal: 0.18,
    confidence: 0.68,         // Future success genuinely uncertain in new environment
    varianceAddition: 0.16,   // Regime change = meaningful additional uncertainty
  },

  rosterMoves: [
    // Jason Sanders — K signed Feb 2026; one of NFL's most accurate kickers
    // Addresses a chronic special teams weakness. Concrete, reliable improvement.
    { player: 'Jason Sanders', role: 'K', impact: +0.10, confidence: 0.82 },
    // OL reinforcement — signed veteran OL in free agency
    { player: 'FA OL additions', role: 'OL', impact: +0.05, confidence: 0.64 },
    // CB depth addition — modest upgrade
    { player: 'FA CB addition', role: 'CB', impact: +0.03, confidence: 0.60 },
    // Cut/released aging LB — cap relief, modest depth loss
    { player: 'Veteran LB cap cut', role: 'LB', impact: -0.02, confidence: 0.82 },
  ],

  // Post-Harbaugh hire sentiment: cautious optimism, but national media skeptical of roster
  // Fans are energized but beat reporters note the rebuild reality
  sentimentPost: {
    overall: 0.15,
    beatReporter: 0.25,
    nationalMedia: 0.08,
    fanSentiment: 0.20,
    headlineShock: true,   // Harbaugh hire was a surprise
    dispersion: 0.52,      // Wide disagreement: excitement vs rebuild skepticism
  },

  daysFromSeasonEndToMar24: 81,  // Jan 2, 2026 → March 24, 2026
}
