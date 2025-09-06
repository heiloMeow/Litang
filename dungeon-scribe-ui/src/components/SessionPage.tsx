import React, { useEffect, useMemo, useState } from 'react'
import { getActiveSession, startSession, endSession } from '../api/mock'
import type { Session } from '../types'
import './SessionPage.css'

export default function SessionPage() {
  const [active, setActive] = useState<Session | null>(null)
  const [title, setTitle] = useState('')
  const [now, setNow] = useState(Date.now())

  useEffect(() => { getActiveSession().then(setActive) }, [])
  useEffect(() => {
    if (!active) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [active])

  const elapsed = useMemo(() => {
    if (!active) return '00:00:00'
    const ms = (active.endedAt ?? now) - active.startedAt
    const s = Math.max(0, Math.floor(ms / 1000))
    const hh = String(Math.floor(s / 3600)).padStart(2, '0')
    const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0')
    const ss = String(s % 60).padStart(2, '0')
    return `${hh}:${mm}:${ss}`
  }, [active, now])

  const greeting = useMemo(() => {
    const h = new Date(now).getHours()
    if (h < 5) return 'Good night'
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  }, [now])

  const tagline = active
    ? 'Session is live. Happy adventuring!'
    : 'Ready to dive into your campaign?'

  async function onStart() {
    const s = await startSession(title.trim() || undefined)
    setActive(s)
    setTitle('')
  }
  async function onEnd() {
    if (!active) return
    await endSession(active.id)
    setActive(null)
  }

  return (
    <main className="page session-page">
      <section className="sp-shell">
        <header className="sp-hero">
          <h1 className="sp-title">{greeting}!</h1>
          <p className="sp-subtitle">{tagline}</p>
        </header>

        {/* is-live / is-idle 控制整体过渡 */}
        <div className={`sp-card ${active ? 'is-live' : 'is-idle'}`}>
          <div className="sp-card__inner">
            <div className="sp-row">
              {/* 左侧：输入 与 Live 胶囊 交错淡入 */}
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
                    {active?.title ? <span className="sp-note">({active.title})</span> : null}
                    <span className="sp-meter" aria-hidden>
                      <i></i><i></i><i></i><i></i><i></i>
                    </span>
                  </div>
                </div>
              </div>

              {/* 右侧：Start 与 End 按钮交错淡入，容器定宽避免跳动 */}
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
