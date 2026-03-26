import React, { useState } from 'react'
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { GIANTS_SNAPSHOTS, CURRENT_STATE, LAUNCH_CONFIG } from '../../data/simulation'

const C = {
  bg: '#050a14', panel: '#0a1428', border: '#162040',
  gold: '#f5a623', blue: '#4a90e2', green: '#00c853',
  red: '#ff3d3d', text: '#e8eaf0', dim: '#5a6a8a',
}

const chartData = GIANTS_SNAPSHOTS.map(s => ({
  label: s.label,
  markPrice: +s.markPrice.toFixed(2),
  fairPrice: +s.price.toFixed(2),
  event: s.event,
}))

const MARK_PRICE = CURRENT_STATE.markPrice
const LAUNCH_PRICE = LAUNCH_CONFIG.launchPrice

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: '#0d1e35', border: `1px solid ${C.border}`,
      borderRadius: 6, padding: '10px 14px', minWidth: 160, fontSize: 12,
    }}>
      <div style={{ color: C.gold, fontWeight: 700, marginBottom: 6 }}>{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 3 }}>
          <span style={{ color: C.dim }}>{p.name}</span>
          <span style={{ color: p.color, fontWeight: 700, fontFamily: 'monospace' }}>
            ${p.value?.toFixed(2)}
          </span>
        </div>
      ))}
      <div style={{ fontSize: 10, color: C.dim, marginTop: 6, borderTop: `1px solid ${C.border}`, paddingTop: 6 }}>
        {payload[0]?.payload?.event}
      </div>
    </div>
  )
}

type Range = '1W' | 'ALL'

export default function PriceChart() {
  const [range, setRange] = useState<Range>('ALL')

  const data = range === 'ALL' ? chartData : chartData.slice(-4)

  return (
    <div style={{
      background: C.panel,
      borderBottom: `1px solid ${C.border}`,
      padding: '12px 0 0',
      flexShrink: 0,
    }}>
      {/* Chart header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px 10px',
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <span style={{ fontSize: 20, fontWeight: 900, color: C.gold }}>
            ${MARK_PRICE.toFixed(2)}
          </span>
          <span style={{
            fontSize: 13, fontWeight: 700,
            color: MARK_PRICE >= LAUNCH_PRICE ? C.green : C.red,
          }}>
            {MARK_PRICE >= LAUNCH_PRICE ? '▲' : '▼'} {Math.abs((MARK_PRICE - LAUNCH_PRICE) / LAUNCH_PRICE * 100).toFixed(1)}% from launch
          </span>
        </div>

        {/* Range selector */}
        <div style={{ display: 'flex', gap: 4 }}>
          {(['1W', 'ALL'] as Range[]).map(r => (
            <button
              key={r}
              onClick={() => setRange(r)}
              style={{
                padding: '4px 10px',
                borderRadius: 4,
                border: `1px solid ${range === r ? C.gold : C.border}`,
                background: range === r ? '#f5a62322' : 'transparent',
                color: range === r ? C.gold : C.dim,
                fontSize: 11, fontWeight: 700, cursor: 'pointer',
              }}
            >{r}</button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={220}>
        <ComposedChart data={data} margin={{ top: 5, right: 16, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="goldGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={C.gold} stopOpacity={0.25} />
              <stop offset="95%" stopColor={C.gold} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="blueGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={C.blue} stopOpacity={0.15} />
              <stop offset="95%" stopColor={C.blue} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: C.dim, fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            interval={range === 'ALL' ? 2 : 0}
          />
          <YAxis
            domain={['auto', 'auto']}
            tick={{ fill: C.dim, fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `$${v}`}
            width={52}
          />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine y={LAUNCH_PRICE} stroke={C.dim} strokeDasharray="4 4" strokeWidth={1} />
          <Area
            type="monotone"
            dataKey="markPrice"
            stroke={C.gold}
            strokeWidth={2}
            fill="url(#goldGrad)"
            dot={false}
            name="Mark"
          />
          <Line
            type="monotone"
            dataKey="fairPrice"
            stroke={C.blue}
            strokeWidth={1.5}
            strokeDasharray="4 2"
            dot={false}
            name="Fair"
          />
        </ComposedChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div style={{
        display: 'flex',
        gap: 16,
        padding: '6px 16px 10px',
        fontSize: 11,
        color: C.dim,
      }}>
        <span><span style={{ color: C.gold }}>——</span> Mark Price</span>
        <span><span style={{ color: C.blue }}>- - -</span> Fair (Oracle)</span>
        <span><span style={{ color: C.dim }}>- - -</span> Launch ${LAUNCH_PRICE}</span>
      </div>
    </div>
  )
}
