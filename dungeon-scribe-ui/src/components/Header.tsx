import React from 'react'
import { Tab, TABS } from '../types'
import './Header.css' // 新增：样式文件

// Header: app's main navigation bar
// Header：应用的主导航栏（左标题 + 右侧标签）
export function Header(props: { tab: Tab; setTab: (t: Tab) => void }) {
  const { tab, setTab } = props

  return (
    <header className="header" aria-label="App Header">
      <div className="header-inner">
        {/* Title / 标题 */}
        <h1 className="header-title">AI Dungeon Master Memory Engine</h1>

        {/* Tabs / 导航标签 */}
        <nav className="header-nav" aria-label="Primary navigation">
          {TABS.map(t => (
            <button
              key={t}
              type="button"
              className={`header-tab ${tab === t ? 'is-active' : ''}`}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ))}
        </nav>
      </div>
    </header>
  )
}
