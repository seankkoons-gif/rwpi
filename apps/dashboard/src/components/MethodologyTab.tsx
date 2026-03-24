import React from 'react'

const C = {
  bg: '#050a14', panel: '#0a1428', border: '#162040',
  gold: '#f5a623', blue: '#4a90e2', green: '#2f9e44',
  red: '#e03131', purple: '#9b59b6', text: '#e8eaf0', dim: '#5a6a8a',
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: 24, marginBottom: 16 }}>
      <h3 style={{ color: C.gold, fontSize: 16, fontWeight: 800, marginBottom: 14 }}>{title}</h3>
      <div style={{ color: C.text, lineHeight: 1.8, fontSize: 14 }}>{children}</div>
    </div>
  )
}

function Math({ children }: { children: string }) {
  return (
    <span style={{
      fontFamily: 'monospace', background: '#0d1e35',
      padding: '2px 8px', borderRadius: 4, color: C.gold, fontSize: 13,
    }}>{children}</span>
  )
}

function Block({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontFamily: 'monospace', background: '#0d1e35', border: `1px solid ${C.border}`,
      borderRadius: 6, padding: '16px 20px', margin: '12px 0', fontSize: 13,
      lineHeight: 2.0, color: C.text,
    }}>{children}</div>
  )
}

function P({ children }: { children: React.ReactNode }) {
  return <p style={{ marginBottom: 12 }}>{children}</p>
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
      <span style={{ color: C.gold, flexShrink: 0 }}>▸</span>
      <span>{children}</span>
    </div>
  )
}

export default function MethodologyTab() {
  return (
    <div style={{ maxWidth: 820 }}>
      <Section title="What is RWP Oracle?">
        <P>
          The <strong>Real-World Performance (RWP) Oracle</strong> is a state-space pricing engine that
          continuously estimates the latent competitive strength of an NFL team and converts it into a
          tradeable synthetic asset price. It is not a prediction market or sportsbook — it does not
          require any counterparty to take the opposite side of a prediction. Instead, it operates like
          a perpetual futures contract whose underlying is a model-derived performance index.
        </P>
        <P>
          Every observable event — game results, player injuries, market odds, fan sentiment — enters
          the engine as a noisy observation with a calibrated confidence level. A Kalman filter fuses
          these observations with a Bayesian prior and continuously updates the latent strength
          estimate <Math>S</Math> and its variance <Math>V</Math>. The oracle price is a smooth,
          bounded, exponential function of these two quantities.
        </P>
        <P>
          The result is an asset whose price reflects collective information about team quality,
          not just single-game outcomes. A blowout loss moves the price down; a streak of wins,
          a marquee free-agent signing, or strong market odds consensus all contribute positive
          information. The system is transparent, auditable, and reproducible from first principles.
        </P>
      </Section>

      <Section title="The Math: S, V, U">
        <P>
          The engine maintains a hidden state representing team strength on a league-normalized scale
          where <Math>S = 0</Math> is precisely league average:
        </P>
        <Block>
          <div><span style={{ color: C.dim }}>// State variables</span></div>
          <div>S ∈ ℝ         <span style={{ color: C.dim }}>// latent strength (0 = league avg)</span></div>
          <div>V {'>'} 0        <span style={{ color: C.dim }}>// posterior variance</span></div>
          <div>U = √V        <span style={{ color: C.dim }}>// uncertainty (standard deviation)</span></div>
          <div></div>
          <div><span style={{ color: C.dim }}>// Process model: strength diffuses over time</span></div>
          <div>V_t = V_{'t-1'} + σ_process × Δdays</div>
          <div><span style={{ color: C.dim }}>(σ_process = 0.002 per day)</span></div>
        </Block>
        <P>
          Between games, <Math>V</Math> increases (knowledge decays). Each new observation reduces
          it (via the Kalman gain). In the offseason, <Math>S</Math> mean-reverts toward zero at
          0.15% per day and <Math>V</Math> grows at 0.3% per day, reflecting information staleness.
        </P>
      </Section>

      <Section title="Price Transform">
        <P>
          The fair price is a log-linear function of the state, inspired by options pricing theory.
          A team at league average (<Math>S=0</Math>) with full uncertainty (<Math>V=V₀</Math>)
          anchors at the launch price <Math>P₀</Math>:
        </P>
        <Block>
          <div style={{ color: C.gold }}>P_fair = P₀ × exp(α × S − ½ × β × V)</div>
          <div></div>
          <div><span style={{ color: C.dim }}>where:</span></div>
          <div>P₀ = $100.00   <span style={{ color: C.dim }}>// launch anchor</span></div>
          <div>α  = 0.30      <span style={{ color: C.dim }}>// strength sensitivity</span></div>
          <div>β  = 0.40      <span style={{ color: C.dim }}>// variance penalty (uncertainty discount)</span></div>
          <div>S₀ = −0.15     <span style={{ color: C.dim }}>// Giants start slightly below average</span></div>
          <div>V₀ = 0.60      <span style={{ color: C.dim }}>// initial uncertainty</span></div>
          <div></div>
          <div>P_launch = 100 × exp(0.30×(−0.15) − 0.5×0.40×0.60) = $88.25</div>
          <div></div>
          <div>Bounds: [P₀ × 0.05, P₀ × 6.0]  <span style={{ color: C.dim }}>// hard floor/ceiling</span></div>
        </Block>
        <P>
          The <em>variance penalty</em> (−½βV) means a more uncertain team trades at a discount — 
          reflecting the risk premium demanded by traders. As information accumulates, V falls,
          the penalty shrinks, and price rises for a given S.
        </P>
        <P>
          The <strong>mark price</strong> tracks fair price with an 8% band and 30% mean reversion
          per update — dampening manipulation and sudden noise spikes.
        </P>
      </Section>

      <Section title="Kalman Update">
        <P>
          Each observation <Math>z</Math> (the "observed strength" implied by a signal source)
          updates the state via the Kalman update equations:
        </P>
        <Block>
          <div style={{ color: C.gold }}>K = V / (V + R)           <span style={{ color: C.dim }}>// Kalman gain</span></div>
          <div style={{ color: C.gold }}>S* = S + K × (z − S)      <span style={{ color: C.dim }}>// posterior mean</span></div>
          <div style={{ color: C.gold }}>V* = (1 − K) × V          <span style={{ color: C.dim }}>// posterior variance</span></div>
          <div></div>
          <div><span style={{ color: C.dim }}>where R = noiseVariance / (confidence × recencyWeight)</span></div>
          <div></div>
          <div><span style={{ color: C.dim }}>// High confidence observation: K → 1 (belief update large)</span></div>
          <div><span style={{ color: C.dim }}>// Low confidence observation: K → 0 (prior dominates)</span></div>
        </Block>
        <P>
          Observations are processed in order of descending confidence. The residual
          <Math>(z − S)</Math> captures how surprising the signal was; a blowout loss when the
          team is thought strong produces a large negative residual and a sharp S downgrade.
        </P>
      </Section>

      <Section title="Funding Formula">
        <P>All four components are annualized rates. Positive = longs pay shorts; negative = shorts pay longs.</P>
        <Block>
          <div style={{ color: C.gold }}>r_total = r_base + r_imbalance + r_uncertainty + r_basis</div>
          <div></div>
          <div>r_base        = 0.05</div>
          <div>               <span style={{ color: C.dim }}>Baseline 5% to compensate liquidity providers</span></div>
          <div></div>
          <div>r_imbalance   = 0.20 × (longOI − shortOI) / totalOI</div>
          <div>               <span style={{ color: C.dim }}>Restores balance when one side dominates</span></div>
          <div></div>
          <div>r_uncertainty = 0.10 × U</div>
          <div>               <span style={{ color: C.dim }}>Higher U = more volatile = higher carry</span></div>
          <div></div>
          <div>r_basis       = 0.15 × (markPrice − fairPrice) / fairPrice</div>
          <div>               <span style={{ color: C.dim }}>Pushes mark toward fair over time</span></div>
          <div></div>
          <div>Clamp: [−60%, +60%] annualized</div>
        </Block>
      </Section>

      <Section title="Why Not a Prediction Market">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Bullet>
            <strong>No binary outcomes.</strong> Prediction markets resolve at 0 or 1 on a specific event.
            RWP Oracle is a continuous, evergreen asset — it never expires, never resolves, and captures
            the full arc of a team's multi-year trajectory.
          </Bullet>
          <Bullet>
            <strong>No counterparty matching.</strong> Prediction markets require someone to take the opposite
            side of every bet. Perpetuals use a funding mechanism to balance longs and shorts without
            event-specific counterparties. This enables deep liquidity at any time.
          </Bullet>
          <Bullet>
            <strong>State is model-derived, not crowd-voted.</strong> Prediction market prices are pure
            aggregated opinion. RWP oracle prices emerge from a principled Bayesian state-space model
            that fuses heterogeneous signals with explicit noise variances and decay functions.
          </Bullet>
          <Bullet>
            <strong>Risk is regime-aware.</strong> Prediction markets have static payoffs. This engine
            dynamically adjusts leverage caps, margin requirements, and funding rates based on the
            current uncertainty regime — providing a structured risk framework that prediction markets lack.
          </Bullet>
        </div>
      </Section>

      <Section title="Launch Anchor Rationale">
        <P>
          The launch parameters for NY Giants 2024 were chosen to reflect honest priors at season kickoff:
        </P>
        <Block>
          <div>S₀ = −0.15  <span style={{ color: C.dim }}>// Coming off 6-11 in 2023; Daboll year 3; slight below-avg prior</span></div>
          <div>V₀ =  0.60  <span style={{ color: C.dim }}>// High preseason uncertainty; no preseason signal incorporated yet</span></div>
          <div>P₀ = $100   <span style={{ color: C.dim }}>// Clean anchor; launch price ≠ fair price (fair ≈ $88 due to S₀, V₀)</span></div>
        </Block>
        <P>
          The $100 <em>launch price</em> is a reference anchor, not a fair value claim. The actual
          fair price at launch, given S₀ and V₀, computes to approximately $88.25. Traders who believe
          the Giants will outperform the prior go long; those who believe the prior is too generous go short.
          The system updates continuously from there.
        </P>
      </Section>
    </div>
  )
}
