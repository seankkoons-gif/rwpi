import React, { useState } from 'react'
import AttributionSplitPanel from './AttributionSplitPanel'
import StateWaterfallPanel from './StateWaterfallPanel'

const C = {
  bg: '#050a14', panel: '#0a1428', border: '#162040',
  gold: '#f5a623', blue: '#4a90e2', green: '#2f9e44',
  red: '#e03131', purple: '#9b59b6', text: '#e8eaf0', dim: '#5a6a8a',
}

const SUB_TABS = ['State Attribution', 'State Waterfall']

export default function StateAttributionTab() {
  const [sub, setSub] = useState(0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Sub-tab bar */}
      <div style={{
        display: 'flex', gap: 0, marginBottom: 20,
        borderBottom: `1px solid ${C.border}`,
      }}>
        {SUB_TABS.map((tab, i) => (
          <button
            key={tab}
            onClick={() => setSub(i)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '8px 20px', fontSize: 12, fontWeight: 600,
              color: sub === i ? C.gold : C.dim,
              borderBottom: sub === i ? `2px solid ${C.gold}` : '2px solid transparent',
              transition: 'color 0.15s',
              whiteSpace: 'nowrap',
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {sub === 0 && <AttributionSplitPanel />}
      {sub === 1 && <StateWaterfallPanel />}
    </div>
  )
}
