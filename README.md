# Prophet RWP Oracle — NY Giants MVP

**A team-performance synthetic perpetual asset pricing engine.**

This is not a prediction market. It is not a sportsbook. It is an institutional-grade oracle that prices a sports team as a continuously-updated financial asset with latent state, uncertainty, perp mechanics, and full offseason carry.

---

## What Is This?

The Prophet RWP Oracle represents the NY Giants as a synthetic asset with:
- A continuously-updating **latent strength estimate** `S_t`
- A **variance / uncertainty** state `V_t` (which matters for pricing)
- An **asset price** derived from a log-price transform, not a probability
- **Perpetual market mechanics**: funding rate, leverage, liquidation, open interest

The current state as of **March 24, 2026**:
- **S = −0.21** (below league average; coming off 4–13 season)
- **U = 0.60** (elevated uncertainty; new HC, unproven roster, no live games)
- **Fair Price = $87.48** | **Mark Price = $88.79** (−11.2% from $100 launch)
- **Funding Rate = 8.4% annualized** (short-biased OI)
- **Head Coach: John Harbaugh** (hired Jan 14, 2026; Super Bowl XLVII winner)

---

## Why Not a Prediction Market?

Prediction markets answer binary questions: *will X happen?*

This system answers: *what is the current institutional price of a team as an ongoing asset?*

- No expiry date
- No binary resolution
- Persistent state that survives seasons, offseasons, coaching changes
- Priced like a synthetic equity, not a futures contract

See [`docs/WHY_NOT_PREDICTION_MARKETS.md`](docs/WHY_NOT_PREDICTION_MARKETS.md).

---

## Project Structure

```
prophet-rwp/
  apps/dashboard/          # React + Vite + Recharts (port 5600)
  packages/
    oracle/src/            # Kalman engine, observation builders, market mechanics
    shared/src/            # TypeScript types
    data-ingestion/        # Modular adapter interfaces
    market-engine/         # Perp mechanics
  docs/                    # METHODOLOGY, WHY_NOT_PREDICTION_MARKETS, DATA_SOURCES, ROADMAP
```

---

## Running the Oracle

```bash
# CLI demo (Node 22+)
node --experimental-strip-types packages/oracle/src/demo.ts

# Dashboard (http://localhost:5600)
cd apps/dashboard && npm run dev
```

---

## How Data Flows

1. **Seed data** → game results, injuries, sentiment, market odds
2. **Observation builders** → each data source converted to `{z, R, source}`
3. **Kalman updates** → sequential updates to `S`, `V` per week
4. **Offseason transitions** → structured coaching/roster/sentiment updates + V floor
5. **Price mapping** → `P = 100 × exp(0.30 × S − 0.20 × V)`
6. **Market state** → funding, OI, liquidation parameters
7. **Dashboard** → 7-tab visualization

---

## The Math (Quick Reference)

| Formula | Description |
|---------|-------------|
| `P = P₀ × exp(α×S − ½β×V)` | Price transform |
| `S* = S + K(z−S)` | Kalman update |
| `K = V / (V+R)` | Kalman gain |
| `r = rₒ + r_imbalance + r_uncertainty + r_basis` | Funding rate |
| `liqPrice = entry × (1 − margin_buffer)` | Liquidation (long) |

Full derivations in [`docs/METHODOLOGY.md`](docs/METHODOLOGY.md).

---

## Roadmap

Phase 1: NY Giants MVP ← *you are here*
Phase 2: All 32 NFL teams
Phase 3: Cross-league (NBA, EPL, MLB)
Phase 4: Exchange-grade infrastructure

See [`docs/ROADMAP.md`](docs/ROADMAP.md).
