import React, { useState } from 'react'
import { CURRENT_STATE, LAUNCH_CONFIG } from './data/simulation'
import OverviewTab from './components/OverviewTab'
import PriceStateTab from './components/PriceStateTab'
import AttributionTab from './components/AttributionTab'
import StateAttributionTab from './components/StateAttributionTab'
import CounterfactualPanel from './components/CounterfactualPanel'
import PerformanceTab from './components/PerformanceTab'
import SentimentTab from './components/SentimentTab'
import RiskTab from './components/RiskTab'
import MethodologyTab from './components/MethodologyTab'

const C = {
  bg: '#050a14', panel: '#0a1428', border: '#162040',
  gold: '#f5a623', blue: '#4a90e2', green: '#2f9e44',
  red: '#e03131', purple: '#9b59b6', text: '#e8eaf0', dim: '#5a6a8a',
}

const TABS = [
  'Overview', 'Price & State', 'Attribution',
  'State Attribution', 'Counterfactuals',
  'Performance', 'Sentiment', 'Risk & Mechanics', 'Methodology',
]

export default function App() {
  const [activeTab, setActiveTab] = useState(0)

  const changePct = ((CURRENT_STATE.markPrice - LAUNCH_CONFIG.launchPrice) / LAUNCH_CONFIG.launchPrice * 100)

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      {/* Header */}
      <div style={{ background: C.panel, borderBottom: `1px solid ${C.border}`, padding: '0 24px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 0 12px' }}>
            {/* Logo */}
            <div style={{
              width: 44, height: 44, borderRadius: '50%',
              background: C.gold, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 800, fontSize: 14, color: '#050a14', flexShrink: 0,
            }}>NYG</div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 20, fontWeight: 700, color: C.text }}>New York Giants Asset</span>
                <span style={{
                  background: '#1a2a3a', border: `1px solid ${C.border}`,
                  borderRadius: 4, padding: '2px 8px', fontSize: 11, color: C.dim,
                  fontWeight: 600, letterSpacing: 1,
                }}>OFFSEASON 2025</span>
              </div>
              <div style={{ fontSize: 13, color: C.dim, marginTop: 2 }}>
                RWP Oracle · Synthetic Perpetual · Team Performance Asset
              </div>
            </div>
            {/* Price badge */}
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 26, fontWeight: 800, color: C.gold }}>
                ${CURRENT_STATE.markPrice.toFixed(2)}
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: changePct >= 0 ? C.green : C.red }}>
                {changePct >= 0 ? '▲' : '▼'} {Math.abs(changePct).toFixed(1)}% from launch
              </div>
            </div>
          </div>

          {/* Tab bar */}
          <div style={{ display: 'flex', gap: 0, overflowX: 'auto' }}>
            {TABS.map((tab, i) => (
              <button
                key={tab}
                onClick={() => setActiveTab(i)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  padding: '10px 18px', fontSize: 13, fontWeight: 600,
                  color: activeTab === i ? C.gold : C.dim,
                  borderBottom: activeTab === i ? `2px solid ${C.gold}` : '2px solid transparent',
                  transition: 'color 0.15s',
                  whiteSpace: 'nowrap',
                }}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px' }}>
        {activeTab === 0 && <OverviewTab />}
        {activeTab === 1 && <PriceStateTab />}
        {activeTab === 2 && <AttributionTab />}
        {activeTab === 3 && <StateAttributionTab />}
        {activeTab === 4 && <CounterfactualPanel />}
        {activeTab === 5 && <PerformanceTab />}
        {activeTab === 6 && <SentimentTab />}
        {activeTab === 7 && <RiskTab />}
        {activeTab === 8 && <MethodologyTab />}
      </div>
    </div>
  )
}
