import React from 'react'
import { CURRENT_STATE, LAUNCH_CONFIG, OFFSEASON_STATE, S_q, S_o, LAMBDA, COMBINED_S } from '../data/simulation'

const C = {
  bg: '#050a14', panel: '#0a1428', border: '#162040',
  gold: '#f5a623', blue: '#4a90e2', green: '#2f9e44',
  red: '#e03131', purple: '#9b59b6', text: '#e8eaf0', dim: '#5a6a8a',
}

export default function StateTriadPanel() {
  const changePct = ((CURRENT_STATE.markPrice - LAUNCH_CONFIG.launchPrice) / LAUNCH_CONFIG.launchPrice * 100)
  const U = OFFSEASON_STATE.U

  const columns = [
    {
      title: 'Current Quality',
      subtitle: 'S\u2071',
      value: S_q,
      display: S_q.toFixed(3),
      color: S_q < 0 ? C.red : C.green,
      sign: S_q >= 0 ? '+' : '',
      desc1: '4-13, bad defense,',
      desc2: 'injuries & odds drag',
      desc3: '',
      tag: 'S_q',
    },
    {
      title: 'Forward Optionality',
      subtitle: 'S\u1D52',
      value: S_o,
      display: S_o.toFixed(3),
      color: C.blue,
      sign: S_o >= 0 ? '+' : '',
      desc1: 'Harbaugh + FA +',
      desc2: 'draft #7 pick',
      desc3: '',
      tag: 'S_o',
    },
    {
      title: 'Uncertainty',
      subtitle: 'U\u00A0=\u00A0\u221AV',
      value: U,
      display: U.toFixed(3),
      color: C.gold,
      sign: '',
      desc1: 'New regime,',
      desc2: 'no games yet',
      desc3: 'since Jan 2026',
      tag: 'U',
    },
    {
      title: 'Price Signal',
      subtitle: 'fair\u00A0value',
      value: CURRENT_STATE.price,
      display: `$${CURRENT_STATE.price.toFixed(2)}`,
      color: C.gold,
      sign: '',
      desc1: `${changePct >= 0 ? '+' : ''}${changePct.toFixed(1)}% from launch`,
      desc2: 'Mark: $' + CURRENT_STATE.markPrice.toFixed(2),
      desc3: '',
      tag: 'fair',
    },
  ]

  return (
    <div style={{
      background: '#060d1c',
      border: `1px solid ${C.border}`,
      borderRadius: 10,
      overflow: 'hidden',
      marginBottom: 4,
    }}>
      {/* Header */}
      <div style={{
        background: '#080f20',
        borderBottom: `1px solid ${C.border}`,
        padding: '10px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: C.dim }}>
          ORACLE STATE
        </span>
        <span style={{ fontSize: 11, color: C.dim }}>—</span>
        <span style={{ fontSize: 11, color: C.text, fontWeight: 600 }}>March 24, 2026</span>
        <span style={{ fontSize: 11, color: C.dim, marginLeft: 4 }}>
          · 2025 Season: 4–13 · Harbaugh Era begins
        </span>
      </div>

      {/* Columns */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${C.border}` }}>
        {columns.map((col, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              padding: '20px 20px 16px',
              borderRight: i < columns.length - 1 ? `1px solid ${C.border}` : undefined,
            }}
          >
            {/* Title */}
            <div style={{ fontSize: 10, fontWeight: 700, color: C.dim, letterSpacing: 0.8, marginBottom: 4 }}>
              {col.title.toUpperCase()}
            </div>
            {/* Big number */}
            <div style={{ fontSize: 36, fontWeight: 900, color: col.color, letterSpacing: -1, lineHeight: 1, marginBottom: 4 }}>
              {col.sign}{col.display}
            </div>
            {/* Tag */}
            <div style={{
              display: 'inline-block',
              fontSize: 10,
              fontWeight: 700,
              color: col.color,
              background: `${col.color}18`,
              border: `1px solid ${col.color}40`,
              borderRadius: 3,
              padding: '1px 7px',
              marginBottom: 10,
              letterSpacing: 0.5,
            }}>
              {col.tag}
            </div>
            {/* Description */}
            <div style={{ fontSize: 11, color: C.dim, lineHeight: 1.6 }}>
              {col.desc1 && <div>{col.desc1}</div>}
              {col.desc2 && <div>{col.desc2}</div>}
              {col.desc3 && <div>{col.desc3}</div>}
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{
        padding: '10px 20px',
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 12,
        background: '#060d1c',
      }}>
        <span style={{ fontSize: 12, color: C.text, fontWeight: 600 }}>
          Combined S = S<sub>q</sub> + λ × S<sub>o</sub>
          {' = '}
          <span style={{ color: C.red }}>{S_q.toFixed(3)}</span>
          {' + '}
          <span style={{ color: C.gold }}>{LAMBDA}</span>
          {' × '}
          <span style={{ color: C.blue }}>{S_o.toFixed(3)}</span>
          {' = '}
          <span style={{ color: C.text, fontWeight: 800 }}>{COMBINED_S.toFixed(3)}</span>
        </span>
        <span style={{ fontSize: 11, color: C.dim }}>
          ·&nbsp;λ = {LAMBDA} &nbsp;(S<sub>o</sub> discounted 25% — optionality unproven on field)
        </span>
      </div>
    </div>
  )
}
