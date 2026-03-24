# Prophet RWP Oracle — Methodology

## Overview

The Prophet RWP Oracle prices a team as a **persistent synthetic asset**, not an event contract. For the NY Giants, the oracle maintains a continuously-updated latent state representing team quality, maps it to an asset price via a log-price transform, and supports perpetual-style long/short mechanics.

---

## 1. Latent State Model

The oracle tracks three core quantities for each team at all times:

| Symbol | Meaning | Giants (Mar 24, 2026) |
|--------|---------|----------------------|
| `S_t` | Latent strength (normalized; 0 = league average) | −0.21 |
| `V_t` | Variance of latent strength estimate | 0.355 |
| `U_t = √V_t` | Uncertainty (standard deviation) | 0.596 |

S is not a probability. It is a real-valued strength estimate where positive = above average, negative = below. A team at S = +1.0 is an elite SB contender; S = −0.5 is bottom-quartile.

---

## 2. Observation Updates (Kalman-Like)

Each observation provides:
- `z`: observed latent strength implied by this signal
- `R`: noise variance (inversely proportional to confidence)

**Kalman update:**
```
gain = V / (V + R)
S_new = S + gain × (z − S)
V_new = (1 − gain) × V
```

Multiple observations are applied sequentially, highest-confidence first. After each batch, process noise is added:
```
V_t+1 = V_t + processNoise × daysSinceLastUpdate
```
(processNoise = 0.005/day keeps variance from fully collapsing across the 17-week season.)

**Opponent scaling** — game result observations scale by opponent quality:
```
opponentScale = max(0.25, 0.5 + 0.5 × opponentStrength)
z_game = coreSignal × opponentScale + turnoverAdjustment + sackBonus
```
Beating a weak team (opponentStrength = −0.40) scales the signal by 0.30, preventing a garbage-time win from dominating the state estimate.

---

## 3. Price Transform

```
P_t = P_launch × exp(α × S_t − ½ × β × V_t)
```

| Parameter | Value | Role |
|-----------|-------|------|
| `P_launch` | $100 | Anchor price |
| `α` | 0.30 | Price sensitivity to latent strength |
| `β` | 0.40 | Uncertainty discount |

The uncertainty discount `−½βV` means higher variance → lower price. A team with identical S but higher uncertainty is priced lower because the distribution of outcomes is wider.

**Key property:** This is not a probability transform. P can go above $100 (for elite teams) and can fall below $100 indefinitely. There is no 0–1 bound.

---

## 4. Mark Price

The mark price is the tradeable price, bounded near the fair oracle price:
```
mark_proposed = lastMark + 0.3 × (fair − lastMark)
mark = clamp(mark_proposed, fair × (1 − band), fair × (1 + band))
```
where `band = 0.08` (±8%). This prevents single-session manipulation from disconnecting the mark from the oracle state.

---

## 5. Launch Anchor — NY Giants

The 2025 launch parameters reflect the Giants entering the 2025 season as a below-average team:

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| `S_0` | −0.15 | Below-average entering 2025; 4th NFC East projection |
| `V_0` | 0.60 | High initial uncertainty (new season, unproven roster) |
| `P_0` | $100 | Standardized anchor for comparison across teams |

---

## 6. Funding Rate

```
r_funding = r_base + r_imbalance + r_uncertainty + r_basis
r_base          = 0.05   (5% annualized floor)
r_imbalance     = 0.20 × (longOI − shortOI) / totalOI
r_uncertainty   = 0.10 × U
r_basis         = 0.15 × (mark − fair) / fair
```
Capped at ±60% annualized. Short-biased markets → negative funding (shorts pay longs). High uncertainty → higher cost of carry for all positions.

---

## 7. Liquidation

```
liqPrice (long)  = entry × (1 − (collateral − MM_required) / size)
liqPrice (short) = entry × (1 + (collateral − MM_required) / size)
MM_required = size × dynamicBuffer
dynamicBuffer = mmRate × (1 + U × 0.5)
```

The dynamic buffer means uncertainty directly tightens liquidation thresholds. A team with U = 0.60 (like the current Giants) has a ~50% higher maintenance margin requirement than a calm-regime team at U = 0.20.

---

## 8. Offseason Carry

The oracle does **not** flatline during offseason. Two mechanisms keep it alive:

**Passive carry:**
- S drifts slowly toward league mean (0) at 0.06%/day
- V expands at 0.30%/day — silence = growing uncertainty

**Structured transitions** (coaching changes, roster moves):
```
S_new = S_old + passiveDecay + coachingDelta + rosterDelta + sentimentDelta
V_new = max(V_floor, V_old + passiveExpansion + coachingVarianceShock)
```
The V floor (0.355 for a regime-change offseason) prevents false precision about an unproven new system.

---

## 9. Current NY Giants State — March 24, 2026

**What happened:**
1. **2025 season (4–13, −58 pt differential):** 13 losses, including two Eagles blowouts and a Ravens loss, pushed S from −0.15 down to −0.26 by season end. Three dominant wins (Patriots, Panthers, Cardinals) partially offset but could not overcome the sustained poor performance.
2. **Offseason decay (81 days):** Passive mean reversion and V expansion began as soon as the season ended.
3. **John Harbaugh hire (Jan 14, 2026):** Elite HC with one Super Bowl ring (2012 Ravens). Signal: expected ~0.054 ΔS uplift. But high noise variance (R ≈ 1.15): roster is still 4–13 caliber and new system is unproven.
4. **FA/roster moves (Feb–Mar 2026):** Jason Sanders (K), FA OL additions, CB depth. Net positive but modest: +0.026 ΔS.
5. **V floor (0.355):** Enforced because new HC + unproven roster + no games = genuine uncertainty that V cannot fall below.

**Result:** S = −0.21, U = 0.60, Mark ≈ $88.79, Fair ≈ $87.48. The team is below average but not dead. The coaching hire adds real future optionality that narrows the gap, while sustained on-field evidence (4–13) anchors S negative.

---

## 10. Why a Coaching Reset Can Lift Price While S Stays Negative

A coaching change is a forward-looking signal. John Harbaugh's track record (17 seasons, 1 SB) represents probability-weighted future improvement that a Kalman filter assigns some weight to. However:

1. The observation noise `R` for a coaching change is very high (R ≈ 1.15) because the HC has not yet coached this roster, and many coaching successes are roster-dependent.
2. The Kalman gain for such a noisy observation is low (~0.22), so the actual S delta is modest: +0.01–0.03.
3. V increases by 0.16 (varianceAddition) because a new system genuinely expands the distribution of outcomes — the team could surprise upward or disappoint.

Net: price rises slightly (coaching uplift > V discount on this margin) but S stays negative. This is the correct institutional framing: **the roster hasn't changed enough to flip the team above average, but the expected value has shifted upward from the worst-case distribution.** That shift has a price.
