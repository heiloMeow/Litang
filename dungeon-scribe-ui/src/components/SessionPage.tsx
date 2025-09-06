// src/components/SessionPage.tsx
import React, { useEffect, useMemo, useState } from 'react'
import { getActiveSession, startSession, endSession } from '../api/mock'
import type { Session } from '../types'
import './SessionPage.css'

// Clean, minimal, centered around 40% viewport height
// 极简、现代、内容居于视口约 40% 处
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

  const tagline = active ? 'Session is live. Happy adventuring!' : 'Ready to dive into your campaign?'

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
      {/* Shell uses grid rows to place content around 40% viewport height */}
      {/* 通过网格行控制内容出现在视口约 40% 处 */}
      <section className="sp-shell">
        <header className="sp-hero">
          <h1 className="sp-title">{greeting}!</h1>
          <p className="sp-subtitle">{tagline}</p>
        </header>

        <div className="sp-card">
          {active ? (
            <div className="sp-row">
              <div className="sp-live">
                <span aria-hidden>●</span>
                <strong className="sp-time">{elapsed}</strong>
                {active.title ? <span className="sp-note">({active.title})</span> : null}
              </div>
              <button className="sp-btn sp-btn-danger" onClick={onEnd}>End Session</button>
            </div>
          ) : (
            <div className="sp-row">
              <input
                className="sp-input"
                placeholder="Session title (optional)"
                value={title}
                onChange={e => setTitle(e.target.value)}
              />
              <button className="sp-btn sp-btn-primary" onClick={onStart}>Start Session</button>
            </div>
          )}
        </div>
      </section>
    </main>
  )
}
