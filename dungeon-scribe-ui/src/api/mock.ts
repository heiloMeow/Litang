// src/api/mock.ts
import type { Character, Location, Quest, EventNode, Edge, Session } from '../types'

/* =======================
 * 世界静态数据（写死）
 * ======================= */

export const characters: Character[] = [
  { id:'c-rogue', name:'Nyx the Rogue', tags:['stealth'] },
  { id:'c-mage',  name:'Eira the Mage', tags:['arcane'] },
  { id:'c-dm',    name:'DM' }
]

export const locations: Location[] = [
  { id:'l-town',  name:'Ravenshade' },
  { id:'l-vault', name:'Obsidian Vault', parentId:'l-town' }
]

export const quests: Quest[] = [
  { id:'q-heist', name:'The Vault Heist', status:'ONGOING' }
]
edges: [
  { data: { source: 'c-rogue', target: 'e-1', label: 'participates', type: 'character-event' } },
  { data: { source: 'l-town', target: 'e-1', label: 'location', type: 'location-event' } },
  { data: { source: 'q-vault', target: 'e-1', label: 'quest', type: 'quest-event' } }
]

// 基础事件（一直保留在世界里）
export const baseEvents: EventNode[] = [

]

/* =======================
 * 工具：由事件生成边
 * ======================= */

function edgesFrom(events: EventNode[]): Edge[] {
  const edges: Edge[] = []
  events.forEach((e) => {
    if (e.location) {
      edges.push({ id: `occ-${e.id}`, from: e.id, to: e.location, rel: 'OCCURS_AT' })
    }
    e.questIds?.forEach((q, j) => {
      edges.push({ id: `adv-${e.id}-${j}`, from: e.id, to: q, rel: 'ADVANCES_QUEST' })
    })
    e.characters?.forEach((c, j) => {
      edges.push({ id: `par-${e.id}-${j}`, from: e.id, to: c, rel: 'PARTICIPATES' })
    })
  })
  return edges
}

/* =======================
 * Graph 聚合 & 订阅（实时）
 * ======================= */

export type GraphData = {
  nodes: { characters: Character[]; locations: Location[]; quests: Quest[]; events: EventNode[] }
  edges: Edge[]
}

let currentSessionEvents: EventNode[] = []                // 本局新产生的事件
let graphSubscribers: Array<(g: GraphData) => void> = []  // 订阅者
let streamTimer: number | null = null                     // setInterval 句柄
let streamCounter = 0

function buildGraph(): GraphData {
  const allEvents = [...baseEvents, ...currentSessionEvents]
  return { nodes: { characters, locations, quests, events: allEvents }, edges: edgesFrom(allEvents) }
}

function emitUpdate() {
  const g = buildGraph()
  graphSubscribers.forEach(fn => {
    try { fn(g) } catch {}
  })
}

// 供组件订阅：挂载时立刻推一次，返回取消订阅函数
export function subscribeGraph(cb: (g: GraphData) => void): () => void {
  graphSubscribers.push(cb)
  cb(buildGraph())
  return () => { graphSubscribers = graphSubscribers.filter(f => f !== cb) }
}

// 非订阅式一次性获取（比如初始化用）
export async function getGraph(): Promise<GraphData> {
  return buildGraph()
}

/* =======================
 * 会话（Start / End / 存档）
 * ======================= */

const SESS_KEY = 'ds_sessions'
const ACTIVE_KEY = 'ds_activeSessionId'
const ARCHIVE_PREFIX = 'ds_archive_' // ds_archive_<sessionId> 里存本局事件

function readSessions(): Session[] {
  try { return JSON.parse(localStorage.getItem(SESS_KEY) || '[]') } catch { return [] }
}
function writeSessions(arr: Session[]) { localStorage.setItem(SESS_KEY, JSON.stringify(arr)) }

export async function getSessions(): Promise<Session[]> {
  return readSessions()
}

export async function getActiveSession(): Promise<Session | null> {
  const id = localStorage.getItem(ACTIVE_KEY)
  if (!id) return null
  return readSessions().find(s => s.id === id) ?? null
}

// 开始：清空“本局事件”，每2秒生成一条新事件并广播；若已有流，先停
export async function startSession(title?: string): Promise<Session> {
  if (streamTimer) { clearInterval(streamTimer); streamTimer = null }

  const now = Date.now()
  const s: Session = { id: `sess-${now}`, title, startedAt: now }
  const list = readSessions(); list.push(s); writeSessions(list)
  localStorage.setItem(ACTIVE_KEY, s.id)

  currentSessionEvents = []
  streamCounter = 0
  emitUpdate()

  // 简易“事件工厂”
  const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)]
  const titles = [
    'Footsteps in the Alley', 'A Whispered Warning', 'Broken Seal',
    'Secret Passage Found', 'Unexpected Patrol', 'Silent Incantation'
  ]

  streamTimer = window.setInterval(() => {
    streamCounter++
    const id = `s-${now}-${streamCounter}`
    const ts = Date.now()
    const ch: Character[] = [pick(characters)]
    if (Math.random() > 0.6) ch.push(pick(characters))             // 偶尔两个角色
    const loc = pick(locations)
    const maybeQuest = Math.random() > 0.4 ? [quests[0].id] : undefined

    const ev: EventNode = {
      id, type:'EVENT', title: pick(titles), ts,
      characters: ch.map(x => x.id),
      location: loc.id,
      questIds: maybeQuest,
      summary: 'Live event (mock stream)…'
    }
    currentSessionEvents.push(ev)
    emitUpdate()
  }, 2000)

  return s
}

// 结束：停止流 + 存档本局事件 + 清空画面并广播
// 结束：停止流 + 存档，但不清空画面（仅在下一次 start 时清空）
export async function endSession(id: string): Promise<Session> {
  if (streamTimer) { clearInterval(streamTimer); streamTimer = null }

  // 存档本局事件（但不清空 currentSessionEvents）
  localStorage.setItem(ARCHIVE_PREFIX + id, JSON.stringify(currentSessionEvents))

  // 更新会话表（写入结束时间）
  const arr = readSessions()
  const idx = arr.findIndex(s => s.id === id)
  if (idx >= 0 && !arr[idx].endedAt) arr[idx].endedAt = Date.now()
  writeSessions(arr)

  // 解除激活会话
  const active = localStorage.getItem(ACTIVE_KEY)
  if (active === id) localStorage.removeItem(ACTIVE_KEY)

  // 可选广播：事件没变，但触发订阅者刷新状态也无妨
  emitUpdate()

  return arr[idx]
}


// 读取某次存档（你以后要加载历史时用）
export async function getArchive(sessionId: string): Promise<EventNode[]> {
  try { return JSON.parse(localStorage.getItem(ARCHIVE_PREFIX + sessionId) || '[]') }
  catch { return [] }
}

/* =======================
 * 节点列表 / 时间线 / 回忆
 * ======================= */

// getNodes —— 带重载，类型安全
export function getNodes(type: 'CHARACTER'): Promise<Character[]>
export function getNodes(type: 'LOCATION'):  Promise<Location[]>
export function getNodes(type: 'QUEST'):     Promise<Quest[]>
export async function getNodes(type: 'CHARACTER'|'LOCATION'|'QUEST') {
  if (type === 'CHARACTER') return characters
  if (type === 'LOCATION')  return locations
  return quests
}

// 时间线查询（合并 base + 当前流式事件）
export async function queryTimeline(params: {
  from?: number; to?: number;
  characterIds?: string[]; locationIds?: string[];
  questIds?: string[]; //
}) {
  let list = [...baseEvents, ...currentSessionEvents]
  if (params.from) list = list.filter(e => e.ts >= params.from!)
  if (params.to)   list = list.filter(e => e.ts <= params.to!)
  if (params.characterIds?.length) list = list.filter(e => e.characters?.some(id => params.characterIds!.includes(id)))
  if (params.locationIds?.length)  list = list.filter(e => e.location && params.locationIds!.includes(e.location))
  return list.sort((a,b)=>a.ts-b.ts)
}

// 回忆（按角色/地点/任务 + 关键词）
export async function recall(by: 'character'|'location'|'quest', id: string, kw?: string) {
  const all = [...baseEvents, ...currentSessionEvents]
  let list = all.filter(e =>
    (by==='character' && e.characters?.includes(id)) ||
    (by==='location'  && e.location === id) ||
    (by==='quest'     && e.questIds?.includes(id))
  )
  if (kw?.trim()) {
    const k = kw.trim().toLowerCase()
    list = list.filter(e =>
      e.title.toLowerCase().includes(k) ||
      (e.summary?.toLowerCase().includes(k) ?? false)
    )
  }
  return list
  .sort((a,b)=>a.ts-b.ts)
  .map(e => ({
    id: e.id,
    title: e.title,
    ts: e.ts,
    excerpt: e.summary ?? '',
    questIds: e.questIds ?? [],     // ← 新增
    location: e.location ?? null,   // （可选，顺带放上）
    characters: e.characters ?? []  // （可选）
  }))
}

/* =======================
 * 兼容占位（可有可无）
 * ======================= */

export async function getCampaigns() {
  return [{ id:'demo', name:'Demo Campaign', createdAt: Date.now() - 86400000 }]
}
export async function selectCampaign(id: string) { return { ok: true } }
