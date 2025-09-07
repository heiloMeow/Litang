// types.ts
// ===========================
// 全局类型定义文件
// Global type definitions
// 用于前端组件和 API 之间共享的数据结构
// Used to share data structures between frontend components and APIs
// ===========================

/** 
 * 节点类型（Graph 中的基本分类）
 * Node types (basic categories in the graph)
 */
export type NodeType =
  | "CHARACTER"  // 角色 / Character
  | "LOCATION"   // 地点 / Location
  | "QUEST"      // 任务 / Quest
  | "NPC"        // 非玩家角色 / NPC
  | "LORE"       // 设定/背景知识 / Lore
  | "ITEM"       // 道具 / Item
  | "EVENT";     // 事件 / Event

/**
 * 应用的主要导航标签
 * Main navigation tabs of the app
 */
export const TABS = ['Session', 'Timeline', 'Recall', 'Graph'] as const
export type Tab = typeof TABS[number]  // "Session" | "Timeline" | "Recall" | "Graph"

/** 
 * Character — 角色
 * - id: 唯一标识符 / unique ID
 * - name: 名称 / display name
 * - tags: 可选标签（如职业、阵营）/ optional tags (e.g. class, alignment)
 */
export interface Character {
  id: string
  name: string
  tags?: string[]
}

/**
 * Location — 地点
 * - id: 唯一标识符 / unique ID
 * - name: 地点名 / location name
 * - parentId: 上级地点（可选）/ parent location (optional)
 */
export interface Location {
  id: string
  name: string
  parentId?: string
}

/**
 * Quest — 任务
 * - id: 唯一标识符 / unique ID
 * - name: 任务名 / quest name
 * - status: 任务状态 / quest status
 *   - "OPEN" 新建但未开始 / newly available
 *   - "ONGOING" 正在进行中 / in progress
 *   - "DONE" 已完成 / finished
 */
export interface Quest {
  id: string
  name: string
  status: "OPEN" | "ONGOING" | "DONE"
}

/**
 * EventNode — 游戏事件节点
 * - id: 唯一标识符 / unique ID
 * - type: 类型固定为 "EVENT" / always "EVENT"
 * - title: 事件标题 / event title
 * - ts: 时间戳（毫秒）/ timestamp in ms
 * - characters: 参与的角色 ID 列表 / involved character IDs
 * - location: 地点 ID（可选）/ location ID (optional)
 * - questIds: 相关任务 ID 列表（可选）/ related quest IDs (optional)
 * - summary: 事件描述 / summary text
 */
export interface EventNode {
  id: string
  type: "EVENT"
  title: string
  ts: number
  characters: string[]
  location?: string
  questIds?: string[]
  summary?: string
}

/**
 * Edge — 图谱中的关系边
 * - id: 唯一标识符 / unique ID
 * - from: 起点节点 ID / source node ID
 * - to: 终点节点 ID / target node ID
 * - rel: 关系类型 / relationship type
 *   - "OCCURS_AT"   事件发生在某地点 / event occurs at location
 *   - "PARTICIPATES"角色参与事件 / character participates in event
 *   - "ADVANCES_QUEST"事件推动任务 / event advances quest
 *   - "INTERACTS"   角色交互 / character interaction
 *   - "REFERS"      文本/事件提及 / reference
 */
export interface Edge {
  id: string
  from: string
  to: string
  rel: "OCCURS_AT" | "PARTICIPATES" | "ADVANCES_QUEST" | "INTERACTS" | "REFERS"
}

/**
 * Session — 会话
 * - id: 唯一标识符 / unique ID
 * - title: 会话标题（可选）/ session title (optional)
 * - startedAt: 开始时间戳 / start timestamp
 * - endedAt: 结束时间戳（可选）/ end timestamp (optional)
 */
export interface Session {
  id: string
  title?: string
  startedAt: number
  endedAt?: number
}
