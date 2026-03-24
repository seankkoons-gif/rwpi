# Prophet RWP Oracle — Data Sources & Features

## Current State: NY Giants, March 24, 2026

The oracle's current state is derived from:
1. **Completed 2025 regular season** (4–13, 381 PF / 439 PA, −58 PD)
2. **Offseason regime change** — John Harbaugh hired Jan 14, 2026
3. **March 2026 roster actions** — Jason Sanders (K), FA OL/CB additions
4. **Explicit offseason uncertainty expansion** — 81 days of no live games + V floor enforcement

---

## Signal Categories

### 1. Game / Schedule / Outcome
- Score, margin, win/loss
- Offensive/defensive yards
- Third down %, red zone %
- Turnover differential
- Sack counts
- Special teams composite score
- Opponent strength (normalized −1 to +1)
- Home/away, rest days, primetime flag
- **Observation weight:** ~0.45x signal from weak opponents, ~0.75x from strong

### 2. Team Performance Efficiency
- Points scored/allowed (absolute + differential)
- Yards per play proxies
- Clutch/late-game efficiency
- Kicking FG%
- Return yards, explosive plays
- Time of possession

### 3. Roster / Injury / Personnel
- Injury status (out/doubtful/questionable/probable)
- Position impact weight (QB = 0.70–0.90, DT = 0.45–0.65, OL = 0.30–0.50)
- IR/season-ending flags → decay window 14 days
- FA signings, cap cuts, depth chart changes
- **Offseason:** coaching changes (direct S+V update), roster FA moves (direct S delta)

### 4. Sentiment / Media / Narrative
- Beat reporter sentiment (weight 0.35)
- National media sentiment (weight 0.30)
- Fan sentiment (weight 0.20)
- Momentum (weight 0.15)
- Headline shock flag (multiplier 1.8× on composite)
- Dispersion (high dispersion → low confidence → higher observation R)
- **Offseason:** cautious Harbaugh-era optimism; muted by roster skepticism

### 5. Market / Odds
- Implied season win probability (logit transform to latent S)
- Observation confidence: 0.70
- Decay window: 7 days
- **Note:** market is an input to the oracle, not the oracle itself

### 6. Structural / Franchise
- Head coach tenure and quality
- QB continuity
- OL stability proxy
- Defensive anchor players (Dexter Lawrence impact weight = 0.60)
- **Offseason 2026:** Harbaugh quality signal = 0.18 (SB winner, elite upgrade from Daboll)

### 7. Offseason-Specific
- Passive mean reversion: S × 0.06%/day toward 0
- Variance expansion: 0.30% V/day
- V floor (regime change): 0.355
- Coaching change: Kalman update + variance shock (+0.16)
- Roster FA moves: direct S delta (confidence-weighted, no V compression)

---

## Signal Weights Summary

| Category | Observation R | Kalman Gain (typical) | Impact |
|----------|--------------|----------------------|--------|
| Game result (primetime) | 0.32–0.40 | 0.15–0.25 | Moderate per game |
| Injury shock (QB out) | 0.18 | 0.30–0.40 | Strong single event |
| Sentiment (crisis) | 0.35–0.55 | 0.10–0.20 | Moderate |
| Market odds | 0.29 | 0.15–0.20 | Moderate |
| Coaching change | 1.15 | 0.08–0.22 | Small ΔS, large ΔV |
| Roster FA move | Direct delta | N/A | Small direct ΔS |

---

## Offseason Observation Architecture

Offseason events follow a layered priority:
1. **Passive time** → variance expansion + mean reversion (always on)
2. **Coaching change** → Kalman update + regime-change variance shock
3. **Roster moves** → direct weighted S delta (no V compression; FA is low-information)
4. **Sentiment** → light Kalman (scaled 0.12×; leading indicator, not confirming)
5. **V floor** → enforced at 0.355 for active regime changes

This architecture ensures that a coaching hire like Harbaugh's shows up as:
- Modest positive S delta (+0.01–0.03): HC can't fix the roster immediately
- Higher V (uncertainty widens): new system genuinely unknown
- Slightly higher price: convexity of upside outweighs near-term uncertainty discount
