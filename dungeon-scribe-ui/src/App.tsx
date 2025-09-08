import { useState } from 'react'
import Header from './components/Header'
import Timeline from './components/Timeline'
import Recall from './components/Recall'
import GraphView from './components/GraphView'
import SessionPage from './components/SessionPage'
import type { Tab } from './types'
import './app.css'

/**
 * App
 * -----
 * Main application entry point.
 *
 * Responsibilities:
 * - Holds the global navigation state (`tab`).
 * - Controls which page (Session / Timeline / Recall / Graph) is displayed.
 *
 * @component
 */
export default function App() {
  /** Current active tab in the application. */
  const [tab, setTab] = useState<Tab>('Session')

  return (
    <div className="app-shell">
      {/* Header component manages navigation buttons and passes tab state. */}
      <Header tab={tab} setTab={setTab} />

      {/* Main content area: renders different pages based on current tab. */}
      <main className="app-main">
        {tab === 'Session'  && <SessionPage />}
        {tab === 'Timeline' && <Timeline />}
        {tab === 'Recall'   && <Recall />}
        {tab === 'Graph'    && <GraphView />}
      </main>
    </div>
  )
}
