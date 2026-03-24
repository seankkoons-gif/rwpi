# Prophet RWP Oracle — Roadmap

Five phases from the NY Giants MVP to a full multi-team, exchange-grade perpetuals infrastructure.

---

## Phase 1 — NY Giants MVP (Current)

**Status: Complete**

**Goal**: Prove the core math works and build an interactive demonstration.

**Deliverables**:
- ✅ Kalman state-space oracle engine (TypeScript)
- ✅ 17-week NY Giants 2024 season simulation
- ✅ Seeded observations: game results, injuries, sentiment, market odds
- ✅ Perp market mechanics: funding (4-component), liquidation (dynamic buffer), OI evolution
- ✅ Risk regimes (Calm/Elevated/Stressed/Crisis) with dynamic leverage caps
- ✅ 7-tab React dashboard (Overview, Price & State, Attribution, Performance, Sentiment, Risk, Methodology)
- ✅ Full documentation suite (METHODOLOGY.md, WHY_NOT_PREDICTION_MARKETS.md, DATA_SOURCES_AND_FEATURES.md)

**Key Decisions Made**:
- Price formula: P = P₀ × exp(αS − ½βV), α=0.30, β=0.40
- Launch anchor: P₀=$100, S₀=−0.15, V₀=0.60
- Funding clamp: ±60% annualized
- Mark price: 8% band, 30% mean reversion

---

## Phase 2 — Live Data Integration

**Target: 60 days**

**Goal**: Replace seeded data with real-time NFL feeds.

**Deliverables**:
- [ ] `data-ingestion` adapters for NFL official API, ESPN API, nfl-data-py
- [ ] Weekly automated ingestion pipeline (cron job or webhook)
- [ ] PFF grade integration (pass blocking, coverage, PRWR)
- [ ] Odds adapter: DraftKings / Pinnacle season-long power ratings
- [ ] News sentiment pipeline: GDELT classifier tuned to NFL teams
- [ ] Twitter/X sentiment adapter (beat reporters + fan accounts)
- [ ] Back-test harness: run oracle against full 2021–2024 seasons, evaluate S trajectory vs actual win totals
- [ ] Opponent oracle: all 32 teams run their own oracle, enabling real-time opponentStrength

**KPIs**:
- S correlation with final win percentage: target ρ > 0.75
- Price MAE vs betting market implied value: target < 8%
- Injury impact calibration: player-out S shock ≈ expected WAR loss

---

## Phase 3 — Multi-Team and League Expansion

**Target: 120 days**

**Goal**: Scale to all 32 NFL teams, establish cross-team calibration.

**Deliverables**:
- [ ] 32-team oracle fleet with shared opponent-strength network
- [ ] Cross-team normalization: S values stay on consistent league-relative scale
- [ ] Rivalry index: historical head-to-head strength adjustment
- [ ] Conference/division adjustment factors
- [ ] Team oracle API: REST endpoints returning current (S, V, P_fair, P_mark) for each team
- [ ] Dashboard v2: league-wide ranking view, cross-team comparison charts
- [ ] Alert system: significant S moves trigger notifications (configurable thresholds)
- [ ] Basket products: NFC East basket, AFC powerhouse basket (weighted average of team oracles)

**Infrastructure**:
- PostgreSQL time-series store for all StateSnapshot records
- Redis cache for real-time mark prices
- Docker-compose deployment for all 32 team oracle processes

---

## Phase 4 — Simulated Perpetuals Market

**Target: 180 days**

**Goal**: Build a paper-trading perpetuals market on top of the oracle.

**Deliverables**:
- [ ] Order book engine with limit and market orders
- [ ] Collateral management system (USDC-denominated, simulated)
- [ ] Position tracking: entries, PnL, margin ratio, liquidation price
- [ ] Auto-liquidation engine: monitors all positions against mark price, executes at liquidation price
- [ ] Funding settlement: 8-hourly settlement, automatic transfer between longs/shorts
- [ ] REST + WebSocket API for market data and order management
- [ ] Web-based trading interface: place orders, monitor positions, view funding history
- [ ] Leaderboard: top-performing paper traders by risk-adjusted returns
- [ ] Audit trail: every price update, funding event, and liquidation fully logged

**Risk Controls**:
- ADL (auto-deleveraging) for crisis regime
- Insurance fund seeded with 5% of total OI
- Circuit breaker: halt new positions if S moves >2σ in single update

---

## Phase 5 — Exchange-Grade Infrastructure

**Target: 12 months**

**Goal**: Production-ready platform with institutional-grade reliability and compliance.

**Deliverables**:
- [ ] High-availability oracle cluster: 3-node consensus on price updates, < 500ms latency
- [ ] On-chain price publication: Chainlink-compatible oracle contracts (EVM)
- [ ] Legal/compliance framework: sports finance classification, jurisdiction analysis
- [ ] Institutional API: FIX protocol adapter, co-location options
- [ ] Risk management layer: cross-margining, portfolio-level Greeks
- [ ] Market maker program: rebate structure for liquidity provision
- [ ] Audit: external smart contract audit + oracle model audit by quant firm
- [ ] Sports expansion: NBA team oracles (basketball Kalman model variant), then MLB, NHL, Premier League
- [ ] Tokenized positions: ERC-20 wrapped long/short receipts for DeFi composability

**Scale Targets**:
- 32 NFL + 30 NBA teams at launch
- Sub-100ms oracle update latency
- $10M+ simulated notional open interest
- 99.9% uptime SLA for oracle price feed

---

## Technical Debt / Known Limitations (MVP)

1. **Seed data**: Observations are manually seeded for 2024 Giants. Production requires real data adapters.
2. **Single-team**: No cross-team S calibration in MVP. OpponentStrength is hardcoded.
3. **No order book**: OI evolution is a simple heuristic (wins → longs grow). Phase 4 replaces this.
4. **No persistence**: Each demo run recomputes from scratch. Phase 2 adds a time-series DB.
5. **Sentiment model**: Placeholder composite function. Phase 2 replaces with real NLP pipeline.
6. **No auth/rate-limiting** on the dashboard. Fine for MVP, required for Phase 4+.
