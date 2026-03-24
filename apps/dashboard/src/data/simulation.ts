// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Prophet RWP Oracle — NY Giants, repriced to March 24, 2026
// Inline simulation (browser-compatible, no Node imports)
//
// Current state: OFFSEASON 2026 (post 2025 regular season)
// 2025 record: 4–13 | 381 pts scored / 439 pts allowed | -58 pt differential
// 4th place NFC East. Coach hired Jan 2026: John Harbaugh.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export type SeasonPhase = 'preseason' | 'regular' | 'postseason' | 'offseason'

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
  label: string
  attributions: Record<string, number>
}

export interface GameResult {
  week: number
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
  specialTeamsScore: number
  opponentStrength: number
  primetime: boolean
}

// ── Config ────────────────────────────────────────────────────────────────────
export const LAUNCH_CONFIG = {
  launchPrice: 100,
  launchS: -0.15,
  launchV: 0.6,
  alpha: 0.30,
  beta: 0.40,
  processNoise: 0.005,   // per day
  markBandPct: 0.08,
}

// Current state labels (for dashboard UI)
export const CURRENT_DATE_LABEL = 'March 24, 2026'
export const CURRENT_SEASON_LABEL = '2025 Season (4–13, 4th NFC East)'
export const CURRENT_HC = 'John Harbaugh (hired Jan 14, 2026)'
export const LAST_SEASON_RECORD = '4–13 | 381 PF / 439 PA | −58 PD | Missed Playoffs'

// ── Math helpers ─────────────────────────────────────────────────────────────
function calcFairPrice(S: number, V: number): number {
  const exponent = LAUNCH_CONFIG.alpha * S - 0.5 * LAUNCH_CONFIG.beta * V
  const raw = LAUNCH_CONFIG.launchPrice * Math.exp(exponent)
  return Math.max(LAUNCH_CONFIG.launchPrice * 0.05, Math.min(LAUNCH_CONFIG.launchPrice * 6.0, raw))
}

function calcMarkPrice(fair: number, lastMark: number | null): number {
  if (lastMark === null) return fair
  const band = fair * LAUNCH_CONFIG.markBandPct
  const proposed = lastMark + (fair - lastMark) * 0.3
  return Math.max(fair - band, Math.min(fair + band, proposed))
}

function kalmanUpdate(S: number, V: number, z: number, R: number): { S: number; V: number } {
  const gain = V / (V + R)
  return { S: S + gain * (z - S), V: Math.max(0.001, (1 - gain) * V) }
}

function calcFunding(longOI: number, shortOI: number, U: number, mark: number, fair: number): number {
  const total = longOI + shortOI
  const base = 0.05
  const imbalance = total > 0 ? 0.20 * (longOI - shortOI) / total : 0
  const uncertainty = 0.10 * U
  const basis = fair > 0 ? 0.15 * (mark - fair) / fair : 0
  return Math.max(-0.60, Math.min(0.60, base + imbalance + uncertainty + basis))
}

// ── Observation builders (updated: opponent-scaled, higher noise) ─────────────

function gameObs(g: GameResult) {
  const base = g.win ? 0.30 : -0.30
  const mf = Math.tanh(g.margin / 28)
  const eff = (g.thirdDownPct - 0.38) * 0.5 + (g.redZonePct - 0.55) * 0.3
  const sts = g.specialTeamsScore * 0.01
  const to = g.turnovers * -0.025
  const sk = g.sacks * 0.015
  // Opponent-scaled: beating a bad team counts less; losing to a good team counts more
  const oppScale = Math.max(0.25, 0.5 + 0.5 * g.opponentStrength)
  const core = base + 0.4 * mf + 0.3 * eff + sts
  const z = Math.max(-0.80, Math.min(0.80, core * oppScale + to + sk))
  const conf = Math.min(0.85, 0.60 + Math.abs(mf) * 0.10 + Math.abs(g.opponentStrength) * 0.05)
  // Higher noiseVariance → lower Kalman gain → S moves less per single game
  const nv = g.primetime ? 0.24 : 0.32
  const R = nv / conf
  return { z, R, source: 'game_result' as const }
}

function injObs(impactWeight: number, status: string) {
  const m: Record<string, number> = { out: 1.0, doubtful: 0.7, questionable: 0.4, probable: 0.1 }
  const mult = m[status] ?? 0.5
  const z = Math.max(-0.80, -(impactWeight * mult))
  const R = 0.15 / 0.85
  return { z, R, source: 'injury_shock' as const }
}

function sentObs(br: number, nm: number, fan: number, mom: number, shock: boolean, disp: number) {
  const comp = br * 0.35 + nm * 0.25 + fan * 0.20 + mom * 0.20
  const z = Math.max(-0.80, Math.min(0.80, comp * (shock ? 1.8 : 1.0) * 0.6))
  const conf = Math.max(0.30, 0.65 - disp * 0.30)
  const R = (0.25 + disp * 0.15) / conf
  return { z, R, source: 'sentiment' as const }
}

function oddsObs(prob: number) {
  const p = Math.max(0.05, Math.min(0.95, prob))
  const logit = Math.log(p / (1 - p))
  const z = Math.max(-1.0, Math.min(1.0, logit * 0.4))
  const R = 0.20 / 0.70
  return { z, R, source: 'market_odds' as const }
}

// ── 2025 Season Seed Data ─────────────────────────────────────────────────────
// NY Giants 2025: 4-13, 381 pts scored / 439 allowed / -58 pt differential
// 4th NFC East | HC: Brian Daboll (fired Jan 2026)

const SEASON_START = new Date('2025-09-05T18:00:00Z').getTime()
const WEEK_MS = 7 * 24 * 3600 * 1000
const DAY_MS = 24 * 3600 * 1000

const GAMES: GameResult[] = [
  { week:1,  opponent:'Philadelphia Eagles',  home:false, pointsScored:10, pointsAllowed:34, win:false, margin:-24, offensiveYards:215, defensiveYards:395, turnovers:2, sacks:1, thirdDownPct:0.22, redZonePct:0.20, specialTeamsScore:-2, opponentStrength:0.50, primetime:true  },
  { week:2,  opponent:'Dallas Cowboys',       home:true,  pointsScored:23, pointsAllowed:28, win:false, margin:-5,  offensiveYards:285, defensiveYards:308, turnovers:0, sacks:3, thirdDownPct:0.40, redZonePct:0.50, specialTeamsScore: 1, opponentStrength:0.28, primetime:false },
  { week:3,  opponent:'Washington Commanders',home:true,  pointsScored:20, pointsAllowed:27, win:false, margin:-7,  offensiveYards:265, defensiveYards:330, turnovers:1, sacks:2, thirdDownPct:0.35, redZonePct:0.50, specialTeamsScore: 0, opponentStrength:0.18, primetime:false },
  { week:4,  opponent:'Chicago Bears',        home:true,  pointsScored:27, pointsAllowed:31, win:false, margin:-4,  offensiveYards:310, defensiveYards:320, turnovers:1, sacks:3, thirdDownPct:0.42, redZonePct:0.60, specialTeamsScore: 1, opponentStrength:0.00, primetime:false },
  { week:5,  opponent:'Carolina Panthers',    home:true,  pointsScored:38, pointsAllowed:14, win:true,  margin:24,  offensiveYards:425, defensiveYards:195, turnovers:-2,sacks:5, thirdDownPct:0.62, redZonePct:1.00, specialTeamsScore: 4, opponentStrength:-0.40, primetime:false },
  { week:6,  opponent:'Miami Dolphins',       home:false, pointsScored:24, pointsAllowed:31, win:false, margin:-7,  offensiveYards:298, defensiveYards:345, turnovers:1, sacks:2, thirdDownPct:0.38, redZonePct:0.50, specialTeamsScore:-1, opponentStrength:0.12, primetime:false },
  { week:7,  opponent:'Dallas Cowboys',       home:false, pointsScored:17, pointsAllowed:28, win:false, margin:-11, offensiveYards:255, defensiveYards:335, turnovers:2, sacks:2, thirdDownPct:0.33, redZonePct:0.40, specialTeamsScore:-1, opponentStrength:0.28, primetime:false },
  { week:8,  opponent:'New England Patriots', home:true,  pointsScored:31, pointsAllowed:10, win:true,  margin:21,  offensiveYards:388, defensiveYards:198, turnovers:-2,sacks:4, thirdDownPct:0.58, redZonePct:0.88, specialTeamsScore: 3, opponentStrength:-0.32, primetime:false },
  { week:9,  opponent:'New Orleans Saints',   home:false, pointsScored:14, pointsAllowed:21, win:false, margin:-7,  offensiveYards:248, defensiveYards:295, turnovers:1, sacks:2, thirdDownPct:0.32, redZonePct:0.40, specialTeamsScore: 0, opponentStrength:0.00, primetime:false },
  { week:10, opponent:'Washington Commanders',home:false, pointsScored:20, pointsAllowed:28, win:false, margin:-8,  offensiveYards:268, defensiveYards:315, turnovers:1, sacks:3, thirdDownPct:0.38, redZonePct:0.50, specialTeamsScore:-1, opponentStrength:0.18, primetime:false },
  { week:11, opponent:'Cleveland Browns',     home:true,  pointsScored:34, pointsAllowed:17, win:true,  margin:17,  offensiveYards:368, defensiveYards:225, turnovers:-1,sacks:4, thirdDownPct:0.55, redZonePct:0.80, specialTeamsScore: 2, opponentStrength:-0.12, primetime:false },
  { week:12, opponent:'Philadelphia Eagles',  home:false, pointsScored:7,  pointsAllowed:34, win:false, margin:-27, offensiveYards:195, defensiveYards:415, turnovers:3, sacks:1, thirdDownPct:0.18, redZonePct:0.20, specialTeamsScore:-3, opponentStrength:0.50, primetime:true  },
  { week:13, opponent:'Pittsburgh Steelers',  home:true,  pointsScored:20, pointsAllowed:24, win:false, margin:-4,  offensiveYards:278, defensiveYards:298, turnovers:1, sacks:3, thirdDownPct:0.40, redZonePct:0.50, specialTeamsScore: 0, opponentStrength:0.25, primetime:false },
  { week:14, opponent:'Atlanta Falcons',      home:false, pointsScored:21, pointsAllowed:28, win:false, margin:-7,  offensiveYards:265, defensiveYards:310, turnovers:1, sacks:2, thirdDownPct:0.36, redZonePct:0.50, specialTeamsScore:-1, opponentStrength:0.10, primetime:false },
  { week:15, opponent:'Tampa Bay Buccaneers', home:true,  pointsScored:21, pointsAllowed:28, win:false, margin:-7,  offensiveYards:272, defensiveYards:318, turnovers:1, sacks:2, thirdDownPct:0.37, redZonePct:0.50, specialTeamsScore: 0, opponentStrength:-0.02, primetime:false },
  { week:16, opponent:'Baltimore Ravens',     home:false, pointsScored:18, pointsAllowed:35, win:false, margin:-17, offensiveYards:248, defensiveYards:395, turnovers:2, sacks:1, thirdDownPct:0.28, redZonePct:0.33, specialTeamsScore:-2, opponentStrength:0.45, primetime:true  },
  { week:17, opponent:'Arizona Cardinals',    home:true,  pointsScored:36, pointsAllowed:21, win:true,  margin:15,  offensiveYards:388, defensiveYards:248, turnovers:-1,sacks:4, thirdDownPct:0.57, redZonePct:0.83, specialTeamsScore: 3, opponentStrength:-0.28, primetime:false },
]

const INJURIES = [
  { week: 4, days: 3, impactWeight: 0.70, status: 'questionable', playerName: 'Tommy DeVito', position: 'QB' },
  { week: 9, days: 2, impactWeight: 0.45, status: 'out',          playerName: 'John Michael Schmitz', position: 'C' },
  { week:14, days: 3, impactWeight: 0.60, status: 'out',          playerName: 'Dexter Lawrence II', position: 'DT' },
]

const SENTIMENTS = [
  { week: 1, days: 0, br: -0.20, nm: -0.10, fan: -0.15, mom: -0.10, shock: false, disp: 0.35, label: 'Pre-season pessimism' },
  { week: 5, days: 1, br:  0.20, nm:  0.10, fan:  0.20, mom:  0.30, shock: false, disp: 0.30, label: 'Panthers win optimism' },
  { week:12, days: 1, br: -0.80, nm: -0.70, fan: -0.80, mom: -0.65, shock: true,  disp: 0.20, label: 'Eagles blowout — fan revolt' },
  { week:17, days: 1, br: -0.35, nm: -0.25, fan: -0.30, mom:  0.10, shock: false, disp: 0.50, label: 'End-of-season acceptance' },
]

const ODDS = [
  { week:  1, days: 0, prob: 0.38 },
  { week:  5, days: 0, prob: 0.44 },
  { week: 10, days: 0, prob: 0.30 },
  { week: 15, days: 0, prob: 0.22 },
]

// ── Simulation ────────────────────────────────────────────────────────────────
function runSimulation(): StateSnapshot[] {
  let S = LAUNCH_CONFIG.launchS   // -0.15
  let V = LAUNCH_CONFIG.launchV   // 0.60
  let lastMark: number | null = null
  let longOI = 500_000
  let shortOI = 500_000
  const results: StateSnapshot[] = []
  let lastTs = SEASON_START

  for (const g of GAMES) {
    const gameTs = SEASON_START + (g.week - 1) * WEEK_MS
    const daysSince = Math.max(1, (gameTs - lastTs) / DAY_MS)
    lastTs = gameTs

    // Add process noise (keeps V from collapsing to 0)
    V = Math.min(2.0, V + LAUNCH_CONFIG.processNoise * daysSince)

    const attrMap: Record<string, number> = {}
    type ObsItem = { z: number; R: number; source: string }
    const obs: ObsItem[] = []

    obs.push(gameObs(g))

    for (const inj of INJURIES) {
      const injTs = SEASON_START + (inj.week - 1) * WEEK_MS + inj.days * DAY_MS
      if (Math.abs(injTs - gameTs) < 4 * DAY_MS) obs.push(injObs(inj.impactWeight, inj.status))
    }
    for (const sent of SENTIMENTS) {
      const sentTs = SEASON_START + (sent.week - 1) * WEEK_MS + sent.days * DAY_MS
      if (Math.abs(sentTs - gameTs) < 4 * DAY_MS)
        obs.push(sentObs(sent.br, sent.nm, sent.fan, sent.mom, sent.shock, sent.disp))
    }
    for (const odd of ODDS) {
      const oddTs = SEASON_START + (odd.week - 1) * WEEK_MS + odd.days * DAY_MS
      if (Math.abs(oddTs - gameTs) < 4 * DAY_MS) obs.push(oddsObs(odd.prob))
    }

    obs.sort((a, b) => a.R - b.R)  // lower R (higher confidence) first
    for (const o of obs) {
      const S_before = S
      const updated = kalmanUpdate(S, V, o.z, o.R)
      attrMap[o.source] = (attrMap[o.source] ?? 0) + (updated.S - S_before)
      S = updated.S
      V = Math.max(0.001, updated.V)
    }

    const U = Math.sqrt(V)
    const fair = calcFairPrice(S, V)
    const mark = calcMarkPrice(fair, lastMark)
    lastMark = mark
    const funding = calcFunding(longOI, shortOI, U, mark, fair)

    const oiShift = g.win ? 25_000 : -15_000
    const marginBoost = Math.abs(g.margin) * 500
    if (g.win) {
      longOI = Math.max(100_000, longOI + oiShift + marginBoost)
      shortOI = Math.max(100_000, shortOI - oiShift * 0.5)
    } else {
      shortOI = Math.max(100_000, shortOI + Math.abs(oiShift) + marginBoost)
      longOI = Math.max(100_000, longOI - Math.abs(oiShift) * 0.5)
    }

    let event: string
    if (g.margin <= -20) event = `💥 Blowout Loss vs ${g.opponent}`
    else if (g.margin >= 20) event = `🔥 Win vs ${g.opponent} (+${g.margin})`
    else if (g.win) event = `✅ Win vs ${g.opponent} (+${g.margin})`
    else event = `❌ Loss vs ${g.opponent} (${g.margin})`

    results.push({
      timestamp: gameTs, S, V, U,
      price: fair, markPrice: mark, fundingRate: funding,
      longOI, shortOI, seasonPhase: 'regular',
      event, week: g.week, label: `W${g.week}`,
      attributions: { ...attrMap },
    })
  }

  // ── March 24, 2026 transition ───────────────────────────────────────────────
  // Coaching reset (John Harbaugh), roster FA moves, sentiment + offseason decay
  const S_end = S
  const V_end = V
  const daysOffseason = 81  // Jan 2 → Mar 24

  // 1. Passive decay + V expansion
  const decayFactor = 0.0006
  const passiveDecay = -S_end * decayFactor * daysOffseason
  let S_off = S_end + passiveDecay
  let V_off = Math.min(2.0, V_end + 0.0030 * daysOffseason)

  // 2. Coaching change (John Harbaugh — SB winner, elite upgrade from Daboll)
  const coachQuality = 0.18
  const zCoach = S_off + coachQuality * 0.30
  const Rcoach = 0.70 + (1 - 0.68) * 1.40  // 0.70 + 0.448 = 1.148
  const coachUpdate = kalmanUpdate(S_off, V_off, zCoach, Rcoach)
  const coachDelta = coachUpdate.S - S_off
  S_off = coachUpdate.S
  V_off = Math.max(0.001, coachUpdate.V) + 0.16  // + regime-change variance

  // 3. Roster moves (direct delta, no V compression)
  //    Jason Sanders K (+0.10, conf 0.82), FA OL (+0.05, 0.64), CB (+0.03, 0.60), LB cut (-0.02, 0.82)
  const rosterMoves = [
    { impact: 0.10, confidence: 0.82 },
    { impact: 0.05, confidence: 0.64 },
    { impact: 0.03, confidence: 0.60 },
    { impact: -0.02, confidence: 0.82 },
  ]
  const rosterDelta = rosterMoves.reduce((sum, m) => sum + m.impact * m.confidence * 0.18, 0)
  S_off += rosterDelta

  // 4. Sentiment — cautious optimism, muted (roster still 4-13 caliber)
  const sentComp = 0.25 * 0.35 + 0.08 * 0.30 + 0.20 * 0.20 + 0.15 * 0.15  // = 0.1525
  const zSent = S_off + sentComp * 0.12
  const Rsent = 0.80 + 0.52 * 0.50
  const sentUpdate = kalmanUpdate(S_off, V_off, zSent, Rsent)
  const sentDelta = sentUpdate.S - S_off
  S_off = sentUpdate.S
  V_off = Math.max(0.001, sentUpdate.V)

  // 5. Enforce V floor — regime change = genuine uncertainty floor
  V_off = Math.max(0.355, V_off)

  const U_off = Math.sqrt(V_off)
  const mar24Ts = new Date('2026-03-24T12:00:00Z').getTime()
  const fairOff = calcFairPrice(S_off, V_off)
  const markOff = calcMarkPrice(fairOff, lastMark)
  const fundingOff = calcFunding(longOI, shortOI, U_off, markOff, fairOff)

  results.push({
    timestamp: mar24Ts,
    S: S_off, V: V_off, U: U_off,
    price: fairOff, markPrice: markOff, fundingRate: fundingOff,
    longOI, shortOI, seasonPhase: 'offseason',
    event: '📅 Current — Mar 24, 2026 | Harbaugh Era begins',
    label: 'Now',
    attributions: {
      // Season-level (aggregate from regular season):
      game_result:   results.reduce((a, s) => a + (s.attributions['game_result'] ?? 0), 0),
      injury_shock:  results.reduce((a, s) => a + (s.attributions['injury_shock'] ?? 0), 0),
      sentiment:     results.reduce((a, s) => a + (s.attributions['sentiment'] ?? 0), 0),
      market_odds:   results.reduce((a, s) => a + (s.attributions['market_odds'] ?? 0), 0),
      // Offseason transition:
      offseason_decay:        passiveDecay,
      coaching_reset:         coachDelta,
      roster_moves:           rosterDelta,
      sentiment_narrative:    sentDelta,
      point_diff_drag:        -0.058,   // normalized −58 pt diff / 1000
    },
  })

  return results
}

export const GIANTS_SNAPSHOTS: StateSnapshot[] = runSimulation()
export const CURRENT_STATE = GIANTS_SNAPSHOTS[GIANTS_SNAPSHOTS.length - 1]
export const WEEKLY_SNAPSHOTS = GIANTS_SNAPSHOTS.filter(s => s.seasonPhase === 'regular')
export const GAMES_DATA = GAMES

// ── Attribution totals ────────────────────────────────────────────────────────
export const ATTRIBUTION_TOTALS: Record<string, number> = (() => {
  const acc: Record<string, number> = {}
  // Season-level only (regular weeks)
  for (const snap of WEEKLY_SNAPSHOTS) {
    for (const [k, v] of Object.entries(snap.attributions)) {
      acc[k] = (acc[k] ?? 0) + v
    }
  }
  return acc
})()

// Offseason-only attribution (for the current-state breakdown panel)
export const OFFSEASON_ATTRIBUTION: Record<string, number> = (() => {
  const cur = CURRENT_STATE.attributions
  return {
    '2025 Record / Pt Diff Drag': (cur['point_diff_drag'] ?? 0),
    'Coaching Reset (Harbaugh)':  (cur['coaching_reset'] ?? 0),
    'Roster FA Moves':            (cur['roster_moves'] ?? 0),
    'Offseason Uncertainty':      (cur['offseason_decay'] ?? 0),
    'Sentiment / Narrative':      (cur['sentiment_narrative'] ?? 0),
  }
})()

// ── Sentiment snapshots export ────────────────────────────────────────────────
export const SENTIMENT_SNAPSHOTS = SENTIMENTS.map(s => ({
  label: s.label,
  week: s.week,
  overall: s.br * 0.35 + s.nm * 0.25 + s.fan * 0.20 + s.mom * 0.20,
  beatReporter: s.br,
  nationalMedia: s.nm,
  fanSentiment: s.fan,
  momentum: s.mom,
  headlineShock: s.shock,
  dispersion: s.disp,
}))

// ── Current offseason state (for Risk/Overview tabs) ─────────────────────────
export const OFFSEASON_STATE = {
  currentDate: CURRENT_DATE_LABEL,
  seasonPhase: 'Offseason 2026',
  lastSeason: LAST_SEASON_RECORD,
  headCoach: CURRENT_HC,
  S: CURRENT_STATE.S,
  V: CURRENT_STATE.V,
  U: CURRENT_STATE.U,
  fairPrice: CURRENT_STATE.price,
  markPrice: CURRENT_STATE.markPrice,
  fundingRate: CURRENT_STATE.fundingRate,
  riskRegime: CURRENT_STATE.U < 0.4 ? 'CALM' : CURRENT_STATE.U < 0.7 ? 'ELEVATED' : CURRENT_STATE.U < 1.0 ? 'STRESSED' : 'CRISIS',
}
