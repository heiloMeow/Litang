import React, { useEffect, useMemo, useState } from 'react'
import type { Session } from '../types'
import './SessionPage.css'
import { getActiveSession, startSession as apiStartSession, endSession as apiEndSession } from '../api/mock'

export default function SessionPage() {
  // 当前会话状态（null = 未开始）
  // Current active session state (null = not started)
  const [active, setActive] = useState<Session | null>(null)
  const [busy, setBusy] = useState(false)

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

  // 初始化：查询是否已有未结束的会话（来自 mock API / 可切换为真实接口）
  // Init: query for unfinished session (mock API / switchable to real API)
  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const s = await getActiveSession()
        if (alive && s) setActive(s)
      } catch (e) {
        console.error(e)
      }
    })()
    return () => {
      alive = false
    }
  }, [])

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
    if (busy) return
    setBusy(true)
    try {
      const s = await apiStartSession(title.trim() || undefined)
      setActive(s)
      setTitle('')
    } catch (e) {
      console.error(e)
    } finally {
      setBusy(false)
    }
  }

  // End Session 按钮点击
  // Handle End Session button click
  async function onEnd() {
    if (!active || busy) return
    setBusy(true)
    try {
      await apiEndSession(active.id)
      // End 后切回空闲态；如需展示结束时间，可改为 setActive({...active, endedAt: Date.now()})
      setActive(null)
    } catch (e) {
      console.error(e)
    } finally {
      setBusy(false)
    }
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
                  disabled={busy}
                >
                  Start Session
                </button>

                <button
                  className="sp-btn sp-btn-danger sp-pane sp-pane--live"
                  aria-hidden={!active}
                  onClick={onEnd}
                  disabled={busy}
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
