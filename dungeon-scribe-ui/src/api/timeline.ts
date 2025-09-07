// src/api/timeline.ts
// =============================================
// Timeline / Sessions API facade
// 数据访问统一入口：真实接口与 Mock 在此切换
// - Components only import from here
// - 组件只从这里取数据，不感知 mock/real 的差异
// =============================================

import type { EventNode, Session } from '../types'

/** 
 * Base API URL from env (Vite)
 * 从环境变量读取 API 根地址（Vite）
 */
const API_BASE =
  (import.meta as any)?.env?.VITE_API_BASE?.replace(/\/$/, '') ?? ''

/**
 * Toggle mock vs real backend (set to false in prod)
 * 切换 mock / 真实接口（上线请设为 false 或用环境变量控制）
 */
const USE_MOCK = true

/** Shared query shape / 查询参数类型 */
type TimelineQuery = {
  q?: string
  characterIds?: string[]
  locationIds?: string[]
  questIds?: string[]
}

/* ============== Real fetchers / 真实接口实现 ============== */

/** Fetch sessions from backend / 从后端拉取会话分隔 */
async function _fetchSessionsReal(): Promise<Session[]> {
  const res = await fetch(`${API_BASE}/api/sessions`, { credentials: 'include' })
  if (!res.ok) throw new Error(`getSessions failed: ${res.status}`)
  return res.json()
}

/** Fetch timeline from backend / 从后端拉取时间线事件 */
async function _fetchTimelineReal(params: TimelineQuery): Promise<EventNode[]> {
  const sp = new URLSearchParams()
  if (params.q) sp.set('q', params.q)
  if (params.characterIds?.length) sp.set('characters', params.characterIds.join(','))
  if (params.locationIds?.length)  sp.set('locations', params.locationIds.join(','))
  if (params.questIds?.length)     sp.set('quests', params.questIds.join(','))
  const url = `${API_BASE}/api/timeline${sp.toString() ? `?${sp}` : ''}`

  const res = await fetch(url, { credentials: 'include' })
  if (!res.ok) throw new Error(`queryTimeline failed: ${res.status}`)
  return res.json()
}

/* ============== Mock fetchers（仅在 API 层模拟） ============== */

function _sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

/** Simulate sessions / 模拟会话分隔 */
async function _fetchSessionsMock(): Promise<Session[]> {
  await _sleep(200) // simulate latency / 模拟网络延迟
  const now = Date.now()
  return [
    { id: 's1', startedAt: now - 1000 * 60 * 60 * 24 * 4, title: 'Session 1: The Hook' },
    { id: 's2', startedAt: now - 1000 * 60 * 60 * 24 * 2, title: 'Session 2: Into the Vault' },
    { id: 's3', startedAt: now - 1000 * 60 * 60 * 24 * 1, title: 'Session 3: Night Chase' },
  ]
}

/** Simulate timeline / 模拟时间线事件 */
async function _fetchTimelineMock(params: TimelineQuery): Promise<EventNode[]> {
  await _sleep(250)
  const now = Date.now()
  const EVENTS: EventNode[] = [
    {
      id: 'e1',
      type: 'EVENT',
      title: 'Mysterious letter arrives',
      ts: now - 1000 * 60 * 60 * 24 * 4 + 1000 * 60 * 25,
      characters: ['Ava', 'Rook'],
      location: 'Ravenstreet Inn',
      questIds: ['q-hunt'],
      summary: 'A sealed letter invites the party to investigate a missing caravan near the old vault road.'
    },
    {
      id: 'e2',
      type: 'EVENT',
      title: 'Ambush at willow bend',
      ts: now - 1000 * 60 * 60 * 24 * 3 + 1000 * 60 * 50,
      characters: ['Ava', 'Rook', 'Thorn'],
      location: 'Willow Bend',
      questIds: ['q-hunt'],
      summary: 'Bandits linked to the vault syndicate attack. Captured scout warned about arcane locks.'
    },
    {
      id: 'e3',
      type: 'EVENT',
      title: 'First lock deciphered',
      ts: now - 1000 * 60 * 60 * 24 * 2 + 1000 * 60 * 5,
      characters: ['Rook'],
      location: 'Outer Vault Gate',
      questIds: ['q-vault'],
      summary: 'Rook recognized sigils from a forbidden tome. The lock responds to moonlight.'
    },
    {
      id: 'e4',
      type: 'EVENT',
      title: 'Night chase through market',
      ts: now - 1000 * 60 * 60 * 24 * 1 + 1000 * 60 * 20,
      characters: ['Ava', 'Thorn'],
      location: 'Moon Market',
      questIds: ['q-hunt', 'q-vault'],
      summary: 'A thief holding the second key fled into the crowd; Ava disabled the bridges with fog.'
    },
  ]

  // Simple client-side filter to simulate backend behavior
  // 简单客户端过滤，模拟服务端过滤行为
  let list = EVENTS.slice()

  if (params.q?.trim()) {
    const k = params.q.trim().toLowerCase()
    list = list.filter(e =>
      `${e.title} ${e.summary ?? ''} ${e.location ?? ''} ${(e.characters ?? []).join(' ')} ${(e.questIds ?? []).join(' ')}`
        .toLowerCase()
        .includes(k)
    )
  }
  if (params.characterIds?.length) {
    list = list.filter(e => e.characters?.some(id => params.characterIds!.includes(id)))
  }
  if (params.locationIds?.length) {
    list = list.filter(e => e.location && params.locationIds!.includes(e.location))
  }
  if (params.questIds?.length) {
    list = list.filter(e => (e.questIds ?? []).some(id => params.questIds!.includes(id)))
  }

  // Chronological order / 时间升序
  return list.sort((a, b) => a.ts - b.ts)
}

/* ============== Public API / 导出给组件使用 ============== */

/** Fetch session marks / 获取会话分隔 */
export async function getSessions(): Promise<Session[]> {
  return USE_MOCK ? _fetchSessionsMock() : _fetchSessionsReal()
}

/** Query timeline events / 查询时间线事件 */
export async function queryTimeline(params: TimelineQuery): Promise<EventNode[]> {
  return USE_MOCK ? _fetchTimelineMock(params) : _fetchTimelineReal(params)
}
