import React, { useState } from 'react'
import TopBar from './components/trading/TopBar'
import MarketSidebar from './components/trading/MarketSidebar'
import PriceChart from './components/trading/PriceChart'
import OrderBook from './components/trading/OrderBook'
import RecentTrades from './components/trading/RecentTrades'
import OrderEntry from './components/trading/OrderEntry'
import PositionPanel from './components/trading/PositionPanel'
import StateTriadPanel from './components/StateTriadPanel'
import StateAttributionTab from './components/StateAttributionTab'

// Analytics panel — the research content lives inside the bottom Analytics tab
function AnalyticsContent() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <StateTriadPanel />
      <StateAttributionTab />
    </div>
  )
}

type BottomTab = 'positions' | 'orders' | 'history' | 'funding' | 'analytics'

export default function App() {
  const [bottomTab, setBottomTab] = useState<BottomTab>('positions')

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: '#050a14',
      color: '#e8eaf0',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      overflow: 'hidden',
    }}>
      {/* Top bar — fixed */}
      <TopBar />

      {/* Main 3-column body */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>

        {/* Left: Market sidebar */}
        <MarketSidebar />

        {/* Center: Chart + order book */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
          {/* Price chart — fixed height */}
          <PriceChart />

          {/* Order book + recent trades row — fills remaining height */}
          <div style={{ display: 'flex', flex: 1, minHeight: 0, borderTop: '1px solid #162040' }}>
            <OrderBook />
            <RecentTrades />
          </div>
        </div>

        {/* Right: Order entry */}
        <OrderEntry />
      </div>

      {/* Bottom panel — tabbed */}
      <PositionPanel
        activeTab={bottomTab}
        onTabChange={setBottomTab}
        analyticsContent={<AnalyticsContent />}
      />
    </div>
  )
}
