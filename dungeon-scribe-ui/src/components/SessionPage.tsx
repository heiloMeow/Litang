import React, { useEffect, useMemo, useState } from 'react'
import type { Session } from '../types'
import './SessionPage.css'

export default function SessionPage() {
  // 当前会话状态（null = 未开始）
  // Current active session state (null = not started)
  const [active, setActive] = useState<Session | null>(null)

  // 输入框中的标题
  // Title input for the session
  const [title, setTitle] = useState('')

  // 当前时间戳，用于前端计时器
  // Current timestamp, drives the frontend timer
  const [now, setNow] = useState(Date.now())

  // 前端计时器：若有会话，每秒刷新一次 now
  // Frontend timer: if session is active, update `now` every second
  useEffect(() => {
    if (!active) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [active])

  // 计算会话已用时（hh:mm:ss）
  // Calculate elapsed session time (hh:mm:ss)
  const elapsed = useMemo(() => {
    if (!active) return '00:00:00'
    const ms = (active.endedAt ?? now) - active.startedAt
    const s = Math.max(0, Math.floor(ms / 1000))
    const hh = String(Math.floor(s / 3600)).padStart(2, '0')
    const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0')
    const ss = String(s % 60).padStart(2, '0')
    return `${hh}:${mm}:${ss}`
  }, [active, now])

  // 根据当前小时生成问候语
  // Generate greeting based on current hour
  const greeting = useMemo(() => {
    const h = new Date(now).getHours()
    if (h < 5) return 'Good night'
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  }, [now])

  // tagline：会话是否进行中的提示语
  // tagline: message depending on whether session is live
  const tagline = active
    ? 'Session is live. Happy adventuring!'
    : 'Ready to dive into your campaign?'

  // Start Session 按钮点击
  // Handle Start Session button click
  async function onStart() {
    // TODO: replace with real API call
    const s: Session = {
      id: `sess-${Date.now()}`,
      title: title.trim() || undefined,
      startedAt: Date.now(),
    }
    setActive(s)
    setTitle('')
  }

  // End Session 按钮点击
  // Handle End Session button click
  async function onEnd() {
    if (!active) return
    // TODO: replace with real API call
    setActive({ ...active, endedAt: Date.now() })
  }

  return (
    <main className="page session-page">
      <section className="sp-shell">
        {/* Hero 区域：标题 + 副标题 */}
        {/* Hero section: greeting + tagline */}
        <header className="sp-hero">
          <h1 className="sp-title">{greeting}!</h1>
          <p className="sp-subtitle">{tagline}</p>
        </header>

        {/* 主卡片：根据 active 状态切换样式 is-live / is-idle */}
        {/* Main card: switches style via is-live / is-idle */}
        <div className={`sp-card ${active ? 'is-live' : 'is-idle'}`}>
          <div className="sp-card__inner">
            <div className="sp-row">
              {/* 左侧：输入框 或 计时显示 */}
              {/* Left side: input (idle) or timer (live) */}
              <div className="sp-left" aria-live="polite">
                <div className="sp-pane sp-pane--idle" aria-hidden={!!active}>
                  <input
                    className="sp-input"
                    placeholder="Session title (optional)"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                  />
                </div>

                <div className="sp-pane sp-pane--live" aria-hidden={!active}>
                  <div className="sp-live">
                    <span className="dot" aria-hidden>●</span>
                    <strong className="sp-time">{elapsed}</strong>
                    {active?.title ? (
                      <span className="sp-note">({active.title})</span>
                    ) : null}
                    <span className="sp-meter" aria-hidden>
                      <i></i><i></i><i></i><i></i><i></i>
                    </span>
                  </div>
                </div>
              </div>

              {/* 右侧：Start 或 End 按钮 */}
              {/* Right side: Start or End button */}
              <div className="sp-right" aria-live="polite">
                <button
                  className="sp-btn sp-btn-primary sp-pane sp-pane--idle"
                  aria-hidden={!!active}
                  onClick={onStart}
                >
                  Start Session
                </button>

                <button
                  className="sp-btn sp-btn-danger sp-pane sp-pane--live"
                  aria-hidden={!active}
                  onClick={onEnd}
                >
                  End Session
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
