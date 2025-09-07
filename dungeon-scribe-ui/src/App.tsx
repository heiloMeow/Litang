import { useState } from 'react'
import Header from './components/Header'
import Timeline from './components/Timeline'
import Recall from './components/Recall'
import GraphView from './components/GraphView'
import SessionPage from './components/SessionPage'
import type { Tab } from './types'
import './app.css'

/**
 * App component: application entry point
 * App 组件：应用入口
 *
 * - Holds the global navigation state (tab)
 * - Controls which page (Session / Timeline / Recall / Graph) is displayed
 * - 全局管理导航状态（tab）
 * - 决定显示哪一个页面（Session / Timeline / Recall / Graph）
 */
export default function App() {
  const [tab, setTab] = useState<Tab>('Session')

  return (
    <div className="app-shell">
      <Header tab={tab} setTab={setTab} />

      <main className="app-main">
        {tab === 'Session'  && <SessionPage />}
        {tab === 'Timeline' && <Timeline />}
        {tab === 'Recall'   && <Recall />}
        {tab === 'Graph'    && <GraphView />}
      </main>
    </div>
  )
}
