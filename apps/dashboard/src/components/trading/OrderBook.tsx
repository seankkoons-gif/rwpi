import React, { useState, useEffect } from 'react'
import { generateOrderBook, OrderBookLevel, CURRENT_STATE } from '../../data/simulation'

const C = {
  bg: '#050a14', panel: '#0a1428', border: '#162040',
  gold: '#f5a623', blue: '#4a90e2', green: '#00c853',
  red: '#ff3d3d', text: '#e8eaf0', dim: '#5a6a8a',
}

const MARK_PRICE = CURRENT_STATE.markPrice

export default function OrderBook() {
  const [book, setBook] = useState(() => generateOrderBook(MARK_PRICE))

  useEffect(() => {
    const id = setInterval(() => setBook(generateOrderBook(MARK_PRICE)), 2000)
    return () => clearInterval(id)
  }, [])

  const maxTotal = Math.max(
    book.bids[book.bids.length - 1]?.total ?? 1,
    book.asks[book.asks.length - 1]?.total ?? 1,
  )

  return (
    <div style={{
      flex: 1,
      background: C.panel,
      display: 'flex',
      flexDirection: 'column',
      minWidth: 0,
      borderRight: `1px solid ${C.border}`,
    }}>
      {/* Header */}
      <div style={{
        padding: '8px 12px',
        borderBottom: `1px solid ${C.border}`,
        fontSize: 10,
        fontWeight: 700,
        color: C.dim,
        letterSpacing: 1,
        flexShrink: 0,
      }}>
        ORDER BOOK
      </div>

      {/* Column headers */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        padding: '4px 12px',
        fontSize: 10,
        color: C.dim,
        borderBottom: `1px solid ${C.border}`,
        flexShrink: 0,
      }}>
        <span>Price</span>
        <span style={{ textAlign: 'center' }}>Size</span>
        <span style={{ textAlign: 'right' }}>Total</span>
      </div>

      {/* Order book body — asks + spread + bids */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
        {/* Asks — shown in reverse so lowest ask is nearest spread */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', overflow: 'hidden' }}>
          {[...book.asks].reverse().map((level, i) => (
            <BookRow
              key={i}
              level={level}
              side="ask"
              maxTotal={maxTotal}
            />
          ))}
        </div>

        {/* Spread indicator */}
        <div style={{
          padding: '5px 12px',
          borderTop: `1px solid ${C.border}`,
          borderBottom: `1px solid ${C.border}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: '#060e1f',
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: C.gold }}>
            ${MARK_PRICE.toFixed(2)}
          </span>
          <span style={{ fontSize: 10, color: C.dim }}>
            Spread: <span style={{ color: C.text }}>${book.spread.toFixed(2)}</span>
          </span>
          <span style={{ fontSize: 10, color: C.dim }}>Mark</span>
        </div>

        {/* Bids — shown top to bottom, highest bid first */}
        <div style={{ flex: 1, overflow: 'hidden' }}>
          {book.bids.map((level, i) => (
            <BookRow
              key={i}
              level={level}
              side="bid"
              maxTotal={maxTotal}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function BookRow({
  level, side, maxTotal,
}: {
  level: OrderBookLevel
  side: 'bid' | 'ask'
  maxTotal: number
}) {
  const isAsk = side === 'ask'
  const color = isAsk ? C.red : C.green
  const bgColor = isAsk ? '#ff3d3d' : '#00c853'
  const fillPct = Math.min(100, (level.total / maxTotal) * 100)

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr 1fr 1fr',
      padding: '2px 12px',
      fontSize: 12,
      position: 'relative',
      cursor: 'pointer',
    }}>
      {/* Depth fill bar */}
      <div style={{
        position: 'absolute',
        top: 0, bottom: 0,
        right: 0,
        width: `${fillPct}%`,
        background: `${bgColor}12`,
        pointerEvents: 'none',
      }} />
      <span style={{ color, fontWeight: 600, fontFamily: 'monospace', position: 'relative', zIndex: 1 }}>
        {level.price.toFixed(2)}
      </span>
      <span style={{ textAlign: 'center', color: C.text, fontFamily: 'monospace', position: 'relative', zIndex: 1 }}>
        {level.size}
      </span>
      <span style={{ textAlign: 'right', color: C.dim, fontFamily: 'monospace', fontSize: 11, position: 'relative', zIndex: 1 }}>
        {level.total}
      </span>
    </div>
  )
}
