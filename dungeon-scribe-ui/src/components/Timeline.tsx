import React, { useEffect, useMemo, useState } from 'react'
import type { EventNode, Session } from '../types'
import './Timeline.css'
import { getSessions, queryTimeline } from '../api/timeline'

/**
 * Timeline (real-API-first)
 * - Component focuses on UI & interactions: search, filter, expand
 * - Data only flows through the API layer (real or mock hidden behind it)
 *
 * Timeline（真实接口优先）
 * - 组件仅负责 UI 与交互：搜索、过滤、展开
 * - 数据统一走 API 封装（是否使用 mock 由 API 层决定）
 */

// Time formatting helper / 时间格式化
const fmt = (ts: number) =>
  new Date(ts).toLocaleString('en-AU', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })

// Unique helper / 数组去重
const uniq = <T,>(arr: T[]) => Array.from(new Set(arr))

// Tiny debounce for inputs / 轻量输入防抖
function useDebounced<T>(value: T, delay = 300) {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return v
}

export default function Timeline() {
  // ===== Data states / 数据状态 =====
  const [sessions, setSessions] = useState<Session[]>([])
  const [events, setEvents] = useState<EventNode[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ===== Search & filters / 搜索与筛选 =====
  const [q, setQ] = useState('')
  const [selChar, setSelChar] = useState<'ALL' | string>('ALL')
  const [selLoc, setSelLoc] = useState<'ALL' | string>('ALL')
  const [selQuest, setSelQuest] = useState<'ALL' | string>('ALL')
  const [openId, setOpenId] = useState<string | null>(null)

  // Debounced search text / 搜索词防抖
  const qDebounced = useDebounced(q, 300)

  // ===== Initial sessions fetch / 首次获取会话分隔 =====
  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const data = await getSessions()
        if (alive) setSessions(data ?? [])
      } catch (e) {
        if (alive) console.error(e)
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  // ===== Fetch events on filter change / 筛选变更时获取事件 =====
  useEffect(() => {
    let alive = true
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await queryTimeline({
          q: qDebounced.trim() || undefined,
          characterIds: selChar === 'ALL' ? undefined : [selChar],
          locationIds: selLoc === 'ALL' ? undefined : [selLoc],
          questIds: selQuest === 'ALL' ? undefined : [selQuest]
        })
        if (alive) setEvents(Array.isArray(data) ? data : [])
      } catch (e: any) {
        if (alive) setError(e?.message || 'Failed to fetch timeline.')
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [qDebounced, selChar, selLoc, selQuest])

  // ===== Options derived from events / 由事件聚合生成下拉项 =====
  const allCharacters = useMemo(
    () => uniq(events.flatMap(e => e.characters ?? [])).sort(),
    [events]
  )
  const allLocations = useMemo(
    () => uniq(events.flatMap(e => (e.location ? [e.location] : []))).sort(),
    [events]
  )
  const allQuests = useMemo(
    () => uniq(events.flatMap(e => e.questIds ?? [])).sort(),
    [events]
  )

  // ===== Local sort by timestamp / 本地按时间升序 =====
  const sortedEvents = useMemo(
    () => events.slice().sort((a, b) => a.ts - b.ts),
    [events]
  )

  // ===== Insert session marks into render list / 将会话作为分隔插入渲染序列 =====
  const withSessionMarks = useMemo(() => {
    const marks = (sessions || [])
      .slice()
      .sort((a, b) => a.startedAt - b.startedAt)
      .map(m => ({ kind: 'session' as const, ts: m.startedAt, data: m }))
    const nodes = sortedEvents.map(e => ({ kind: 'event' as const, ts: e.ts, data: e }))
    return [...marks, ...nodes].sort((a, b) => a.ts - b.ts)
  }, [sessions, sortedEvents])

  return (
    <section className="tl">
      {/* Toolbar / 工具栏 */}
      <div className="tl-toolbar">
        <input
          className="tl-search"
          placeholder="Search title, summary, character…"
          value={q}
          onChange={e => setQ(e.target.value)}
        />
        <div className="tl-filters">
          <select value={selChar} onChange={e => setSelChar(e.target.value as any)}>
            <option value="ALL">All characters</option>
            {allCharacters.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <select value={selLoc} onChange={e => setSelLoc(e.target.value as any)}>
            <option value="ALL">All locations</option>
            {allLocations.map(l => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>

          <select value={selQuest} onChange={e => setSelQuest(e.target.value as any)}>
            <option value="ALL">All quests</option>
            {allQuests.map(q => (
              <option key={q} value={q}>{q}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Status / 状态提示 */}
      {loading && <div className="tl-empty">Loading timeline…</div>}
      {error && !loading && <div className="tl-empty">Error: {error}</div>}

      {/* Timeline / 时间线 */}
      {!loading && !error && (
        <div className="tl-rail">
          {withSessionMarks.map((n, idx) =>
            n.kind === 'session' ? (
              <div className="tl-session" key={`sess-${(n.data as Session).id}-${idx}`}>
                <div className="tl-dot tl-dot--session" />
                <div className="tl-card tl-card--session">
                  <div className="tl-session-title">{(n.data as Session).title ?? 'Session'}</div>
                  <div className="tl-time">{fmt(n.ts)}</div>
                </div>
              </div>
            ) : (
              <div className="tl-item" key={(n.data as EventNode).id}>
                <div className="tl-dot" />
                <div className={`tl-card ${openId === (n.data as EventNode).id ? 'is-open' : ''}`}>
                  <div className="tl-row">
                    <div className="tl-title">{(n.data as EventNode).title}</div>
                    <div className="tl-time">{fmt((n.data as EventNode).ts)}</div>
                  </div>

                  {(n.data as EventNode).summary && (
                    <p className="tl-summary">{(n.data as EventNode).summary}</p>
                  )}

                  <div className="tl-tags">
                    {(n.data as EventNode).location && (
                      <span className="tag tag--loc">{(n.data as EventNode).location}</span>
                    )}
                    {(n.data as EventNode).characters.map(c => (
                      <span key={c} className="tag tag--char">{c}</span>
                    ))}
                    {((n.data as EventNode).questIds ?? []).map(qid => (
                      <span key={qid} className="tag tag--quest">{qid}</span>
                    ))}
                  </div>

                  <div className="tl-actions">
                    <button
                      className="tl-toggle"
                      onClick={() =>
                        setOpenId(p => (p === (n.data as EventNode).id ? null : (n.data as EventNode).id))
                      }
                    >
                      {openId === (n.data as EventNode).id ? 'Collapse' : 'Expand'}
                    </button>
                  </div>

                  <div className="tl-details">
                    <div className="kv"><span>Event ID</span><code>{(n.data as EventNode).id}</code></div>
                    <div className="kv"><span>Related quests</span><code>{((n.data as EventNode).questIds ?? []).join(', ') || '—'}</code></div>
                  </div>
                </div>
              </div>
            )
          )}

          {withSessionMarks.length === 0 && (
            <div className="tl-empty">No events match the filters.</div>
          )}
        </div>
      )}
    </section>
  )
}
