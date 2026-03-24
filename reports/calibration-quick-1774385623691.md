# Prophet RWP Oracle — Calibration Report

Generated: 2026-03-24T20:53:43.689Z
Mode: quick | Duration: 1.8s | Runs: 2500
Dataset: 811 games across 3 seasons

---

## ⚠️ ELO BEATS CURRENT RWPI

**RWPI log loss vs Elo log loss:** 0.6786 vs 0.6330
Elo outperforms current RWPI on pure win prediction. Consider:
- Increasing tanhSaturationPoint (less sensitive to margin)
- Reducing gameNoiseVariance (more weight per game)
- Current best RWPI params give 7.2069% worse log loss

---

## Metric Comparison

| Metric | Elo Baseline | RWPI Default | Best Calibrated RWPI |
|----------------------|----------------|----------------|------------------------|
| Log Loss | 0.6330 | 0.6794 | 0.6786 |
| Brier Score | 0.2197 | 0.2431 | 0.2427 |
| Calibration Error | 0.0470 | 0.0170 | 0.0147 |
| Total Objective | N/A | 0.7199 | 0.7057 |

---

## Best Calibrated Parameters

**Run ID:** `724818d0`

| Parameter | Default | Best Calibrated | Delta |
|------------------------------|------------|--------------------|--------------|
| tanhSaturationPoint | 28.0000 | 32.0000 | +4.0000 |
| gameNoiseVariance | 0.4200 | 0.5200 | +0.1000 |
| alpha | 0.3000 | 0.3500 | +0.0500 |
| processNoise | 0.0050 | 0.0020 | -0.0030 |
| opponentScaleFactor | 0.5000 | 0.5000 | +0.0000 |
| marginWeight | 0.4000 | 0.4000 | +0.0000 |
| efficiencyWeight | 0.3000 | 0.3000 | +0.0000 |
| beta | 0.4000 | 0.4000 | +0.0000 |

### Score Breakdown (Best Run)

| Component | Score | Weight | Contribution |
|--------------------------|------------|----------|----------------|
| Log Loss | 0.6786 | 1.0 | 0.6786 |
| Calibration Error | 0.0147 | 0.5 | 0.0073 |
| Stability Penalty | 0.0028 | 0.3 | 0.0008 |
| Overreaction Penalty | 0.0407 | 0.4 | 0.0163 |
| Offseason Realism | 0.0000 | 0.3 | 0.0000 |
| Param Simplicity | 0.0268 | 0.1 | 0.0027 |
| **TOTAL** |  |  | **0.7057** |

---

## Top 10 Most Sensitive Parameters

High variance across top-10 runs indicates a parameter matters greatly to the objective.

| Rank | Parameter | Variance | Min | Max | Mean |
|------|------------------------------|------------|----------|----------|----------|
| 1 | tanhSaturationPoint | 8.960000 | 28.0000 | 36.0000 | 31.2000 |
| 2 | opponentScaleFactor | 0.016100 | 0.3000 | 0.7000 | 0.5300 |
| 3 | gameNoiseVariance | 0.001521 | 0.5200 | 0.6500 | 0.5330 |
| 4 | alpha | 0.000225 | 0.3000 | 0.3500 | 0.3450 |
| 5 | marginWeight | 0.000000 | 0.4000 | 0.4000 | 0.4000 |
| 6 | efficiencyWeight | 0.000000 | 0.3000 | 0.3000 | 0.3000 |
| 7 | beta | 0.000000 | 0.4000 | 0.4000 | 0.4000 |
| 8 | processNoise | 0.000000 | 0.0020 | 0.0020 | 0.0020 |
| 9 | processNoise | 0.000000 | 0.0020 | 0.0020 | 0.0020 |
| 10 | offseasonMeanReversion | 0.000000 | 0.0006 | 0.0006 | 0.0006 |

---

## Giants Validation Report (Current State: 4-13, March 2026)

| Check | Value | Threshold | Result |
|------------------------------------|--------------|----------------|----------|
| Season 2025 Final S | -0.2084 | ≈ -0.20 | ✅ |
| Mar 24 Fair Price | $88.67 | near $88-92 | ✅ |
| Mar 24 S | -0.1642 | ≈ -0.20 | ✅ |
| Weak Win Max ΔS | 0.0781 | < 0.13 | ✅ |
| Elite Blowout Loss ΔS | -0.1281 | < -0.03 | ✅ |
| Harbaugh Price Impact | $-0.93 | [-$5, +$5] | ✅ |
| Offseason V (90d) | 0.3500 | > 0.10 | ✅ |

✅ **All Giants behavioral checks PASS** — oracle responds correctly to real-world events.

---

## OU (Ornstein-Uhlenbeck) Recommendation

### ✅ REMAIN DISABLED

**Rationale:** The current Kalman process noise model already provides realistic
offseason uncertainty expansion (V > 0.10 after 90 days silence) and in-season
stability (stability penalty < 0.01). Adding OU mean-reversion would:
- Create spurious "drift toward average" even during active seasons
- Interfere with the team's earned S from actual game performance
- Add a free parameter (theta) that increases overfitting risk

**Re-evaluate when:** S shows systematic multi-season drift away from
true team quality that processNoise alone cannot explain.

---

## Top 10 Calibration Runs

| Rank | Run ID | Total Score | Log Loss | Calib Error | Overreact | vs Elo |
|------|------------|--------------|------------|--------------|------------|--------------|
| 1 | 724818d0 | 0.7057 | 0.6786 | 0.0147 | 0.0407 | ELO_WINS |
| 2 | 6e9b8e90 | 0.7067 | 0.6784 | 0.0155 | 0.0444 | ELO_WINS |
| 3 | dd1db9a8 | 0.7070 | 0.6786 | 0.0151 | 0.0419 | ELO_WINS |
| 4 | 85b26bf8 | 0.7072 | 0.6784 | 0.0151 | 0.0450 | ELO_WINS |
| 5 | a27d60e8 | 0.7077 | 0.6784 | 0.0159 | 0.0450 | ELO_WINS |
| 6 | 031ed268 | 0.7079 | 0.6788 | 0.0144 | 0.0388 | ELO_WINS |
| 7 | bb3adc40 | 0.7086 | 0.6786 | 0.0155 | 0.0413 | ELO_WINS |
| 8 | 3a58c200 | 0.7095 | 0.6788 | 0.0147 | 0.0382 | ELO_WINS |
| 9 | 1a52b080 | 0.7096 | 0.6798 | 0.0259 | 0.0271 | ELO_WINS |
| 10 | 3bb3d3e0 | 0.7096 | 0.6784 | 0.0146 | 0.0475 | ELO_WINS |

---

## Recommended Next Action

1. ⚠️ Elo outperforms RWPI on pure win prediction. Investigate:
   - tanhSaturationPoint: 32.0 — try values near 24-28
   - gameNoiseVariance: 0.520 — consider 0.35-0.45 range
2. Check that the replay engine is correctly applying opponentStrength from live S values.
3. Review the objective weights — stability/overreaction penalties may be overshadowing log loss.

---

*Report generated by Prophet RWP Oracle calibration pipeline.*
*See `docs/CALIBRATION_AND_BASELINES.md` for methodology details.*