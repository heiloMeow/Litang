import React from 'react'
import { Tab, TABS } from '../types'
import SessionBar from './SessionBar'

export function Header(props: { tab: Tab; setTab: (t: Tab) => void }) {
  const { tab, setTab } = props
  return (
    <header>
      <h1>Dungeon Scribe</h1>
      <nav>
        {TABS.map(t => (
          <button
            key={t}
            className={tab === t ? 'active' : ''}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </nav>
      <div className="right">
        <SessionBar />
      </div>
    </header>
  )
}
