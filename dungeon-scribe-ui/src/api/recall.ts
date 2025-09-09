// src/api/recall.ts
// -------------------------------------------------------------
// 简介（ZH）：最小版 Recall API，只包含：
// - 简易大模型对话（llmGenerate）
// - 会话总结与战役总结（generateSessionSummary / generateCampaignSummary）
// 可连接真实后端端点，也提供前端 Mock 以离线演示。
//
// Overview (EN): Minimal Recall API with:
// - Lightweight LLM chat (llmGenerate)
// - Session and campaign summaries (generateSessionSummary / generateCampaignSummary)
// Supports real backend endpoints and ships mock fallbacks for offline demo.

import type { Session } from '../types'
import { queryTimeline as timelineQuery, getSessions as getSessionsMock } from './timeline'

// 后端基础地址（ZH）：从 Vite 环境变量读取；若未配置则为空字符串
// API base URL (EN): read from Vite env; empty string if not set
const API_BASE = (import.meta as any)?.env?.VITE_API_BASE?.replace(/\/$/, '') ?? ''

// 是否启用 Mock（ZH）：true 则走前端模拟；false 则请求真实接口
// Use mock? (EN): true -> frontend mock; false -> real backend
const USE_MOCK = true

/**
 * 角色（ZH）：聊天消息角色类型
 * Role (EN): chat message role
 */
export type ChatRole = 'system' | 'user' | 'assistant'

/**
 * 聊天消息（ZH）：最小入参格式
 * Chat message (EN): minimal input shape
 */
export interface ChatMessage {
  role: ChatRole
  content: string
}

/**
 * 引用（ZH）：可选的证据链接（事件 ID/标题/时间戳）；Mock 未使用
 * Citation (EN): optional evidence entries (event id/title/timestamp); unused by mock
 */
export interface Citation { eventId: string; title: string; ts: number }

/**
 * 对话响应（ZH）：返回文本与可选引用
 * Chat response (EN): answer text with optional citations
 */
export interface ChatResponse {
  text: string
  citations?: Citation[]
}

/**
 * llmGenerate
 * - ZH：最小大模型对话接口。入参为消息数组，返回单条文本答复。
 * - EN: Minimal LLM chat endpoint. Takes array of messages, returns a single reply text.
 *
 * 后端（ZH）：POST /api/llm/generate { messages }
 * Backend (EN): POST /api/llm/generate { messages }
 */
export async function llmGenerate(messages: ChatMessage[]): Promise<ChatResponse> {
  if (!USE_MOCK && API_BASE) {
    const res = await fetch(`${API_BASE}/api/llm/generate`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ messages })
    })
    if (!res.ok) throw new Error(`llm: ${res.status}`)
    return res.json()
  }
  // Mock（ZH）：回显用户问题 + 最近事件标题
  // Mock (EN): echo the last user question + recent event titles
  const last = messages[messages.length - 1]?.content || ''
  const evs = await timelineQuery({})
  const tops = evs.slice(-3).map(e => `- ${e.title} (${new Date(e.ts).toLocaleDateString()})`).join('\n')
  const text = `You asked: ${last}\n\nRecent campaign highlights:\n${tops || '- (no events)'}`
  return { text }
}

/**
 * generateSessionSummary
 * - ZH：生成单次会话总结。真实后端可返回高质量总结；Mock 以最近事件凑要点。
 * - EN: Generate summary for one session. Real backend can produce better content; mock lists recent events.
 */
export async function generateSessionSummary(sessionId: string): Promise<string> {
  if (!USE_MOCK && API_BASE) {
    const res = await fetch(`${API_BASE}/api/summary/session/${encodeURIComponent(sessionId)}/generate`, { method: 'POST', credentials: 'include' })
    if (!res.ok) throw new Error(`session summary: ${res.status}`)
    const data = await res.json()
    return data?.summary ?? ''
  }
  const events = await timelineQuery({})
  const bullets = events.slice(-4).map(e => `- ${e.title} (${new Date(e.ts).toLocaleDateString()})`).join('\n')
  return `Session ${sessionId} Summary\n\nHighlights:\n${bullets}\n\nUnresolved threads:\n- TBD\n\nDM notes:\n- Prep next location set pieces.`
}

/**
 * generateCampaignSummary
 * - ZH：生成战役层总结（可选 since/lastN 约束）。Mock 以去重标题近似展示“主要情节”。
 * - EN: Generate campaign-level summary (optional since/lastN). Mock approximates "major beats" via unique titles.
 */
export async function generateCampaignSummary(opts: { sinceSessionId?: string; lastN?: number } = {}): Promise<string> {
  if (!USE_MOCK && API_BASE) {
    const res = await fetch(`${API_BASE}/api/summary/campaign`, {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(opts)
    })
    if (!res.ok) throw new Error(`campaign summary: ${res.status}`)
    const data = await res.json()
    return data?.summary ?? ''
  }
  const all = await timelineQuery({})
  const titles = all.map(e => e.title)
  const uniqTitles = Array.from(new Set(titles))
  return `Campaign Summary\n\nMajor beats:\n- ${uniqTitles.slice(0, 5).join('\n- ')}\n\nCharacter arcs:\n- Emerging dynamics between party members.\n\nOpen quests:\n- To be tracked.`
}

/**
 * getSessions
 * - ZH：读取会话列表（Mock 由 timeline API 提供示例数据）。
 * - EN: Fetch list of sessions (mocked via timeline API examples).
 */
export async function getSessions(): Promise<Session[]> {
  return getSessionsMock()
}

