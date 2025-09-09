/**
 * src/components/Recall.tsx
 * -------------------------------------------------------------
 * ZH: Smart Recall 最小前端页面。保留两块核心能力：
 *  - 简易对话（Ask the Campaign）
 *  - 会话总结与战役总结（Session/Campaign Summary）
 * 无外部 provider 选择与健康检查，便于快速集成本地或自托管 LLM。
 *
 * EN: Minimal Smart Recall page. It keeps two core capabilities:
 *  - Lightweight chat (Ask the Campaign)
 *  - Session and campaign summaries
 * No provider/health controls to keep the UI simple and pluggable.
 */
import React, { useEffect, useMemo, useState } from 'react'
import type { Session } from '../types'
import {
  llmGenerate,
  generateSessionSummary,
  generateCampaignSummary,
  getSessions,
  type ChatMessage
} from '../api/recall'
import './Recall.css'

export default function Recall() {
  // ZH: 对话状态（最小实现）
  // EN: Chat state (minimal)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [asking, setAsking] = useState(false)

  // ZH: 总结相关状态
  // EN: Summary-related state
  const [sessions, setSessions] = useState<Session[]>([])
  const [selSession, setSelSession] = useState('')
  const [sessionSummary, setSessionSummary] = useState('')
  const [campaignSummary, setCampaignSummary] = useState('')
  const [busy, setBusy] = useState<{ session?: boolean; campaign?: boolean }>({})

  // ZH: 首次加载会话列表，默认选中最近一次
  // EN: Load sessions once, default to the most recent
  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const ss = await getSessions()
        if (!alive) return
        setSessions(ss)
        if (ss.length) setSelSession(ss[ss.length - 1].id)
      } catch {}
    })()
    return () => { alive = false }
  }, [])

  /**
   * ZH: 发送问题给 LLM（最小实现：顺序消息 -> 单条回复）。
   * EN: Send question to LLM (minimal: sequential messages -> single reply).
   */
  async function onAsk() {
    const text = input.trim()
    if (!text || asking) return
    const next = [...messages, { role: 'user', content: text } as ChatMessage]
    setMessages(next)
    setInput('')
    setAsking(true)
    try {
      const res = await llmGenerate(next)
      setMessages(m => [...m, { role: 'assistant', content: res.text }])
    } catch (e: any) {
      setMessages(m => [...m, { role: 'assistant', content: e?.message || 'LLM error' }])
    } finally {
      setAsking(false)
    }
  }

  /**
   * ZH: 生成选中会话的总结。
   * EN: Generate summary for the selected session.
   */
  async function onGenSession() {
    if (!selSession) return
    setBusy(s => ({ ...s, session: true }))
    try {
      const text = await generateSessionSummary(selSession)
      setSessionSummary(text)
    } finally {
      setBusy(s => ({ ...s, session: false }))
    }
  }

  /**
   * ZH: 生成战役层总结。
   * EN: Generate campaign-level summary.
   */
  async function onGenCampaign() {
    setBusy(s => ({ ...s, campaign: true }))
    try {
      const text = await generateCampaignSummary({ lastN: 10 })
      setCampaignSummary(text)
    } finally {
      setBusy(s => ({ ...s, campaign: false }))
    }
  }

  // ZH: 是否允许发送（非空且未在请求中）
  // EN: Can send if non-empty input and not pending
  const canAsk = useMemo(() => input.trim().length > 0 && !asking, [input, asking])

  return (
    <div className="container">
      <section className="recall-grid">
        {/* ZH: 对话区 / EN: Chat */}
        <div className="card recall-chat">
          <div className="recall-card-body">
            <div style={{ fontWeight: 600 }}>Ask the Campaign</div>
            <div className="small" style={{ opacity: .8 }}>Ask anything about your campaign. For example: "Summarize last session"</div>
            <div className="recall-msgs">
              {messages.map((m, i) => (
                <div key={i} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '100%' }}>
                  <div className="card" style={{ padding: 8, background: 'rgba(27,31,42,0.7)' }}>
                    <div className="small" style={{ opacity: .7 }}>{m.role}</div>
                    <div>{m.content}</div>
                  </div>
                </div>
              ))}
              {messages.length === 0 && (
                <div className="recall-empty">No messages yet. Try asking "What happened recently?"</div>
              )}
            </div>
            <div className="recall-actions">
              <input
                className="select"
                placeholder="Type your question..."
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') onAsk() }}
                style={{ flex: 1 }}
              />
              <button onClick={onAsk} disabled={!canAsk}>{asking ? 'Asking...' : 'Ask'}</button>
              <button onClick={() => setMessages([])} disabled={!messages.length}>Clear</button>
            </div>
          </div>
        </div>

        {/* ZH: 会话总结 / EN: Session Summary */}
        <div className="card">
          <div className="row">
            <div style={{ fontWeight: 600 }}>Session Summary</div>
            <div className="right" />
          </div>
          <div className="row" style={{ marginTop: 8 }}>
            <select className="select" value={selSession} onChange={e => setSelSession(e.target.value)}>
              {sessions.map(s => (
                <option key={s.id} value={s.id}>{s.title || s.id}</option>
              ))}
            </select>
            <button onClick={onGenSession} disabled={!selSession || !!busy.session}>{busy.session ? 'Generating...' : 'Generate'}</button>
          </div>
          {sessionSummary ? (
            <pre style={{ marginTop: 8, whiteSpace: 'pre-wrap' }}>{sessionSummary}</pre>
          ) : (
            <div className="recall-empty">Select a session and click Generate to see a summary.</div>
          )}
        </div>

        {/* ZH: 战役总结 / EN: Campaign Summary */}
        <div className="card">
          <div className="row">
            <div style={{ fontWeight: 600 }}>Campaign Summary</div>
            <div className="right" />
          </div>
          <div className="row" style={{ marginTop: 8 }}>
            <button onClick={onGenCampaign} disabled={!!busy.campaign}>{busy.campaign ? 'Generating...' : 'Generate'}</button>
          </div>
          {campaignSummary ? (
            <pre style={{ marginTop: 8, whiteSpace: 'pre-wrap' }}>{campaignSummary}</pre>
          ) : (
            <div className="recall-empty">Click Generate to compile a campaign-level summary.</div>
          )}
        </div>
      </section>
    </div>
  )
}
