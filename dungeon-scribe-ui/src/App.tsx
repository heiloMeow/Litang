import React, { useState } from 'react'
import { Header } from './components/Header'
import Timeline from './components/Timeline'
import Recall from './components/Recall'
import GraphView from './components/GraphView'
import SessionPage from './components/SessionPage'
import type { Tab } from './types'
import './app.css' // 确保引入了样式

export default function App() {
  const [tab, setTab] = useState<Tab>('Session')

  return (
    <div className="app-shell">
      <Header tab={tab} setTab={setTab} />

      {/* 主内容区域：自动填满剩余高度 */}
      <main className="app-main">
        {tab === 'Session'  && <SessionPage />}
        {tab === 'Timeline' && <Timeline />}
        {tab === 'Recall'   && <Recall />}
        {tab === 'Graph'    && <GraphView />}
      </main>
    </div>
  )
}
