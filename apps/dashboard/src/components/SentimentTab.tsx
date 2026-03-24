import React from 'react'
import { SENTIMENT_SNAPSHOTS } from '../data/simulation'

const C = {
  bg: '#050a14', panel: '#0a1428', border: '#162040',
  gold: '#f5a623', blue: '#4a90e2', green: '#2f9e44',
  red: '#e03131', purple: '#9b59b6', text: '#e8eaf0', dim: '#5a6a8a',
}

function SentimentGauge({ value }: { value: number }) {
  // SVG arc gauge from -1 to +1
  const r = 80
  const cx = 120, cy = 110
  const startAngle = 210 // degrees (left)
  const endAngle = -30   // degrees (right)
  const totalArc = 240   // degrees

  function polarToXY(angle: number, radius: number) {
    const rad = (angle * Math.PI) / 180
    return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) }
  }

  function arcPath(start: number, end: number, radius: number) {
    const s = polarToXY(start, radius)
    const e = polarToXY(end, radius)
    const large = Math.abs(end - start) > 180 ? 1 : 0
    return `M ${s.x} ${s.y} A ${radius} ${radius} 0 ${large} 0 ${e.x} ${e.y}`
  }

  // Convert value [-1,1] → angle
  const valNorm = (value + 1) / 2 // 0 to 1
  const needleAngle = startAngle - valNorm * totalArc
  const needle = polarToXY(needleAngle, r - 10)
  const color = value > 0.2 ? C.green : value < -0.2 ? C.red : C.gold

  return (
    <svg width={240} height={140} style={{ display: 'block', margin: '0 auto' }}>
      {/* Background track */}
      <path d={arcPath(startAngle, startAngle - totalArc, r)} fill="none" stroke={C.border} strokeWidth={14} />
      {/* Negative zone */}
      <path d={arcPath(startAngle, startAngle - totalArc * 0.5, r)} fill="none" stroke={C.red} strokeWidth={14} opacity={0.25} />
      {/* Positive zone */}
      <path d={arcPath(startAngle - totalArc * 0.5, startAngle - totalArc, r)} fill="none" stroke={C.green} strokeWidth={14} opacity={0.25} />
      {/* Value arc */}
      <path
        d={arcPath(startAngle, startAngle - valNorm * totalArc, r)}
        fill="none" stroke={color} strokeWidth={14} strokeLinecap="round"
      />
      {/* Needle */}
      <line
        x1={cx} y1={cy}
        x2={needle.x} y2={needle.y}
        stroke={C.text} strokeWidth={2.5} strokeLinecap="round"
      />
      <circle cx={cx} cy={cy} r={5} fill={C.text} />
      {/* Labels */}
      <text x={30} y={cy + 20} fill={C.red} fontSize={11} textAnchor="middle">-1.0</text>
      <text x={cx} y={cy - r - 16} fill={C.dim} fontSize={11} textAnchor="middle">0</text>
      <text x={210} y={cy + 20} fill={C.green} fontSize={11} textAnchor="middle">+1.0</text>
      {/* Value display */}
      <text x={cx} y={cy + 22} fill={color} fontSize={22} fontWeight="800" textAnchor="middle">
        {value >= 0 ? '+' : ''}{value.toFixed(2)}
      </text>
      <text x={cx} y={cy + 36} fill={C.dim} fontSize={10} textAnchor="middle">OVERALL SENTIMENT</text>
    </svg>
  )
}

function SentimentBar({ label, value, color }: { label: string; value: number; color: string }) {
  const pct = ((value + 1) / 2 * 100)
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12 }}>
        <span style={{ color: C.dim }}>{label}</span>
        <span style={{ color, fontWeight: 700 }}>{value >= 0 ? '+' : ''}{value.toFixed(2)}</span>
      </div>
      <div style={{ background: C.border, borderRadius: 4, height: 8, position: 'relative' }}>
        <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: C.dim }} />
        <div style={{
          position: 'absolute',
          left: value >= 0 ? '50%' : `${pct}%`,
          width: `${Math.abs(value) * 50}%`,
          height: '100%',
          background: color,
          borderRadius: 4,
        }} />
      </div>
    </div>
  )
}

export default function SentimentTab() {
  const latest = SENTIMENT_SNAPSHOTS[SENTIMENT_SNAPSHOTS.length - 1]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Gauge + components */}
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
        <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: 24, flex: '1 1 280px', minWidth: 260 }}>
          <div style={{ fontSize: 12, color: C.dim, fontWeight: 600, letterSpacing: 0.8, marginBottom: 16 }}>CURRENT SENTIMENT GAUGE</div>
          <SentimentGauge value={latest.overall} />
          <div style={{ textAlign: 'center', marginTop: 8, fontSize: 12, color: C.dim }}>
            {latest.label} · Dispersion: {(latest.dispersion * 100).toFixed(0)}%
          </div>
        </div>
        <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: 24, flex: '1 1 280px', minWidth: 260 }}>
          <div style={{ fontSize: 12, color: C.dim, fontWeight: 600, letterSpacing: 0.8, marginBottom: 20 }}>COMPONENT BREAKDOWN</div>
          <SentimentBar label="Beat Reporter" value={latest.beatReporter} color={C.blue} />
          <SentimentBar label="National Media" value={latest.nationalMedia} color={C.purple} />
          <SentimentBar label="Fan Sentiment" value={latest.fanSentiment} color={C.gold} />
          <SentimentBar label="Momentum" value={latest.momentum} color={C.green} />
          <div style={{ marginTop: 16, padding: 12, background: '#0d1e35', borderRadius: 6, fontSize: 12, color: C.dim }}>
            <strong style={{ color: C.text }}>Composite:</strong> BR×0.35 + NM×0.25 + Fan×0.20 + Mom×0.20
          </div>
        </div>
      </div>

      {/* Events timeline */}
      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: 20 }}>
        <div style={{ fontSize: 12, color: C.dim, fontWeight: 600, letterSpacing: 0.8, marginBottom: 16 }}>
          SENTIMENT EVENTS TIMELINE
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {SENTIMENT_SNAPSHOTS.map((s, i) => {
            const color = s.overall > 0.1 ? C.green : s.overall < -0.1 ? C.red : C.gold
            return (
              <div key={i} style={{ display: 'flex', gap: 16, position: 'relative', paddingBottom: 20 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 32 }}>
                  <div style={{
                    width: 14, height: 14, borderRadius: '50%', background: color,
                    border: `2px solid ${C.panel}`, zIndex: 1, marginTop: 2, flexShrink: 0,
                  }} />
                  {i < SENTIMENT_SNAPSHOTS.length - 1 && (
                    <div style={{ width: 1, flex: 1, background: C.border, marginTop: 4 }} />
                  )}
                </div>
                <div style={{ flex: 1, paddingTop: 0 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{s.label}</span>
                    <span style={{ fontSize: 11, color: C.dim }}>Week {s.week}</span>
                    {s.headlineShock && (
                      <span style={{
                        background: C.red + '33', color: C.red,
                        border: `1px solid ${C.red}66`, borderRadius: 3,
                        padding: '1px 6px', fontSize: 10, fontWeight: 700,
                      }}>⚡ SHOCK</span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: C.dim, display: 'flex', gap: 16 }}>
                    <span style={{ color }}>Overall: {s.overall >= 0 ? '+' : ''}{s.overall.toFixed(2)}</span>
                    <span>Beat: {s.beatReporter >= 0 ? '+' : ''}{s.beatReporter.toFixed(2)}</span>
                    <span>Fan: {s.fanSentiment >= 0 ? '+' : ''}{s.fanSentiment.toFixed(2)}</span>
                    <span>Dispersion: {(s.dispersion * 100).toFixed(0)}%</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Dispersion indicator */}
      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: 20 }}>
        <div style={{ fontSize: 12, color: C.dim, fontWeight: 600, letterSpacing: 0.8, marginBottom: 12 }}>
          DISPERSION BY EVENT (LOW = CONSENSUS)
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
          {SENTIMENT_SNAPSHOTS.map((s, i) => (
            <div key={i} style={{ flex: 1, textAlign: 'center' }}>
              <div style={{
                background: C.purple,
                height: Math.round(s.dispersion * 100) + 'px',
                borderRadius: '4px 4px 0 0',
                opacity: 0.4 + s.dispersion * 0.6,
                marginBottom: 4,
              }} />
              <div style={{ fontSize: 10, color: C.dim }}>{(s.dispersion * 100).toFixed(0)}%</div>
              <div style={{ fontSize: 10, color: C.dim, marginTop: 2 }}>W{s.week}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
