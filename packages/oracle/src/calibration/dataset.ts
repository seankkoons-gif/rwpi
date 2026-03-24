/**
 * dataset.ts — Synthetic NFL calibration dataset generator
 *
 * Generates a deterministic 3-season (2022–2024) × 32-team × 17-game dataset
 * using a seeded LCG PRNG. No external dependencies. No Math.random().
 *
 * The Giants 2025 season (from seed-giants.ts) is included as an anchor
 * for offseason realism tests.
 *
 * Run standalone to regenerate testdata:
 *   node --experimental-strip-types packages/oracle/src/calibration/dataset.ts
 */

import { writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import type { HistoricalGame, TeamStrengthProfile } from './types.ts'
import { NFL_TEAMS_2025 } from './types.ts'
import type { EloGameInput } from '../baselines/elo.ts'

// ─── Seeded LCG PRNG ─────────────────────────────────────────────────────────

/**
 * Linear Congruential Generator (LCG) with parameters from Numerical Recipes.
 * Deterministic, fast, no external deps.
 * Parameters: a=1664525, c=1013904223, m=2^32 (unsigned 32-bit).
 */
export class SeededRng {
  private state: number

  constructor(seed: number) {
    // Ensure seed is a positive 32-bit integer
    this.state = (seed >>> 0) || 1
  }

  /** Returns float in [0, 1) */
  next(): number {
    this.state = ((1664525 * this.state + 1013904223) >>> 0)
    return this.state / 4294967296
  }

  /** Returns integer in [min, max] inclusive */
  nextInt(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1))
  }

  /** Box-Muller transform: Normal(mean, std) */
  nextNormal(mean: number, std: number): number {
    // Consume two uniform samples
    const u1 = Math.max(1e-10, this.next())
    const u2 = this.next()
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
    return mean + z * std
  }

  /** Returns float in [min, max) */
  nextUniform(min: number, max: number): number {
    return min + this.next() * (max - min)
  }
}

// ─── Team strength profiles ────────────────────────────────────────────────────

/**
 * Generate team strength profiles for all 32 NFL teams.
 * Some teams have fixed archetypes (elite, weak); most follow a seeded random profile.
 * Returns a map of teamId → profile.
 */
export function generateTeamProfiles(
  seasons: number[],
  rng: SeededRng,
): Map<string, TeamStrengthProfile> {
  // Hardcoded archetypes for anchor teams (based on 2022-2024 reality)
  const archetypes: Record<string, number> = {
    phi: 0.45,   // Eagles — elite
    kc:  0.42,   // Chiefs — elite
    sf:  0.40,   // 49ers — elite
    buf: 0.38,   // Bills — strong
    bal: 0.35,   // Ravens — strong
    det: 0.30,   // Lions — good
    dal: 0.28,   // Cowboys — good
    min: 0.22,   // Vikings — above avg
    hou: 0.20,   // Texans — rising
    cin: 0.18,   // Bengals — decent
    pit: 0.15,   // Steelers — decent
    nyg: -0.20,  // Giants — below avg (anchor to our known state)
    car: -0.40,  // Panthers — weak
    ne:  -0.30,  // Patriots — declining
    ten: -0.28,  // Titans — weak
    cle: -0.12,  // Browns — below avg
    chi: -0.10,  // Bears — below avg
    jax:  0.10,  // Jaguars — middling
    den: -0.15,  // Broncos — below avg
    ind: -0.08,  // Colts — below avg
  }

  const profiles = new Map<string, TeamStrengthProfile>()

  for (const team of NFL_TEAMS_2025) {
    const base = archetypes[team.teamId] ?? rng.nextUniform(-0.20, 0.25)
    const seasonStrengths: Record<number, number> = {}

    let s = base
    for (const season of seasons) {
      // Season-to-season drift: ±0.05-0.10 random walk, clamped to [-0.50, 0.55]
      const drift = rng.nextNormal(0, 0.07)
      s = Math.max(-0.50, Math.min(0.55, s + drift))
      seasonStrengths[season] = s
    }

    profiles.set(team.teamId, {
      teamId: team.teamId,
      teamName: team.teamName,
      baseStrength: base,
      seasonStrengths,
    })
  }

  return profiles
}

// ─── Schedule generation ──────────────────────────────────────────────────────

interface GameSlot {
  homeTeamId: string
  awayTeamId: string
  week: number
}

/**
 * Generate a 17-game schedule for each team.
 * - 6 games: division rivals (3 opponents × 2 home/away)
 * - 4 games: same-conference non-division (seeded random pairing)
 * - 4 games: cross-conference (seeded random pairing)
 * - 3 games: additional conference games to reach 17
 *
 * Returns a list of unique GameSlots (each game appears once: home perspective).
 */
export function generateSchedule(season: number, rng: SeededRng): GameSlot[] {
  const slots: GameSlot[] = []
  const teamIds = NFL_TEAMS_2025.map(t => t.teamId)
  const divisionMap = new Map<string, string[]>()  // divisionName → teamIds

  for (const team of NFL_TEAMS_2025) {
    const d = team.division
    if (!divisionMap.has(d)) divisionMap.set(d, [])
    divisionMap.get(d)!.push(team.teamId)
  }

  const paired = new Set<string>()
  const pairKey = (a: string, b: string) => [a, b].sort().join('|')
  let weekCounter = 1

  // Division games: each team plays each division rival twice
  for (const [, members] of divisionMap) {
    for (let i = 0; i < members.length; i++) {
      for (let j = i + 1; j < members.length; j++) {
        const home = members[i]
        const away = members[j]
        const week1 = weekCounter++ % 17 + 1
        const week2 = weekCounter++ % 17 + 1
        slots.push({ homeTeamId: home, awayTeamId: away, week: Math.min(17, week1) })
        slots.push({ homeTeamId: away, awayTeamId: home, week: Math.min(17, week2) })
        paired.add(pairKey(home, away))
      }
    }
  }

  // Non-division games: fill remaining games using random pairing
  // Group teams into conferences for cross-division scheduling
  const confTeams: Record<string, string[]> = { AFC: [], NFC: [] }
  for (const team of NFL_TEAMS_2025) confTeams[team.conference].push(team.teamId)

  // Build a list of all non-division pairings, shuffled with seed
  const allPairs: { a: string; b: string }[] = []
  for (let i = 0; i < teamIds.length; i++) {
    for (let j = i + 1; j < teamIds.length; j++) {
      const a = teamIds[i], b = teamIds[j]
      if (!paired.has(pairKey(a, b))) {
        allPairs.push({ a, b })
      }
    }
  }

  // Shuffle with seeded RNG
  for (let i = allPairs.length - 1; i > 0; i--) {
    const j = rng.nextInt(0, i)
    ;[allPairs[i], allPairs[j]] = [allPairs[j], allPairs[i]]
  }

  // Track games per team to enforce 17-game cap
  const gamesCount: Record<string, number> = {}
  for (const t of teamIds) gamesCount[t] = 0
  for (const s of slots) {
    gamesCount[s.homeTeamId] = (gamesCount[s.homeTeamId] ?? 0) + 1
    gamesCount[s.awayTeamId] = (gamesCount[s.awayTeamId] ?? 0) + 1
  }

  let week = 8
  for (const pair of allPairs) {
    if (gamesCount[pair.a] >= 17 || gamesCount[pair.b] >= 17) continue
    // Randomly assign home/away
    const homeFirst = rng.next() > 0.5
    const homeId = homeFirst ? pair.a : pair.b
    const awayId = homeFirst ? pair.b : pair.a
    const assignedWeek = Math.min(17, week)
    slots.push({ homeTeamId: homeId, awayTeamId: awayId, week: assignedWeek })
    gamesCount[pair.a]++
    gamesCount[pair.b]++
    paired.add(pairKey(pair.a, pair.b))
    week = week >= 17 ? 9 : week + 1

    // Stop when everyone has 17 games
    if (Object.values(gamesCount).every(c => c >= 17)) break
  }

  return slots
}

// ─── Game result generation ───────────────────────────────────────────────────

/**
 * Generate a game result given home/away strength and a RNG.
 * Returns all fields needed for HistoricalGame.
 */
function generateGameResult(
  gameId: string,
  season: number,
  week: number,
  homeTeamId: string,
  awayTeamId: string,
  homeS: number,
  awayS: number,
  isPrimetime: boolean,
  forceUpset: boolean,
  rng: SeededRng,
): HistoricalGame {
  // Win probability: sigmoid(5 * (homeS - awayS) + 0.1)  0.1 = home advantage
  const homeDiff = homeS - awayS + 0.10
  const rawWinProb = 1 / (1 + Math.exp(-4.0 * homeDiff))

  const homeWon = forceUpset ? rawWinProb < 0.5 : rng.next() < rawWinProb

  // Score generation
  const winnerMean = 27
  const winnerStd = 7
  const loserMean = 17
  const loserStd = 6

  const winnerScore = Math.max(3, Math.round(rng.nextNormal(winnerMean, winnerStd)))
  const loserScore = Math.max(0, Math.round(rng.nextNormal(loserMean, loserStd)))

  const homeScore = homeWon ? winnerScore : loserScore
  const awayScore = homeWon ? loserScore : winnerScore
  const margin = homeScore - awayScore

  // Box score stats
  const homeWinning = homeWon
  const homeThirdDownPct = Math.max(0.10, Math.min(0.75, rng.nextNormal(
    homeWinning ? 0.48 : 0.32, 0.10
  )))
  const awayThirdDownPct = Math.max(0.10, Math.min(0.75, rng.nextNormal(
    homeWinning ? 0.32 : 0.48, 0.10
  )))
  const homeRedZonePct = Math.max(0.0, Math.min(1.0, rng.nextNormal(
    homeWinning ? 0.65 : 0.45, 0.15
  )))
  const awayRedZonePct = Math.max(0.0, Math.min(1.0, rng.nextNormal(
    homeWinning ? 0.45 : 0.65, 0.15
  )))

  const homeSpecialTeams = rng.nextInt(-3, 4)
  const awaySpecialTeams = rng.nextInt(-3, 4)

  // Turnovers: winner tends to have fewer
  const homeTurnovers = Math.max(0, homeWinning
    ? rng.nextInt(0, 2) : rng.nextInt(0, 4))
  const awayTurnovers = Math.max(0, homeWinning
    ? rng.nextInt(0, 4) : rng.nextInt(0, 2))

  // Sacks: winner inflicts more
  const homeSacks = homeWinning ? rng.nextInt(1, 5) : rng.nextInt(0, 3)
  const awaySacks = homeWinning ? rng.nextInt(0, 3) : rng.nextInt(1, 5)

  return {
    gameId,
    season,
    week,
    homeTeamId,
    awayTeamId,
    homeScore,
    awayScore,
    homeWon,
    margin,
    homeThirdDownPct: +homeThirdDownPct.toFixed(3),
    awayThirdDownPct: +awayThirdDownPct.toFixed(3),
    homeRedZonePct: +homeRedZonePct.toFixed(3),
    awayRedZonePct: +awayRedZonePct.toFixed(3),
    homeSpecialTeams,
    awaySpecialTeams,
    homeTurnovers,
    awayTurnovers,
    homeSacks,
    awaySacks,
    isPrimetime,
    isUpset: forceUpset,
    homeTrueStrength: homeS,
    awayTrueStrength: awayS,
  }
}

// ─── Full dataset generation ──────────────────────────────────────────────────

export interface NFLDataset {
  seasons: number[]
  teams: TeamStrengthProfile[]
  games: HistoricalGame[]
  eloInputs: EloGameInput[]
  metadata: {
    totalGames: number
    totalUpsets: number
    generatedAt: string
    seed: number
  }
}

/**
 * Generate the complete calibration dataset.
 * Deterministic: same seed always produces the same games.
 */
export function generateNFLDataset(seed = 42): NFLDataset {
  const rng = new SeededRng(seed)
  const SEASONS = [2022, 2023, 2024]
  const UPSETS_PER_SEASON = 8

  const profiles = generateTeamProfiles(SEASONS, rng)

  const allGames: HistoricalGame[] = []
  const allEloInputs: EloGameInput[] = []
  let totalUpsets = 0

  for (const season of SEASONS) {
    const schedule = generateSchedule(season, rng)

    // Mark some games as forced upsets (underdog wins despite large Elo gap)
    const upsetCandidates: number[] = []
    for (let i = 0; i < schedule.length; i++) {
      const slot = schedule[i]
      const homeS = profiles.get(slot.homeTeamId)!.seasonStrengths[season] ?? 0
      const awayS = profiles.get(slot.awayTeamId)!.seasonStrengths[season] ?? 0
      const sGap = Math.abs(homeS - awayS)
      if (sGap > 0.30) upsetCandidates.push(i)  // approx 100 Elo points
    }

    // Shuffle upset candidates and take UPSETS_PER_SEASON
    for (let i = upsetCandidates.length - 1; i > 0; i--) {
      const j = rng.nextInt(0, i)
      ;[upsetCandidates[i], upsetCandidates[j]] = [upsetCandidates[j], upsetCandidates[i]]
    }
    const upsetIndices = new Set(upsetCandidates.slice(0, UPSETS_PER_SEASON))

    for (let idx = 0; idx < schedule.length; idx++) {
      const slot = schedule[idx]
      const homeS = profiles.get(slot.homeTeamId)!.seasonStrengths[season] ?? 0
      const awayS = profiles.get(slot.awayTeamId)!.seasonStrengths[season] ?? 0
      const isPrimetime = rng.next() < 0.12  // ~12% of games are primetime
      const forceUpset = upsetIndices.has(idx)
      const gameId = `${season}-W${slot.week}-${slot.homeTeamId}-vs-${slot.awayTeamId}`

      const game = generateGameResult(
        gameId, season, slot.week,
        slot.homeTeamId, slot.awayTeamId,
        homeS, awayS, isPrimetime, forceUpset, rng,
      )
      allGames.push(game)
      if (game.isUpset) totalUpsets++

      allEloInputs.push({
        gameId,
        season,
        week: slot.week,
        homeTeamId: slot.homeTeamId,
        awayTeamId: slot.awayTeamId,
        homeWon: game.homeWon,
        margin: Math.abs(game.margin),
      })
    }
  }

  // Sort chronologically
  allGames.sort((a, b) => a.season !== b.season ? a.season - b.season : a.week - b.week)
  allEloInputs.sort((a, b) => a.season !== b.season ? a.season - b.season : a.week - b.week)

  return {
    seasons: SEASONS,
    teams: [...profiles.values()],
    games: allGames,
    eloInputs: allEloInputs,
    metadata: {
      totalGames: allGames.length,
      totalUpsets,
      generatedAt: new Date().toISOString(),
      seed,
    },
  }
}

// ─── Standalone runner (write testdata file) ──────────────────────────────────

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Check if running as main module
const isMain = process.argv[1]?.endsWith('dataset.ts') || process.argv[1]?.endsWith('dataset.js')
if (isMain) {
  console.log('Generating NFL calibration dataset (seed=42)...')
  const dataset = generateNFLDataset(42)
  const outPath = join(__dirname, '../../testdata/nfl-sample-seasons.json')
  writeFileSync(outPath, JSON.stringify(dataset, null, 2))
  console.log(`✅ Written to ${outPath}`)
  console.log(`   ${dataset.metadata.totalGames} games, ${dataset.metadata.totalUpsets} upsets`)
  console.log(`   ${dataset.teams.length} teams, ${dataset.seasons.length} seasons`)
}
