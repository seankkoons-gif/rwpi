import React, { useState } from 'react'
import { CURRENT_STATE } from '../../data/simulation'

const C = {
  bg: '#050a14', panel: '#0a1428', border: '#162040',
  gold: '#f5a623', blue: '#4a90e2', green: '#00c853',
  red: '#ff3d3d', text: '#e8eaf0', dim: '#5a6a8a',
  longBg: '#0a2a1a', shortBg: '#2a0a0a',
}

const MARK_PRICE = CURRENT_STATE.markPrice
// Elevated regime → max 10x
const MAX_LEVERAGE = 10

// Demo account
const BALANCE = 10_000
const MARGIN_USED = 1_824
const UNREALIZED_PNL = +247

export default function OrderEntry() {
  const [side, setSide] = useState<'long' | 'short'>('long')
  const [orderType, setOrderType] = useState<'market' | 'limit' | 'stop'>('market')
  const [leverage, setLeverage] = useState(5)
  const [sizeUsd, setSizeUsd] = useState(500)
  const [limitPrice, setLimitPrice] = useState(MARK_PRICE)
  const [orderPlaced, setOrderPlaced] = useState(false)

  const entryPrice = orderType === 'market' ? MARK_PRICE : limitPrice
  const marginRequired = sizeUsd / leverage
  const liqPrice = side === 'long'
    ? +(entryPrice * (1 - 1 / leverage + 0.005)).toFixed(2)
    : +(entryPrice * (1 + 1 / leverage - 0.005)).toFixed(2)
  const fee = sizeUsd * (orderType === 'market' ? 0.0005 : 0.00025)
  const availableMargin = BALANCE - MARGIN_USED

  function handlePlace() {
    setOrderPlaced(true)
    setTimeout(() => setOrderPlaced(false), 2000)
  }

  return (
    <div style={{
      width: 280,
      flexShrink: 0,
      background: C.panel,
      borderLeft: `1px solid ${C.border}`,
      display: 'flex',
      flexDirection: 'column',
      overflowY: 'auto',
    }}>
      {/* Header */}
      <div style={{
        padding: '10px 14px 8px',
        borderBottom: `1px solid ${C.border}`,
        fontSize: 10, fontWeight: 700, color: C.dim, letterSpacing: 1,
        flexShrink: 0,
      }}>
        PLACE ORDER
      </div>

      <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Long / Short toggle */}
        <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', border: `1px solid ${C.border}` }}>
          <button
            onClick={() => setSide('long')}
            style={{
              flex: 1, padding: '10px 0',
              background: side === 'long' ? C.longBg : 'transparent',
              border: 'none',
              borderRight: `1px solid ${C.border}`,
              color: side === 'long' ? C.green : C.dim,
              fontWeight: 800, fontSize: 13, cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            LONG
          </button>
          <button
            onClick={() => setSide('short')}
            style={{
              flex: 1, padding: '10px 0',
              background: side === 'short' ? C.shortBg : 'transparent',
              border: 'none',
              color: side === 'short' ? C.red : C.dim,
              fontWeight: 800, fontSize: 13, cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            SHORT
          </button>
        </div>

        {/* Order type */}
        <div style={{ display: 'flex', gap: 4 }}>
          {(['market', 'limit', 'stop'] as const).map(t => (
            <button
              key={t}
              onClick={() => setOrderType(t)}
              style={{
                flex: 1, padding: '6px 0',
                background: orderType === t ? '#162040' : 'transparent',
                border: `1px solid ${orderType === t ? C.blue : C.border}`,
                borderRadius: 4,
                color: orderType === t ? C.blue : C.dim,
                fontWeight: 700, fontSize: 11, cursor: 'pointer',
                textTransform: 'capitalize',
              }}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {/* Leverage slider */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 11, color: C.dim }}>Leverage</span>
            <span style={{ fontSize: 13, fontWeight: 800, color: C.gold }}>{leverage}×</span>
          </div>
          <input
            type="range"
            min={1}
            max={MAX_LEVERAGE}
            step={1}
            value={leverage}
            onChange={e => setLeverage(+e.target.value)}
            style={{ width: '100%', accentColor: C.gold, cursor: 'pointer' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: C.dim, marginTop: 2 }}>
            <span>1×</span>
            <span style={{ color: '#e67e22', fontSize: 9 }}>ELEVATED: max {MAX_LEVERAGE}×</span>
            <span>{MAX_LEVERAGE}×</span>
          </div>
        </div>

        {/* Limit price (only for limit/stop) */}
        {orderType !== 'market' && (
          <Field label="Limit Price ($)">
            <NumInput
              value={limitPrice}
              onChange={setLimitPrice}
              step={0.01}
            />
          </Field>
        )}

        {/* Size */}
        <Field label="Size (USD)">
          <NumInput value={sizeUsd} onChange={setSizeUsd} step={50} />
        </Field>

        {/* Calculated fields */}
        <div style={{
          background: '#060e1f',
          border: `1px solid ${C.border}`,
          borderRadius: 6,
          padding: '10px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}>
          <CalcRow label="Entry Price" value={`$${entryPrice.toFixed(2)}`} color={C.text} />
          <CalcRow label="Margin Required" value={`$${marginRequired.toFixed(2)}`} color={C.text} />
          <CalcRow
            label="Est. Liq Price"
            value={`$${liqPrice.toFixed(2)}`}
            color={C.red}
          />
          <CalcRow
            label={`Fee (${orderType === 'market' ? '0.05%' : '0.025%'})`}
            value={`$${fee.toFixed(2)}`}
            color={C.dim}
          />
        </div>

        {/* Place order button */}
        <button
          onClick={handlePlace}
          style={{
            width: '100%',
            padding: '13px 0',
            borderRadius: 6,
            border: 'none',
            background: orderPlaced
              ? '#1a3a2a'
              : side === 'long'
                ? 'linear-gradient(135deg, #00c853 0%, #009624 100%)'
                : 'linear-gradient(135deg, #ff3d3d 0%, #c62828 100%)',
            color: '#fff',
            fontWeight: 800,
            fontSize: 14,
            cursor: 'pointer',
            transition: 'all 0.2s',
            letterSpacing: 0.5,
          }}
        >
          {orderPlaced
            ? '✓ Order Placed!'
            : side === 'long'
              ? `LONG NYG`
              : `SHORT NYG`
          }
        </button>

        {/* Account summary */}
        <div style={{
          borderTop: `1px solid ${C.border}`,
          paddingTop: 12,
          display: 'flex',
          flexDirection: 'column',
          gap: 5,
        }}>
          <div style={{ fontSize: 10, color: C.dim, fontWeight: 700, letterSpacing: 1, marginBottom: 4 }}>
            ACCOUNT SUMMARY
          </div>
          <AccountRow label="Balance" value={`$${BALANCE.toLocaleString()}`} />
          <AccountRow label="Margin Used" value={`$${MARGIN_USED.toLocaleString()}`} color={C.gold} />
          <AccountRow
            label="Available"
            value={`$${availableMargin.toLocaleString()}`}
            color={availableMargin > 0 ? C.green : C.red}
          />
          <AccountRow
            label="Unrealized PnL"
            value={`${UNREALIZED_PNL >= 0 ? '+' : ''}$${UNREALIZED_PNL}`}
            color={UNREALIZED_PNL >= 0 ? C.green : C.red}
          />
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: C.dim, marginBottom: 5 }}>{label}</div>
      {children}
    </div>
  )
}

function NumInput({ value, onChange, step = 1 }: { value: number; onChange: (v: number) => void; step?: number }) {
  return (
    <input
      type="number"
      value={value}
      step={step}
      onChange={e => onChange(+e.target.value)}
      style={{
        width: '100%',
        background: '#060e1f',
        border: `1px solid ${C.border}`,
        borderRadius: 6,
        color: C.text,
        padding: '8px 10px',
        fontSize: 13,
        fontFamily: 'monospace',
        outline: 'none',
      }}
    />
  )
}

function CalcRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
      <span style={{ color: C.dim }}>{label}</span>
      <span style={{ color: color ?? C.text, fontWeight: 700, fontFamily: 'monospace' }}>{value}</span>
    </div>
  )
}

function AccountRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
      <span style={{ color: C.dim }}>{label}</span>
      <span style={{ color: color ?? C.text, fontWeight: 600, fontFamily: 'monospace' }}>{value}</span>
    </div>
  )
}
