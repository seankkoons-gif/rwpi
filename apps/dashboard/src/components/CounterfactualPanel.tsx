import React, { useState, useMemo } from 'react'

const C = {
  bg: '#050a14', panel: '#0a1428', border: '#162040',
  gold: '#f5a623', blue: '#4a90e2', green: '#2f9e44',
  red: '#e03131', purple: '#9b59b6', text: '#e8eaf0', dim: '#5a6a8a',
}

const DEFAULTS = {
  Sq: -0.2625,
  So: 0.0690,
  V: 0.3008,
  lambda: 0.75,
  alpha: 0.35,
  beta: 0.40,
  P0: 100,
}

function calcPrice(Sq: number, So: number, V: number): number {
  const S = Sq + DEFAULTS.lambda * So
  const raw = DEFAULTS.P0 * Math.exp(DEFAULTS.alpha * S - 0.5 * DEFAULTS.beta * V)
  return Math.max(DEFAULTS.P0 * 0.05, Math.min(DEFAULTS.P0 * 6.0, raw))
}

const BASE_PRICE = calcPrice(DEFAULTS.Sq, DEFAULTS.So, DEFAULTS.V)
const BASE_LAUNCH = 100
const BASE_CHANGE_PCT = ((BASE_PRICE - BASE_LAUNCH) / BASE_LAUNCH * 100)

interface Toggle {
  id: string
  label: string
  desc: string
  sqDelta: number
  soDelta: number
  group: string
  defaultOn: boolean
}

interface SliderConfig {
  id: string
  label: string
  desc: string
  group: string
  min: number
  max: number
  step: number
  defaultVal: number
  // given pick number, returns soDelta
  calcSoDelta: (pick: number) => number
}

const TOGGLES: Toggle[] = [
  // Group 1: Remove events
  {
    id: 'no_harbaugh',
    label: 'Remove Harbaugh hire',
    desc: 'Remove +0.072 S_o from coaching upgrade',
    sqDelta: 0,
    soDelta: -0.072,
    group: 'remove',
    defaultOn: false,
  },
  {
    id: 'no_fa',
    label: 'Remove FA moves',
    desc: 'Remove +0.022 S_o from free agency signings',
    sqDelta: 0,
    soDelta: -0.022,
    group: 'remove',
    defaultOn: false,
  },
  {
    id: 'no_dl_inj',
    label: 'Remove Dexter Lawrence injury',
    desc: 'Restore −0.031 damage to S_q (DL stays healthy)',
    sqDelta: +0.031,
    soDelta: 0,
    group: 'remove',
    defaultOn: false,
  },
  {
    id: 'no_draft',
    label: 'Remove draft capital (#7)',
    desc: 'Remove +0.023 S_o from top-10 pick value',
    sqDelta: 0,
    soDelta: -0.023,
    group: 'remove',
    defaultOn: false,
  },
  // Group 2: Upgrades
  {
    id: 'elite_qb',
    label: 'Elite QB signed',
    desc: 'Add +0.080 S_o (QB transforms franchise ceiling)',
    sqDelta: +0.010,
    soDelta: +0.080,
    group: 'upgrade',
    defaultOn: false,
  },
  // Group 3: Season replay
  {
    id: 'better_season',
    label: 'What if 2025 was 7–10?',
    desc: 'Add +0.050 S_q (competent season reduces damage)',
    sqDelta: +0.050,
    soDelta: 0,
    group: 'replay',
    defaultOn: false,
  },
  {
    id: 'worse_season',
    label: 'What if 2025 was 2–15?',
    desc: 'Subtract −0.040 S_q (deeper damage, higher pick)',
    sqDelta: -0.040,
    soDelta: 0,
    group: 'replay',
    defaultOn: false,
  },
]

const DRAFT_SLIDER: SliderConfig = {
  id: 'draft_position',
  label: 'Draft pick position',
  desc: 'Adjust #7 pick value (lower pick # = more optionality)',
  group: 'upgrade',
  min: 1,
  max: 32,
  step: 1,
  defaultVal: 7,
  calcSoDelta: (pick: number) => {
    // #1-5: extra S_o, #15-20: less, #7 (current) = 0 delta
    if (pick <= 5) return +(0.023 + (7 - pick) * 0.005).toFixed(4)
    if (pick >= 15) return -(0.023 - (15 - pick) * 0.003).toFixed(4) // wait this gets weird
    return +(0.023 - (pick - 7) * 0.003).toFixed(4)
  },
}

function pickDraftDelta(pick: number): number {
  // Current default is pick #7 = +0.023
  // Lower pick (1) = more value, higher pick (20+) = less value
  const BASE_AT_7 = 0.023
  if (pick < 7) return BASE_AT_7 + (7 - pick) * 0.005
  if (pick > 7) return Math.max(0, BASE_AT_7 - (pick - 7) * 0.003)
  return BASE_AT_7
}

function groupLabel(group: string): string {
  const labels: Record<string, string> = {
    remove: 'Remove Events',
    upgrade: 'Upgrade Scenarios',
    replay: 'Season Replay',
  }
  return labels[group] ?? group
}

function DeltaBadge({ value }: { value: number }) {
  if (Math.abs(value) < 0.0001) return <span style={{ color: C.dim }}>—</span>
  const color = value > 0 ? C.green : C.red
  return (
    <span style={{ color, fontFamily: 'monospace', fontWeight: 700, fontSize: 11 }}>
      {value > 0 ? '+' : ''}{value.toFixed(4)}
    </span>
  )
}

function Toggle({ id, label, desc, active, onChange }: {
  id: string; label: string; desc: string; active: boolean; onChange: (v: boolean) => void
}) {
  return (
    <div
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 12,
        padding: '10px 12px', borderRadius: 6,
        background: active ? '#0d1e35' : '#070e1c',
        border: `1px solid ${active ? C.blue + '60' : C.border}`,
        cursor: 'pointer',
        transition: 'all 0.15s',
      }}
      onClick={() => onChange(!active)}
    >
      {/* Toggle switch */}
      <div style={{
        width: 34, height: 18, borderRadius: 9,
        background: active ? C.blue : '#1a2a3a',
        position: 'relative', flexShrink: 0, marginTop: 2,
        transition: 'background 0.15s',
        cursor: 'pointer',
        border: `1px solid ${active ? C.blue : C.border}`,
      }}>
        <div style={{
          width: 12, height: 12, borderRadius: '50%',
          background: active ? '#fff' : C.dim,
          position: 'absolute', top: 2,
          left: active ? 18 : 2,
          transition: 'left 0.15s',
        }} />
      </div>
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: active ? C.text : C.dim }}>{label}</div>
        <div style={{ fontSize: 11, color: C.dim, marginTop: 2 }}>{desc}</div>
      </div>
    </div>
  )
}

function ResultRow({
  label, base, adjusted, unit = '', color
}: {
  label: string; base: number; adjusted: number; unit?: string; color?: string
}) {
  const delta = adjusted - base
  const isUp = delta > 0
  const hasChange = Math.abs(delta) > 0.001

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '10px 0', borderBottom: `1px solid ${C.border}30`,
      flexWrap: 'wrap',
    }}>
      <div style={{ minWidth: 200, fontSize: 12, color: C.dim }}>{label}</div>
      <div style={{ fontSize: 14, fontFamily: 'monospace', color: color ?? C.text, fontWeight: 700 }}>
        {unit}{base.toFixed(unit === '$' ? 2 : 3)}
      </div>
      {hasChange && (
        <>
          <div style={{ color: C.dim, fontSize: 14 }}>→</div>
          <div style={{
            fontSize: 14, fontFamily: 'monospace',
            color: isUp ? C.green : C.red,
            fontWeight: 700,
          }}>
            {unit}{adjusted.toFixed(unit === '$' ? 2 : 3)}
          </div>
          <div style={{
            fontSize: 11, fontFamily: 'monospace',
            color: isUp ? C.green : C.red,
            background: isUp ? `${C.green}15` : `${C.red}15`,
            border: `1px solid ${isUp ? C.green : C.red}30`,
            borderRadius: 4, padding: '1px 6px',
          }}>
            {isUp ? '+' : ''}{delta.toFixed(unit === '$' ? 2 : 3)} {unit === '$' ? '' : ''}
          </div>
        </>
      )}
    </div>
  )
}

export default function CounterfactualPanel() {
  const [active, setActive] = useState<Set<string>>(new Set())
  const [draftPick, setDraftPick] = useState(7)

  const toggleId = (id: string, val: boolean) => {
    setActive(prev => {
      const next = new Set(prev)
      if (val) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const { adjSq, adjSo, adjV, adjPrice, adjChangePct, adjS } = useMemo(() => {
    let deltaSq = 0
    let deltaSo = 0

    for (const t of TOGGLES) {
      if (active.has(t.id)) {
        deltaSq += t.sqDelta
        deltaSo += t.soDelta
      }
    }

    // Draft pick slider
    const draftDeltaSo = pickDraftDelta(draftPick) - 0.023  // delta vs default
    deltaSo += draftDeltaSo

    const sq = +(DEFAULTS.Sq + deltaSq).toFixed(4)
    const so = +(DEFAULTS.So + deltaSo).toFixed(4)
    const v = DEFAULTS.V  // V not modified by these scenarios
    const price = calcPrice(sq, so, v)
    const s = sq + DEFAULTS.lambda * so
    const changePct = ((price - BASE_LAUNCH) / BASE_LAUNCH * 100)

    return {
      adjSq: sq,
      adjSo: so,
      adjV: v,
      adjPrice: price,
      adjS: s,
      adjChangePct: changePct,
    }
  }, [active, draftPick])

  const groups = ['remove', 'upgrade', 'replay']

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: 20 }}>
        <div style={{ fontSize: 12, color: C.gold, fontWeight: 700, letterSpacing: 0.8, marginBottom: 4 }}>
          COUNTERFACTUAL EXPLORER
        </div>
        <div style={{ fontSize: 12, color: C.dim, lineHeight: 1.6 }}>
          Toggle events on/off to see how the oracle state and fair price would change.
          All calculations use the three-component model:{' '}
          <span style={{ color: C.text }}>S = S_q + λ × S_o</span>,{' '}
          <span style={{ color: C.text }}>P = P₀ × exp(α·S − ½β·V)</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        {/* Controls */}
        <div style={{ flex: '1 1 380px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {groups.map(group => (
            <div key={group} style={{
              background: C.panel, border: `1px solid ${C.border}`,
              borderRadius: 8, padding: 16,
            }}>
              <div style={{
                fontSize: 10, fontWeight: 700, letterSpacing: 1,
                color: C.dim, marginBottom: 12,
              }}>
                {groupLabel(group).toUpperCase()}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {TOGGLES.filter(t => t.group === group).map(t => (
                  <Toggle
                    key={t.id}
                    id={t.id}
                    label={t.label}
                    desc={t.desc}
                    active={active.has(t.id)}
                    onChange={v => toggleId(t.id, v)}
                  />
                ))}
                {group === 'upgrade' && (
                  <div style={{
                    padding: '10px 12px', borderRadius: 6,
                    background: '#070e1c', border: `1px solid ${C.border}`,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>
                          Draft pick position: #{draftPick}
                        </div>
                        <div style={{ fontSize: 11, color: C.dim, marginTop: 2 }}>
                          {draftPick <= 5 ? 'Top-5 pick — high optionality premium'
                            : draftPick <= 10 ? 'Top-10 pick — solid option value'
                            : draftPick <= 20 ? 'Mid-first — modest option value'
                            : 'Late first — minimal option value'}
                        </div>
                      </div>
                      <span style={{
                        fontSize: 12, fontFamily: 'monospace',
                        color: C.blue, fontWeight: 700, alignSelf: 'flex-start',
                      }}>
                        S_o Δ: {(pickDraftDelta(draftPick) - 0.023) >= 0 ? '+' : ''}{(pickDraftDelta(draftPick) - 0.023).toFixed(4)}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={32}
                      step={1}
                      value={draftPick}
                      onChange={e => setDraftPick(+e.target.value)}
                      style={{ width: '100%', accentColor: C.blue, cursor: 'pointer' }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: C.dim, marginTop: 2 }}>
                      <span>#1 (most)</span>
                      <span>#32 (least)</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Reset */}
          {active.size > 0 || draftPick !== 7 ? (
            <button
              onClick={() => { setActive(new Set()); setDraftPick(7) }}
              style={{
                background: 'none', border: `1px solid ${C.border}`,
                borderRadius: 6, padding: '8px 16px',
                color: C.dim, fontSize: 12, cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              ↺ Reset to defaults
            </button>
          ) : null}
        </div>

        {/* Live output */}
        <div style={{ flex: '1 1 340px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{
            background: C.panel,
            border: `2px solid ${adjPrice > BASE_PRICE ? C.green + '60' : adjPrice < BASE_PRICE ? C.red + '60' : C.border}`,
            borderRadius: 8,
            padding: 20,
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: C.dim, marginBottom: 16 }}>
              LIVE STATE OUTPUT
            </div>

            <div style={{ marginBottom: 20 }}>
              <ResultRow
                label="Current Quality (S_q)"
                base={DEFAULTS.Sq}
                adjusted={adjSq}
                color={adjSq < 0 ? C.red : C.green}
              />
              <ResultRow
                label="Forward Optionality (S_o)"
                base={DEFAULTS.So}
                adjusted={adjSo}
                color={C.blue}
              />
              <ResultRow
                label="Combined S"
                base={DEFAULTS.Sq + DEFAULTS.lambda * DEFAULTS.So}
                adjusted={adjS}
              />
            </div>

            {/* Price display */}
            <div style={{
              background: '#060d1c',
              borderRadius: 8,
              padding: '16px 20px',
              border: `1px solid ${C.border}`,
              textAlign: 'center',
            }}>
              <div style={{ fontSize: 10, color: C.dim, fontWeight: 600, letterSpacing: 0.8, marginBottom: 8 }}>
                FAIR PRICE
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 24, fontWeight: 900, color: C.dim, textDecoration: 'line-through' }}>
                  ${BASE_PRICE.toFixed(2)}
                </span>
                {Math.abs(adjPrice - BASE_PRICE) > 0.01 && (
                  <>
                    <span style={{ fontSize: 18, color: C.dim }}>→</span>
                    <span style={{ fontSize: 32, fontWeight: 900, color: adjPrice > BASE_PRICE ? C.green : C.red }}>
                      ${adjPrice.toFixed(2)}
                    </span>
                  </>
                )}
                {Math.abs(adjPrice - BASE_PRICE) <= 0.01 && (
                  <span style={{ fontSize: 32, fontWeight: 900, color: C.gold }}>
                    ${adjPrice.toFixed(2)}
                  </span>
                )}
              </div>
              {Math.abs(adjPrice - BASE_PRICE) > 0.01 && (
                <div style={{
                  marginTop: 6, fontSize: 14, fontWeight: 700,
                  color: adjPrice > BASE_PRICE ? C.green : C.red,
                }}>
                  {adjPrice > BASE_PRICE ? '+' : ''}${(adjPrice - BASE_PRICE).toFixed(2)}
                  {' '}({adjPrice > BASE_PRICE ? '+' : ''}{(adjChangePct - BASE_CHANGE_PCT).toFixed(1)} ppt)
                </div>
              )}
              <div style={{ marginTop: 8, fontSize: 12, color: C.dim }}>
                {adjChangePct >= 0 ? '+' : ''}{adjChangePct.toFixed(1)}% from $100 launch
              </div>
            </div>

            {/* Active scenario summary */}
            {(active.size > 0 || draftPick !== 7) && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: C.dim, letterSpacing: 0.8, marginBottom: 8 }}>
                  ACTIVE SCENARIOS
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {TOGGLES.filter(t => active.has(t.id)).map(t => (
                    <div key={t.id} style={{
                      fontSize: 11, color: C.text,
                      padding: '4px 8px', borderRadius: 4,
                      background: '#0d1e35',
                      display: 'flex', justifyContent: 'space-between',
                    }}>
                      <span>{t.label}</span>
                      <span style={{ fontFamily: 'monospace', color: C.blue }}>
                        {t.sqDelta !== 0 ? `S_q ${t.sqDelta > 0 ? '+' : ''}${t.sqDelta.toFixed(3)}` : ''}
                        {t.sqDelta !== 0 && t.soDelta !== 0 ? ' · ' : ''}
                        {t.soDelta !== 0 ? `S_o ${t.soDelta > 0 ? '+' : ''}${t.soDelta.toFixed(3)}` : ''}
                      </span>
                    </div>
                  ))}
                  {draftPick !== 7 && (
                    <div style={{
                      fontSize: 11, color: C.text,
                      padding: '4px 8px', borderRadius: 4,
                      background: '#0d1e35',
                      display: 'flex', justifyContent: 'space-between',
                    }}>
                      <span>Draft pick #{draftPick}</span>
                      <span style={{ fontFamily: 'monospace', color: C.blue }}>
                        S_o {(pickDraftDelta(draftPick) - 0.023) >= 0 ? '+' : ''}{(pickDraftDelta(draftPick) - 0.023).toFixed(3)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Model parameters */}
          <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.dim, letterSpacing: 0.8, marginBottom: 10 }}>
              MODEL PARAMETERS (FIXED)
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 11 }}>
              {[
                { label: 'λ (optionality discount)', value: DEFAULTS.lambda },
                { label: 'α (price sensitivity)', value: DEFAULTS.alpha },
                { label: 'β (variance drag)', value: DEFAULTS.beta },
                { label: 'V (uncertainty)', value: DEFAULTS.V },
                { label: 'P₀ (launch price)', value: `$${DEFAULTS.P0}` },
              ].map((p, i) => (
                <div key={i} style={{ padding: '6px 8px', background: '#060d1c', borderRadius: 4 }}>
                  <div style={{ color: C.dim, fontSize: 10 }}>{p.label}</div>
                  <div style={{ color: C.gold, fontFamily: 'monospace', fontWeight: 700 }}>{p.value}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 12, fontSize: 11, color: C.dim, lineHeight: 1.6 }}>
              <strong style={{ color: C.text }}>Formula:</strong>{' '}
              P = P₀ × exp(α × S − ½β × V) where S = S_q + λ × S_o
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
