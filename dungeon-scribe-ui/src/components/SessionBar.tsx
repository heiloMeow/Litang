import React, { useEffect, useMemo, useState } from 'react'
import { getActiveSession, startSession, endSession } from '../api/mock'
import type { Session } from '../types'

export default function SessionBar() {
  const [active, setActive] = useState<Session | null>(null)
  const [title, setTitle] = useState('')
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    getActiveSession().then(setActive)
  }, [])

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

  if (active) {
    return (
      <div className="session">
        <div className="pill">
          <span style={{ marginRight: 8 }}>● Live</span>
          <strong>{elapsed}</strong>
          {active.title ? <span className="small" style={{ marginLeft: 8 }}>({active.title})</span> : null}
        </div>
        <button onClick={onEnd}>End Session</button>
      </div>
    )
  }

  return (
    <div className="session">
      <input
        className="select"
        placeholder="Session title (optional)"
        value={title}
        onChange={e => setTitle(e.target.value)}
        style={{ minWidth: 180 }}
      />
      <button onClick={onStart}>Start Session</button>
    </div>
  )
}
