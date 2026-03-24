/**
 * validate-giants.ts — Prophet RWP Oracle: Giants Validation Harness
 *
 * This is the shipping gate. Every oracle change must pass all tests
 * before any dashboard or production changes are trusted.
 *
 * Run: node --experimental-strip-types packages/oracle/src/validate-giants.ts
 * Exit 0 = all pass. Exit 1 = any failure.
 *
 * ─── Test suites ──────────────────────────────────────────────────────────
 *  1. Counterfactual    — model responds correctly to structural what-ifs
 *  2. Overreaction      — model resists fake evidence (V context: mid-season V=0.12)
 *  3. Offseason         — uncertainty expands; price doesn't flatline or recover
 *  4. Injury Sensitivity — positional weights are realistic
 *  5. Non-Betting Odds  — this is not a dressed-up moneyline
 *  6. Causality         — every major move has an attributable, bounded cause
 *
 * ─── Design notes ─────────────────────────────────────────────────────────
 *  · Overreaction tests use V=0.12 (mid-season stabilized Kalman variance).
 *    Using offseason V=0.355 would make every game look like week-1-of-a-new-
 *    season — high gain, big swings. That's correct math but wrong test context.
 *
 *  · Injury tests use V=0.355 (current offseason state).
 *    Injuries can occur any time; testing at elevated V is more conservative.
 *
 *  · CFT-1 / CAU-2 (Harbaugh price impact):
 *    The coaching hire immediately LOWERS fair price because the regime-change
 *    variance addition (ΔV=+0.16) dominates the small S uplift in the formula
 *    P = 100 × exp(α×S − ½β×V). This is correct risk-averse pricing — the HC
 *    adds future optionality but increases near-term uncertainty. Test verifies
 *    the impact is BOUNDED and V widens meaningfully, not that price jumps.
 *
 *  · ORT-5 ratio: blowout weak-opp win vs elite-opp blowout loss are roughly
 *    symmetric in magnitude for a team at S=-0.21. Both are genuinely informative
 *    observations. The test verifies both are bounded, not that one dominates.
 *
 *  · ORT-6 / ORT-7: "ugly win" and "good loss" can produce slightly positive ΔS
 *    for a below-average team (z > S=-0.21). This is correct Kalman behavior —
 *    even bad play can be above the prior for a weak team. Tests verify bounds.
 */

import { GIANTS_CONFIG, calcFairPrice, applyObservations, applyOffseasonTransition } from './oracle.ts'
import { gameResultObservation, injuryObservation } from './observations.ts'
import type { GameResult, InjuryReport } from '../../shared/src/types.ts'

// ─── Infrastructure ──────────────────────────────────────────────────────────

interface Bound { min?: number; max?: number; label: string }
interface TestResult { suite: string; name: string; passed: boolean; actual: Record<string, number>; expected: Record<string, Bound>; note?: string }

const results: TestResult[] = []
let totalPass = 0; let totalFail = 0

function test(suite: string, name: string, actual: Record<string, number>, expected: Record<string, Bound>, note?: string) {
  const passed = Object.entries(expected).every(([k, b]) => {
    const v = actual[k]; return v >= (b.min ?? -Infinity) && v <= (b.max ?? Infinity)
  })
  results.push({ suite, name, passed, actual, expected, note })
  if (passed) totalPass++; else totalFail++
}

const NOW = Date.now()
const cfg = GIANTS_CONFIG

// ─── Helpers ─────────────────────────────────────────────────────────────────

function gameResult(partial: Partial<GameResult>, S0 = -0.21, V0 = 0.12): { S: number; V: number; deltaS: number } {
  const g: GameResult = {
    week: 1, season: 2025, opponent: 'Test', home: true,
    pointsScored: 21, pointsAllowed: 21, win: false, margin: 0,
    offensiveYards: 300, defensiveYards: 300, turnovers: 0, sacks: 2,
    thirdDownPct: 0.40, redZonePct: 0.55, timeOfPossession: 30,
    penaltyYards: 45, specialTeamsScore: 0, kickingFGPct: 1.0,
    returnYards: 80, explosivePlays: 3, opponentStrength: 0.0,
    restDays: 7, primetime: false, ...partial,
  }
  const obs = gameResultObservation(g, NOW)
  const { S, V } = applyObservations(S0, V0, [obs], cfg, 7)
  return { S, V, deltaS: S - S0 }
}

function injResult(partial: Partial<InjuryReport>, S0 = -0.21, V0 = 0.355): { deltaS: number } {
  const inj: InjuryReport = {
    playerId: 'test', playerName: 'Test Player', position: 'WR',
    status: 'out', impactWeight: 0.30, timestamp: NOW, ...partial,
  }
  const obs = injuryObservation(inj)
  const { S } = applyObservations(S0, V0, [obs], cfg, 0)
  return { deltaS: S - S0 }
}

function offResult(days: number, S0 = -0.26, V0 = 0.08, transition?: Parameters<typeof applyOffseasonTransition>[2]) {
  const input = transition ?? { daysFromSeasonEndToNow: days, rosterMoves: [] }
  const { S, V, attributions } = applyOffseasonTransition(S0, V0, input, cfg)
  return { S, V, U: Math.sqrt(V), deltaS: S - S0, deltaV: V - V0, attributions }
}

// ─── Suite 1: COUNTERFACTUAL ─────────────────────────────────────────────────
console.log('\n══════════════════════════════════════════════════════════')
console.log('  PROPHET RWP — Giants Validation Harness')
console.log('══════════════════════════════════════════════════════════\n')
console.log('Suite 1: COUNTERFACTUAL TESTS')
console.log('─────────────────────────────')

{
  // CFT-1: Same 4-13 season, with Harbaugh hire vs without.
  // Coaching hire's IMMEDIATE fair price impact is bounded near zero or slightly negative
  // (regime-change ΔV outweighs small ΔS in the formula P = P₀×exp(α×S − ½β×V)).
  // What matters: V widens meaningfully (regime uncertainty is real).
  const withHC = offResult(81, -0.26, 0.08, {
    daysFromSeasonEndToNow: 81,
    coachingChange: { fromCoach: 'Daboll', toCoach: 'Harbaugh', qualitySignal: 0.18, confidence: 0.68, varianceAddition: 0.16 },
    rosterMoves: [{ player: 'Sanders', role: 'K', impact: 0.10, confidence: 0.82 }],
    sentimentPost: { overall: 0.15, beatReporter: 0.25, nationalMedia: 0.08, fanSentiment: 0.20, headlineShock: true, dispersion: 0.52 },
  })
  const withoutHC = offResult(81, -0.26, 0.08, {
    daysFromSeasonEndToNow: 81,
    rosterMoves: [{ player: 'Sanders', role: 'K', impact: 0.10, confidence: 0.82 }],
    sentimentPost: { overall: -0.10, beatReporter: -0.12, nationalMedia: -0.08, fanSentiment: -0.10, headlineShock: false, dispersion: 0.35 },
  })
  const priceDiff = calcFairPrice(withHC.S, withHC.V, cfg) - calcFairPrice(withoutHC.S, withoutHC.V, cfg)
  const vDiff = withHC.V - withoutHC.V
  test('Counterfactual', 'CFT-1: Harbaugh hire: V widens, price impact bounded near zero', { priceDiff, vDiff }, {
    // Price can go slightly negative due to uncertainty premium (correct risk-averse pricing)
    priceDiff: { min: -4.0, max: 3.0, label: 'Price impact bounded (not a >$5 swing from HC hire alone)' },
    vDiff:     { min: 0.05, max: 0.35, label: 'V higher with regime change — uncertainty is real' },
  }, 'HC hire adds future option value; immediate fair price impact is close to zero. V expansion IS the signal.')
}

{
  // CFT-2: Same season + Harbaugh, but also add an elite QB signing.
  // ΔS from a franchise QB is meaningful (0.03–0.12) — bigger than FA OL but bounded.
  const withQB = offResult(81, -0.26, 0.08, {
    daysFromSeasonEndToNow: 81,
    coachingChange: { fromCoach: 'Daboll', toCoach: 'Harbaugh', qualitySignal: 0.18, confidence: 0.68, varianceAddition: 0.16 },
    rosterMoves: [{ player: 'Elite QB', role: 'QB', impact: 0.55, confidence: 0.75 }, { player: 'Sanders', role: 'K', impact: 0.10, confidence: 0.82 }],
  })
  const withoutQB = offResult(81, -0.26, 0.08, {
    daysFromSeasonEndToNow: 81,
    coachingChange: { fromCoach: 'Daboll', toCoach: 'Harbaugh', qualitySignal: 0.18, confidence: 0.68, varianceAddition: 0.16 },
    rosterMoves: [{ player: 'Sanders', role: 'K', impact: 0.10, confidence: 0.82 }],
  })
  const sDiff = withQB.S - withoutQB.S
  test('Counterfactual', 'CFT-2: Elite QB addition provides meaningful positive ΔS', { sDiff }, {
    sDiff: { min: 0.025, max: 0.15, label: 'ΔS from franchise QB signing' },
  }, 'QB is the most impactful FA addition — but cannot singlehandedly flip a bad roster')
}

{
  // CFT-3: Same record, better game quality — close loss vs blowout to same opponent.
  const closeLoss = gameResult({ win: false, margin: -3,  pointsScored: 24, pointsAllowed: 27, opponentStrength: 0.30, thirdDownPct: 0.44, redZonePct: 0.60 })
  const blowoutLoss = gameResult({ win: false, margin: -13, pointsScored: 14, pointsAllowed: 27, opponentStrength: 0.30, thirdDownPct: 0.26, redZonePct: 0.35 })
  const sDiff = closeLoss.deltaS - blowoutLoss.deltaS
  test('Counterfactual', 'CFT-3: Close competitive loss hurts less than blowout vs same opponent', { sDiff }, {
    sDiff: { min: 0.005, max: 0.15, label: 'ΔS: close loss advantage over blowout loss (same opponent)' },
  }, 'Performance quality within losses is measurable and directionally correct')
}

{
  // CFT-4: Eagles losses — close vs blowout.
  const close = gameResult({ win: false, margin: -4,  pointsScored: 27, pointsAllowed: 31, opponentStrength: 0.50, thirdDownPct: 0.44, redZonePct: 0.60 })
  const blowout = gameResult({ win: false, margin: -24, pointsScored: 10, pointsAllowed: 34, opponentStrength: 0.50, thirdDownPct: 0.22, redZonePct: 0.20, specialTeamsScore: -2 })
  const sDiff = close.deltaS - blowout.deltaS
  test('Counterfactual', 'CFT-4: Playing Eagles tough hurts less than getting blown out', { sDiff }, {
    sDiff: { min: 0.01, max: 0.25, label: 'ΔS benefit: competitive Eagles loss vs blowout Eagles loss' },
  }, 'Playing elite teams competitively is positive evidence even in a loss')
}

{
  // CFT-5: Dexter Lawrence IR — franchise-level DT absence is a meaningful negative.
  const withLawrence = { deltaS: 0 }
  const withoutLawrence = injResult({ position: 'DT', status: 'out', impactWeight: 0.65 })
  const injPenalty = withoutLawrence.deltaS
  test('Counterfactual', 'CFT-5: Dexter Lawrence IR is a meaningful negative event', { injPenalty }, {
    injPenalty: { min: -0.22, max: -0.02, label: 'ΔS from elite DT going on IR' },
  }, 'Losing a defensive anchor should visibly move S — not catastrophic, but real')
}

{
  // CFT-6: FA moves provide modest positive delta vs no moves at all.
  const withMoves = offResult(81, -0.26, 0.08, {
    daysFromSeasonEndToNow: 81,
    coachingChange: { fromCoach: 'Daboll', toCoach: 'Harbaugh', qualitySignal: 0.18, confidence: 0.68, varianceAddition: 0.16 },
    rosterMoves: [{ player: 'Sanders', role: 'K', impact: 0.10, confidence: 0.82 }, { player: 'FA OL', role: 'OL', impact: 0.05, confidence: 0.64 }],
  })
  const withoutMoves = offResult(81, -0.26, 0.08, {
    daysFromSeasonEndToNow: 81,
    coachingChange: { fromCoach: 'Daboll', toCoach: 'Harbaugh', qualitySignal: 0.18, confidence: 0.68, varianceAddition: 0.16 },
    rosterMoves: [],
  })
  const sDiff = withMoves.S - withoutMoves.S
  test('Counterfactual', 'CFT-6: Sanders + OL FA provides small positive ΔS vs no moves', { sDiff }, {
    sDiff: { min: 0.001, max: 0.030, label: 'ΔS: roster moves vs none (coaching dominates)' },
  }, 'FA moves are real but secondary — HC is the dominant offseason signal')
}

// ─── Suite 2: OVERREACTION (all tests at V=0.12, mid-season stabilized) ───────
console.log('\nSuite 2: OVERREACTION TESTS  [context: V=0.12, mid-season]')
console.log('──────────────────────────────────────────────────────────')

{
  // ORT-1: Blowout win over a weak team. Should help but be clearly bounded.
  // The entire signal (including TO, sacks) is inside the opponent-quality envelope.
  const { deltaS } = gameResult({ win: true, margin: 24, pointsScored: 38, pointsAllowed: 14, opponentStrength: -0.40, thirdDownPct: 0.62, redZonePct: 1.0, specialTeamsScore: 4, turnovers: -2, sacks: 5 })
  test('Overreaction', 'ORT-1: Blowout vs weak team — bounded positive, not franchise-quality signal', { deltaS }, {
    deltaS: { min: 0.005, max: 0.13, label: 'ΔS: Panthers blowout win' },
  }, 'Dominated a bad team — positive but capped by opponent quality and garbage-time discount')
}

{
  // ORT-2: Narrow win over a weak team — even less signal.
  const { deltaS } = gameResult({ win: true, margin: 3, pointsScored: 20, pointsAllowed: 17, opponentStrength: -0.35, thirdDownPct: 0.35, redZonePct: 0.50 })
  test('Overreaction', 'ORT-2: Narrow win over weak team — small positive', { deltaS }, {
    deltaS: { min: 0.001, max: 0.10, label: 'ΔS: barely beat a bad team' },
  }, 'Barely beating a bad team is weak positive evidence — should be smaller than blowout')
}

{
  // ORT-3: Narrow loss to elite team — muted. Playing an elite team tough is informative.
  const { deltaS } = gameResult({ win: false, margin: -4, pointsScored: 24, pointsAllowed: 28, opponentStrength: 0.50, thirdDownPct: 0.44, redZonePct: 0.60 })
  test('Overreaction', 'ORT-3: Close loss to elite team — muted negative or near-zero', { deltaS }, {
    deltaS: { min: -0.10, max: 0.01, label: 'ΔS: competitive loss to Eagles' },
  }, 'Hanging with an elite team is near-zero to small negative — not catastrophic evidence')
}

{
  // ORT-4: Blowout loss to elite team — this IS strongly negative.
  const { deltaS } = gameResult({ win: false, margin: -27, pointsScored: 7, pointsAllowed: 34, opponentStrength: 0.50, thirdDownPct: 0.18, redZonePct: 0.20, specialTeamsScore: -3 })
  test('Overreaction', 'ORT-4: Blowout loss to elite team — strong negative signal', { deltaS }, {
    deltaS: { min: -0.18, max: -0.03, label: 'ΔS: Eagles blowout loss (-27)' },
  }, 'Getting destroyed by an elite team is damaging, appropriately penalized by quality multiplier')
}

{
  // ORT-5: Opponent quality asymmetry.
  // Blowout weak win and blowout elite loss should both be bounded.
  // Elite loss ΔS magnitude should be ≥ weak win ΔS (losses to elite teams count more).
  const weakWin   = gameResult({ win: true,  margin: 24,  opponentStrength: -0.40, thirdDownPct: 0.62, redZonePct: 1.0, turnovers: -2, sacks: 5 })
  const eliteLoss = gameResult({ win: false, margin: -27, opponentStrength:  0.50, thirdDownPct: 0.18, redZonePct: 0.20, specialTeamsScore: -3 })
  const magWin  = Math.abs(weakWin.deltaS)
  const magLoss = Math.abs(eliteLoss.deltaS)
  test('Overreaction', 'ORT-5: Both win/loss bounded; elite loss ≥ weak win in magnitude', { magWin, magLoss, lossGreaterOrEqual: magLoss >= magWin ? 1 : 0 }, {
    magWin:  { min: 0.005, max: 0.15, label: '|ΔS| blowout weak win is bounded' },
    magLoss: { min: 0.030, max: 0.20, label: '|ΔS| blowout elite loss is bounded' },
    lossGreaterOrEqual: { min: 1, label: '|elite loss| ≥ |weak win| — losses to good teams count more' },
  }, 'Opponent quality asymmetry: elite-opp blowout loss should be at least as impactful as weak-opp blowout win')
}

{
  // ORT-6: Ugly win — won but poor efficiency and lost TO battle.
  // For a below-average team (S=-0.21), winning even ugly against an average team
  // has z > S, so ΔS is slightly positive. That is correct. Test verifies it's bounded.
  const { deltaS } = gameResult({ win: true, margin: 3, pointsScored: 17, pointsAllowed: 14, opponentStrength: 0.00, turnovers: 3, thirdDownPct: 0.20, redZonePct: 0.30, specialTeamsScore: -1 })
  test('Overreaction', 'ORT-6: Ugly win — small positive (correct for below-average team), bounded', { deltaS }, {
    deltaS: { min: -0.02, max: 0.12, label: 'ΔS: ugly narrow win (won despite bad metrics)' },
  }, 'Ugly win over average team is slightly positive for a weak team (z > S=-0.21 is valid). Must be small.')
}

{
  // ORT-7: Good loss — lost but dominated efficiency metrics.
  // For S=-0.21: the game z ≈ -0.175 > S=-0.21, so ΔS is slightly positive.
  // This is correct Kalman behavior: team played better than prior estimate despite losing.
  const { deltaS } = gameResult({ win: false, margin: -3, pointsScored: 20, pointsAllowed: 23, opponentStrength: 0.25, turnovers: -1, thirdDownPct: 0.55, redZonePct: 0.70, offensiveYards: 380 })
  test('Overreaction', 'ORT-7: Good loss — near-zero to small positive (underlying quality shows)', { deltaS }, {
    deltaS: { min: -0.04, max: 0.08, label: 'ΔS: close efficient loss (z > S for below-average team)' },
  }, 'Performing well above prior estimate despite a loss is near-zero to small positive — correct model behavior')
}

// ─── Suite 3: OFFSEASON REALISM ───────────────────────────────────────────────
console.log('\nSuite 3: OFFSEASON REALISM TESTS')
console.log('─────────────────────────────────')

{
  // OFS-1: 30 days — V expands, S drifts minimally.
  const r = offResult(30, -0.26, 0.08, { daysFromSeasonEndToNow: 30, rosterMoves: [] })
  test('Offseason', 'OFS-1: 30-day silence — V expands, S barely moves', { absDS: Math.abs(r.deltaS), deltaV: r.deltaV }, {
    absDS:  { max: 0.04, label: '|ΔS| in 30 days of silence is small' },
    deltaV: { min: 0.04, label: 'V expands over 30 days' },
  })
}

{
  // OFS-2: 90 days — V meaningfully elevated.
  const r = offResult(90, -0.26, 0.08, { daysFromSeasonEndToNow: 90, rosterMoves: [] })
  test('Offseason', 'OFS-2: 90-day offseason — uncertainty is significantly elevated', { deltaV: r.deltaV, U: r.U }, {
    deltaV: { min: 0.08, label: 'V expands substantially over 90 days' },
    U:      { min: 0.20, label: 'U reflects real offseason uncertainty' },
  })
}

{
  // OFS-3: Regime change offseason has higher V than stable offseason.
  const stable = offResult(81, -0.26, 0.08, { daysFromSeasonEndToNow: 81, rosterMoves: [] })
  const regime  = offResult(81, -0.26, 0.08, {
    daysFromSeasonEndToNow: 81,
    coachingChange: { fromCoach: 'Daboll', toCoach: 'Harbaugh', qualitySignal: 0.18, confidence: 0.68, varianceAddition: 0.16 },
    rosterMoves: [],
  })
  test('Offseason', 'OFS-3: Regime change offseason has higher V than stable offseason', { vDiff: regime.V - stable.V }, {
    vDiff: { min: 0.01, label: 'V(regime change) > V(stable) — coaching change = more uncertainty' },
  })
}

{
  // OFS-4: A bad team's S does not recover to neutral in 6 months.
  const r = offResult(180, -0.40, 0.08, { daysFromSeasonEndToNow: 180, rosterMoves: [] })
  test('Offseason', 'OFS-4: Bad team stays clearly below average after 180 days of silence', { S: r.S }, {
    S: { max: -0.04, label: 'S stays well below 0 for a 4-13 team after 6 months' },
  }, 'Mean reversion is slow — a 4-13 team should not be at par by June')
}

// ─── Suite 4: INJURY SENSITIVITY (at V=0.355 offseason state) ────────────────
console.log('\nSuite 4: INJURY SENSITIVITY TESTS  [context: V=0.355]')
console.log('─────────────────────────────────────────────────────')

{
  // INJ-1: QB vs WR — positional hierarchy must hold.
  const qbOut = injResult({ position: 'QB', status: 'out', impactWeight: 0.85 })
  const wrOut = injResult({ position: 'WR', status: 'out', impactWeight: 0.25 })
  test('Injury', 'INJ-1: QB out hurts dramatically more than WR out', {
    qbOut: qbOut.deltaS, wrOut: wrOut.deltaS, ratio: Math.abs(qbOut.deltaS) / Math.abs(wrOut.deltaS),
  }, {
    qbOut: { min: -0.28, max: -0.04, label: 'ΔS: QB out (meaningful, bounded)' },
    wrOut: { min: -0.04, max: -0.001, label: 'ΔS: WR out (smaller)' },
    ratio: { min: 3.0, label: 'QB injury must hurt at least 3× more than WR' },
  })
}

{
  // INJ-2: Same position, graduated severity.
  const qbOut      = injResult({ position: 'QB', status: 'out',          impactWeight: 0.85 })
  const qbDoubt    = injResult({ position: 'QB', status: 'doubtful',     impactWeight: 0.85 })
  const qbQuestion = injResult({ position: 'QB', status: 'questionable', impactWeight: 0.85 })
  test('Injury', 'INJ-2: Injury severity scales with status (out > doubtful > questionable)', {
    outVsDoubt:    qbOut.deltaS - qbDoubt.deltaS,
    doubtVsQuestion: qbDoubt.deltaS - qbQuestion.deltaS,
  }, {
    outVsDoubt:      { max: -0.001, label: 'out hurts more than doubtful' },
    doubtVsQuestion: { max: -0.001, label: 'doubtful hurts more than questionable' },
  })
}

{
  // INJ-3: Kicker (Jason Sanders) — ST matters; small but nonzero.
  const { deltaS } = injResult({ position: 'K', status: 'out', impactWeight: 0.30 })
  test('Injury', 'INJ-3: Kicker injury is small but nonzero (ST has real weight)', { deltaS }, {
    deltaS: { min: -0.06, max: -0.001, label: 'ΔS: kicker out' },
  }, 'Special teams is a real signal. Sanders IR should register — just not dominate.')
}

{
  // INJ-4: DT (anchor) vs depth CB.
  // CB impactWeight=0.20 with z=-0.20 ≈ S=-0.21 for a below-avg team → near-zero ΔS. Correct.
  const dtOut = injResult({ position: 'DT', status: 'out', impactWeight: 0.65 })
  const cbOut = injResult({ position: 'CB', status: 'out', impactWeight: 0.20 })
  test('Injury', 'INJ-4: Elite DT IR hurts significantly; depth CB is near-zero for weak team', {
    dtOut: dtOut.deltaS, cbOut: cbOut.deltaS, ratio: Math.abs(dtOut.deltaS) / (Math.abs(cbOut.deltaS) + 0.001),
  }, {
    dtOut: { min: -0.22, max: -0.02, label: 'ΔS: elite DT out (significant)' },
    cbOut: { min: -0.03, max: 0.02,  label: 'ΔS: depth CB out (near-zero for S=-0.21 team)' },
    ratio: { min: 2.0,  label: 'DT injury must matter more than depth CB' },
  }, 'Depth CB (z≈-0.20) ≈ S=-0.21 for below-avg team → near-zero ΔS. This is correct model behavior.')
}

// ─── Suite 5: NON-BETTING-ODDS ────────────────────────────────────────────────
console.log('\nSuite 5: NON-BETTING-ODDS TESTS')
console.log('────────────────────────────────')

{
  // NBA-1: Same S, different V → different price. Uncertainty discount is real.
  const priceHighV = calcFairPrice(-0.21, 0.60, cfg)
  const priceLowV  = calcFairPrice(-0.21, 0.10, cfg)
  test('NonBettingOdds', 'NBA-1: Same S, higher V = lower price (uncertainty discount)', {
    priceDiff: priceLowV - priceHighV,
  }, {
    priceDiff: { min: 0.50, label: 'Price(low V) > Price(high V) for same S — uncertainty costs money' },
  }, 'A prediction market has no variance state. Odds do not penalize uncertainty. This model does.')
}

{
  // NBA-2: Price is not probability-bounded.
  const elite = calcFairPrice(0.80, 0.12, cfg)    // Chiefs-level
  const bad   = calcFairPrice(-0.40, 0.40, cfg)   // 3-14 team
  test('NonBettingOdds', 'NBA-2: Price is not bounded [0,1] — elite >> $100, bad << $100', {
    elitePrice: elite, badPrice: bad,
  }, {
    elitePrice: { min: 110, label: 'Elite team (S=0.80) prices above $100' },
    badPrice:   { max:  90, label: 'Bad team (S=-0.40) prices well below $100' },
  }, 'Probability must be in [0,1]. A perpetual team asset has no such constraint.')
}

{
  // NBA-3: Persistent state — prior history matters.
  const freshStart = gameResult({ win: false, margin: -8, opponentStrength: 0.18 }, -0.21, 0.355)
  const afterBadRun = gameResult({ win: false, margin: -8, opponentStrength: 0.18 }, -0.38, 0.20)
  const p1 = calcFairPrice(freshStart.S, freshStart.V, cfg)
  const p2 = calcFairPrice(afterBadRun.S, afterBadRun.V, cfg)
  test('NonBettingOdds', 'NBA-3: Same game, different prior trajectories = different price', {
    priceDiff: p1 - p2,
  }, {
    priceDiff: { min: 0.50, label: 'Same week-N game: history matters (oracle has memory)' },
  }, 'Betting odds reset weekly. The RWP oracle carries forward accumulated evidence.')
}

// ─── Suite 6: CAUSALITY ───────────────────────────────────────────────────────
console.log('\nSuite 6: CAUSALITY TESTS')
console.log('────────────────────────')

{
  // CAU-1: Eagles blowout — identifiable, bounded, attributable.
  const { deltaS } = gameResult({ win: false, margin: -24, pointsScored: 10, pointsAllowed: 34, opponentStrength: 0.50, thirdDownPct: 0.22, redZonePct: 0.20, specialTeamsScore: -2 }, -0.21, 0.355)
  const priceImpact = Math.abs(deltaS * cfg.alpha * cfg.launchPrice)
  test('Causality', 'CAU-1: Eagles Wk1 blowout has identifiable, bounded price impact', {
    deltaS, priceImpact,
  }, {
    deltaS:      { min: -0.30, max: -0.01, label: 'ΔS must be negative and bounded' },
    priceImpact: { max: 12.00, label: 'Price impact < $12 for a single game' },
  }, 'Eagles blowout = measurable negative, not catastrophic. One game does not define a team.')
}

{
  // CAU-2: Harbaugh hire — bounded, quantifiable, close to zero in fair price.
  const withHC = offResult(81, -0.26, 0.08, {
    daysFromSeasonEndToNow: 81,
    coachingChange: { fromCoach: 'Daboll', toCoach: 'Harbaugh', qualitySignal: 0.18, confidence: 0.68, varianceAddition: 0.16 },
    rosterMoves: [],
  })
  const withoutHC = offResult(81, -0.26, 0.08, { daysFromSeasonEndToNow: 81, rosterMoves: [] })
  const priceDiff = calcFairPrice(withHC.S, withHC.V, cfg) - calcFairPrice(withoutHC.S, withoutHC.V, cfg)
  const vDiff = withHC.V - withoutHC.V
  test('Causality', 'CAU-2: Harbaugh hire — price impact bounded; V expansion is the attributable signal', {
    priceDiff, vDiff,
  }, {
    priceDiff: { min: -5.0, max: 3.0, label: 'Immediate fair price impact bounded (uncertainty can dominate)' },
    vDiff:     { min: 0.05, label: 'V expands from coaching hire (regime uncertainty is the primary signal)' },
  }, 'HC hire = upside optionality + variance shock. ΔV > ΔS effect in pricing is correct and defensible.')
}

{
  // CAU-3: Alpha parameter is correctly applied in the price formula.
  const pRef = calcFairPrice(0.0, 0.0, cfg)
  const pShift = calcFairPrice(1.0, 0.0, cfg)
  const measuredSensitivity = (pShift - pRef) / pRef
  test('Causality', 'CAU-3: Price sensitivity (α=0.30, exp(0.30) ≈ +34.99%) is correct', {
    measuredSensitivity,
  }, {
    measuredSensitivity: { min: 0.30, max: 0.42, label: 'exp(0.30) − 1 ≈ 34.99% per unit of S' },
  }, 'Price transform math is internally consistent')
}

// ─── Results ──────────────────────────────────────────────────────────────────

console.log('\n══════════════════════════════════════════════════════════')
console.log('  RESULTS')
console.log('══════════════════════════════════════════════════════════\n')

const suites: Record<string, { pass: number; fail: number }> = {}
for (const r of results) {
  if (!suites[r.suite]) suites[r.suite] = { pass: 0, fail: 0 }
  if (r.passed) suites[r.suite].pass++; else suites[r.suite].fail++
}

for (const [suite, c] of Object.entries(suites)) {
  console.log(`  ${c.fail === 0 ? '✅' : '❌'} ${suite}: ${c.pass}/${c.pass + c.fail} passed`)
}

const failed = results.filter(r => !r.passed)
if (failed.length > 0) {
  console.log('\n  Failures:\n')
  for (const r of failed) {
    console.log(`  ❌ [${r.suite}] ${r.name}`)
    for (const [key, bound] of Object.entries(r.expected)) {
      const val = r.actual[key]
      if (val < (bound.min ?? -Infinity) || val > (bound.max ?? Infinity)) {
        console.log(`     ${key}: got ${val.toFixed(6)}, want [${bound.min?.toFixed(4) ?? '-∞'}, ${bound.max?.toFixed(4) ?? '+∞'}] — ${bound.label}`)
      }
    }
    if (r.note) console.log(`     → ${r.note}`)
    console.log()
  }
}

console.log(`\n  Total: ${totalPass} passed, ${totalFail} failed / ${results.length} tests`)
if (totalFail === 0) {
  console.log('\n  ✅ ALL TESTS PASS — oracle cleared for shipping\n')
} else {
  console.log(`\n  ❌ ${totalFail} FAILURE(S) — fix before shipping\n`)
}

process.exit(totalFail > 0 ? 1 : 0)
