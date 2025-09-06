import React from 'react'
import { Tab, TABS } from '../types'
import SessionBar from './SessionBar'
import './Header.css'

// Header component: main navigation bar of the app
// Header 组件：应用的主导航栏

export function Header(props: { tab: Tab; setTab: (t: Tab) => void }) {
  const { tab, setTab } = props

  return (
    <header>
      {/* App title / 应用标题 */}
      <img className="header-img" src="\public\icons\header-img.png" alt="AI Dungeon Master Memory Engine Logo" />
      <h1>AI Dungeon Master Memory Engine</h1> 

      <nav>
        {/* Navigation tabs dynamically generated from TABS */}
        {/* 导航标签，基于 TABS 动态生成 */}
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
        {/* Right side bar with session info */}
        {/* 右侧区域：显示会话信息 */}
        <SessionBar />
      </div>
    </header>
  )
}
