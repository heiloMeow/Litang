// src/api/edit.ts
// -------------------------------------------------------------
// ZH：Edit 页面用的最小 API。以本地存储为先，初次无数据时
//     从 Timeline 的 mock 事件中派生出角色/地点/任务作为初始值。
// EN: Minimal API for the Edit page. Prefers localStorage; when empty,
//     derives initial Characters/Locations/Quests from Timeline mock events.

import type { Character, Location, Quest } from '../types'
import { queryTimeline } from './timeline'

/**
 * ZH：可编辑的实体类型
 * EN: Editable entity kinds
 */
export type EntityKind = 'CHARACTER' | 'LOCATION' | 'QUEST'

/**
 * ZH：本地存储键名（按类型分表）
 * EN: LocalStorage keys per entity kind
 */
const KEY = {
  CHARACTER: 'ds_edit_characters',
  LOCATION: 'ds_edit_locations',
  QUEST: 'ds_edit_quests'
} as const

/**
 * ZH：读/写本地存储的工具函数
 * EN: Helpers to read/write localStorage
 */
function read<T>(k: EntityKind): T[] {
  try { return JSON.parse(localStorage.getItem(KEY[k]) || '[]') as T[] } catch { return [] }
}
function write<T>(k: EntityKind, arr: T[]) {
  localStorage.setItem(KEY[k], JSON.stringify(arr))
}

/**
 * listEntities
 * - ZH：先读本地；若为空，则从 timeline 事件动态派生（mock 种子）。
 * - EN: Prefer local data; if empty, derive seeds from timeline events (mock source).
 */
export async function listEntities(kind: EntityKind): Promise<any[]> {
  const local = read<any>(kind)
  if (local.length > 0) return local
  // Fallback seeds derived from timeline mock/events
  const events = await queryTimeline({})
  if (kind === 'CHARACTER') {
    const names = Array.from(new Set(events.flatMap(e => e.characters || [])))
    return names.map(n => ({ id: n, name: n, tags: [] as string[] })) as Character[]
  }
  if (kind === 'LOCATION') {
    const locs = Array.from(new Set(events.flatMap(e => (e.location ? [e.location] : []))))
    return locs.map(n => ({ id: n, name: n })) as Location[]
  }
  // QUEST
  const qids = Array.from(new Set(events.flatMap(e => e.questIds || [])))
  return qids.map(id => ({ id, name: id, status: 'ONGOING' as const })) as Quest[]
}

/**
 * upsertEntity
 * - ZH：按 id 插入或更新，写回到本地存储。
 * - EN: Insert or update by id, persisted to localStorage.
 */
export async function upsertEntity(kind: EntityKind, data: any): Promise<void> {
  const list = await listEntities(kind)
  const idx = list.findIndex((x: any) => x.id === data.id)
  const next = idx >= 0 ? [...list.slice(0, idx), data, ...list.slice(idx + 1)] : [...list, data]
  write(kind, next)
}

/**
 * removeEntity
 * - ZH：删除指定 id 的实体。
 * - EN: Delete entity by id.
 */
export async function removeEntity(kind: EntityKind, id: string): Promise<void> {
  const list = await listEntities(kind)
  const next = (list as any[]).filter(x => x.id !== id)
  write(kind, next)
}
