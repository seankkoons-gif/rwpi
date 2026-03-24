import React from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ResponsiveContainer } from 'recharts'
import { ATTRIBUTION_BY_COMPONENT, S_q, S_o, LAMBDA, COMBINED_S } from '../data/simulation'

const C = {
  bg: '#050a14', panel: '#0a1428', border: '#162040',
  gold: '#f5a623', blue: '#4a90e2', green: '#2f9e44',
  red: '#e03131', purple: '#9b59b6', text: '#e8eaf0', dim: '#5a6a8a',
}

const fmt = (v: number) => (v >= 0 ? '+' : '') + v.toFixed(4)

// ── S_q drivers ───────────────────────────────────────────────────────────────
const sqDrivers = [
  { name: 'Game Performance', value: ATTRIBUTION_BY_COMPONENT.currentQuality.gamePerformance },
  { name: 'Point Diff Drag', value: ATTRIBUTION_BY_COMPONENT.currentQuality.pointDiffDrag },
  { name: 'Injuries (DL, OC)', value: ATTRIBUTION_BY_COMPONENT.currentQuality.injuries },
  { name: 'Market Odds Drag', value: ATTRIBUTION_BY_COMPONENT.currentQuality.marketOdds },
]

// ── S_o drivers ───────────────────────────────────────────────────────────────
const soDrivers = [
  { name: 'Harbaugh Hire', value: ATTRIBUTION_BY_COMPONENT.forwardOptionality.harbaughHire },
  { name: 'Draft Capital (#7)', value: ATTRIBUTION_BY_COMPONENT.forwardOptionality.draftCapital },
  { name: 'FA Roster Moves', value: ATTRIBUTION_BY_COMPONENT.forwardOptionality.rosterFA },
  { name: 'Analytics Projections', value: ATTRIBUTION_BY_COMPONENT.forwardOptionality.projections },
  { name: 'Sentiment Drag', value: ATTRIBUTION_BY_COMPONENT.forwardOptionality.sentimentNarrative },
]

const sqTotal = sqDrivers.reduce((a, d) => a + d.value, 0)
const soTotal = soDrivers.reduce((a, d) => a + d.value, 0)

const vDrivers = [
  { label: 'Offseason gap (81 days × 0.002/day)', value: 0.162, note: 'Process noise accumulation' },
  { label: 'Harbaugh regime change shock', value: 0.160, note: '+0.16 variance added at coaching reset' },
  { label: 'No fresh game observations', value: null, note: 'No in-season data since Jan 2026' },
]
const V_TOTAL = 0.301

function HorizBar({ label, value, maxAbs }: { label: string; value: number; maxAbs: number }) {
  const pct = (Math.abs(value) / maxAbs) * 100
  const isPos = value >= 0
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 12, color: C.text }}>{label}</span>
        <span style={{ fontSize: 12, fontFamily: 'monospace', color: isPos ? C.green : C.red, fontWeight: 700 }}>
          {fmt(value)}
        </span>
      </div>
      <div style={{ background: '#0a1428', borderRadius: 3, height: 8, overflow: 'hidden' }}>
        <div style={{
          width: `${Math.min(100, pct)}%`,
          height: '100%',
          background: isPos ? C.blue : C.red,
          borderRadius: 3,
          opacity: 0.9,
          transition: 'width 0.3s ease',
        }} />
      </div>
    </div>
  )
}

export default function AttributionSplitPanel() {
  const sqAbs = Math.max(...sqDrivers.map(d => Math.abs(d.value)))
  const soAbs = Math.max(...soDrivers.map(d => Math.abs(d.value)))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* S_q section */}
      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <div style={{
            fontSize: 11, fontWeight: 700, letterSpacing: 0.8,
            color: C.red, background: `${C.red}18`,
            border: `1px solid ${C.red}40`,
            borderRadius: 4, padding: '2px 8px',
          }}>S_q</div>
          <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>
            Drivers of Current Quality
          </span>
          <span style={{ marginLeft: 'auto', fontSize: 13, fontFamily: 'monospace', color: C.red, fontWeight: 700 }}>
            Total: {fmt(sqTotal)}
          </span>
        </div>
        <div style={{ fontSize: 11, color: C.dim, marginBottom: 16 }}>
          Backward-looking signals from the 2025 season
        </div>
        {sqDrivers.map((d, i) => (
          <HorizBar key={i} label={d.name} value={d.value} maxAbs={sqAbs} />
        ))}
        <div style={{ marginTop: 12, padding: '8px 12px', background: '#0d1e35', borderRadius: 6, fontSize: 11, color: C.dim }}>
          S_q = <span style={{ color: C.red, fontWeight: 700 }}>{S_q.toFixed(4)}</span> &nbsp;
          (baseline −0.15 + season damage ≈ {(S_q + 0.15).toFixed(4)})
        </div>
      </div>

      {/* S_o section */}
      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <div style={{
            fontSize: 11, fontWeight: 700, letterSpacing: 0.8,
            color: C.blue, background: `${C.blue}18`,
            border: `1px solid ${C.blue}40`,
            borderRadius: 4, padding: '2px 8px',
          }}>S_o</div>
          <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>
            Drivers of Forward Optionality
          </span>
          <span style={{ marginLeft: 'auto', fontSize: 13, fontFamily: 'monospace', color: C.blue, fontWeight: 700 }}>
            Total: {fmt(soTotal)}
          </span>
        </div>
        <div style={{ fontSize: 11, color: C.dim, marginBottom: 16 }}>
          Forward-looking signals: coaching, roster, draft capital, projections
        </div>
        {soDrivers.map((d, i) => (
          <HorizBar key={i} label={d.name} value={d.value} maxAbs={soAbs} />
        ))}
        <div style={{ marginTop: 12, padding: '8px 12px', background: '#0d1e35', borderRadius: 6, fontSize: 11, color: C.dim }}>
          S_o = <span style={{ color: C.blue, fontWeight: 700 }}>{S_o.toFixed(4)}</span> &nbsp;
          discounted by λ={LAMBDA} → effective contribution{' '}
          <span style={{ color: C.gold, fontWeight: 700 }}>+{(LAMBDA * S_o).toFixed(4)}</span>
        </div>
      </div>

      {/* V / Uncertainty section */}
      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <div style={{
            fontSize: 11, fontWeight: 700, letterSpacing: 0.8,
            color: C.gold, background: `${C.gold}18`,
            border: `1px solid ${C.gold}40`,
            borderRadius: 4, padding: '2px 8px',
          }}>U = √V</div>
          <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>
            Drivers of Uncertainty
          </span>
          <span style={{ marginLeft: 'auto', fontSize: 13, fontFamily: 'monospace', color: C.gold, fontWeight: 700 }}>
            V = {V_TOTAL.toFixed(3)}
          </span>
        </div>
        <div style={{ fontSize: 11, color: C.dim, marginBottom: 16 }}>
          Variance accumulation driving elevated U = {Math.sqrt(V_TOTAL).toFixed(3)}
        </div>
        {vDrivers.map((d, i) => (
          <div key={i} style={{
            padding: '12px 14px', marginBottom: 8,
            background: '#0d1e35', borderRadius: 6,
            borderLeft: `3px solid ${C.gold}`,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontSize: 12, color: C.text, fontWeight: 600 }}>{d.label}</span>
              {d.value !== null && (
                <span style={{ fontSize: 12, fontFamily: 'monospace', color: C.gold, fontWeight: 700 }}>
                  +{d.value.toFixed(3)} ΔV
                </span>
              )}
            </div>
            <div style={{ fontSize: 11, color: C.dim, marginTop: 3 }}>{d.note}</div>
          </div>
        ))}
        <div style={{ marginTop: 12, padding: '8px 12px', background: '#0d1e35', borderRadius: 6, fontSize: 11, color: C.dim }}>
          No in-season Kalman updates since Jan 2026 → V unable to compress. Next compression occurs when 2026 regular season begins.
        </div>
      </div>

      {/* Combined state summary */}
      <div style={{
        background: '#060d1c',
        border: `1px solid ${C.border}`,
        borderRadius: 8,
        padding: 20,
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.dim, letterSpacing: 0.8, marginBottom: 16 }}>
          COMBINED STATE EQUATION
        </div>
        <div style={{ fontSize: 14, color: C.text, lineHeight: 2, fontFamily: 'monospace' }}>
          <div>
            S<sub>combined</sub> = S<sub>q</sub> + λ × S<sub>o</sub>
          </div>
          <div style={{ paddingLeft: 20 }}>
            = <span style={{ color: C.red }}>{S_q.toFixed(4)}</span>
            {' + '}
            <span style={{ color: C.gold }}>{LAMBDA}</span>
            {' × '}
            <span style={{ color: C.blue }}>{S_o.toFixed(4)}</span>
          </div>
          <div style={{ paddingLeft: 20 }}>
            = <span style={{ color: C.red }}>{S_q.toFixed(4)}</span>
            {' + '}
            <span style={{ color: C.gold }}>{(LAMBDA * S_o).toFixed(4)}</span>
          </div>
          <div style={{ paddingLeft: 20, fontWeight: 800 }}>
            = <span style={{ color: C.text, fontSize: 18 }}>{COMBINED_S.toFixed(4)}</span>
          </div>
        </div>
        <div style={{ marginTop: 12, fontSize: 11, color: C.dim }}>
          λ = {LAMBDA} because forward optionality has not been realized on the field.
          S_o lifts the state but at a 25% discount until on-field validation occurs.
        </div>
      </div>
    </div>
  )
}
