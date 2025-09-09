/**
 * src/components/Edit.tsx
 * -------------------------------------------------------------
 * ZH：Edit（最小实现）。左侧列表 + 右侧表单，用于编辑角色/地点/任务。
 *     数据来源优先 localStorage，若为空则由 timeline 的 mock 事件派生。
 * EN: Edit (minimal). Left list + right form to edit Characters/Locations/Quests.
 *     Prefers localStorage; falls back to seeds derived from timeline mock events.
 */
import React, { useEffect, useMemo, useState } from 'react'
import type { Character, Location, Quest } from '../types'
import { listEntities, upsertEntity, removeEntity, type EntityKind } from '../api/edit'
import './Edit.css'

// ZH：抽象出三类模型的并集类型；编辑表单共享此类型
// EN: Union type of three models; shared by the editor form
type Model = Character | Location | Quest

// ZH：保留的工具（当前未用，若恢复“新建”功能可复用）
// EN: Kept utility (unused now). Could be reused if "New" returns
function uid(prefix: string) { return `${prefix}-${Math.random().toString(36).slice(2, 8)}` }

export default function Edit() {
  // ZH：编辑上下文（类型、列表、当前项、UI 状态）
  // EN: Editing context (kind, list, current item, UI states)
  const [kind, setKind] = useState<EntityKind>('CHARACTER')
  const [list, setList] = useState<Model[]>([])
  const [activeId, setActiveId] = useState<string>('')
  const active = useMemo(() => list.find(x => x.id === activeId) as Model | undefined, [list, activeId])
  const [saving, setSaving] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [msg, setMsg] = useState<string>('')
  const [q, setQ] = useState('')

  // ZH：可编辑草稿（基于选中项初始化）
  // EN: Local editable draft (initialized from active item)
  const [draft, setDraft] = useState<Model | null>(null)

  // ZH：切换类型时载入列表（优先本地，空则从 timeline 派生）
  // EN: Load list when kind changes (prefer local, derive from timeline if empty)
  useEffect(() => {
    let alive = true
    ;(async () => {
      const data = await listEntities(kind as any)
      if (!alive) return
      setList(data)
      if (data.length) setActiveId((data[0] as any).id)
      setDraft(data.length ? (data[0] as any) : null)
    })()
    return () => { alive = false }
  }, [kind])

  // ZH：改变选中项时，同步草稿
  // EN: Sync draft when active selection changes
  useEffect(() => {
    if (active) setDraft(active)
  }, [activeId])

  // ZH：根据需求移除了“新建”，仅允许编辑或删除现有项
  // EN: "New" removed per request; only edit/delete existing items

  /**
   * ZH：保存当前草稿到本地存储，并刷新列表
   * EN: Persist current draft to local storage and refresh the list
   */
  async function onSave() {
    if (!draft) return
    setSaving(true)
    try {
      await upsertEntity(kind as any, draft as any)
      const data = await listEntities(kind as any)
      setList(data)
      setActiveId((draft as any).id)
      setMsg('Saved')
      setTimeout(() => setMsg(''), 1200)
    } finally { setSaving(false) }
  }

  /**
   * ZH：删除当前选中项（带浏览器 confirm）
   * EN: Delete the current selection (with browser confirm)
   */
  async function onDelete() {
    if (!activeId) return
    if (!confirm('Delete this item?')) return
    setRemoving(true)
    try {
      await removeEntity(kind as any, activeId)
      const data = await listEntities(kind as any)
      setList(data)
      setActiveId(data[0]?.id || '')
      setDraft(data[0] || null)
      setMsg('Deleted')
      setTimeout(() => setMsg(''), 1200)
    } finally { setRemoving(false) }
  }

  // ZH：统一的表单行渲染
  // EN: Render a labeled form row
  function field(label: string, node: React.ReactNode) {
    return (
      <div className="row">
        <label className="small" style={{ width: 120, opacity: .8 }}>{label}</label>
        <div style={{ flex: 1 }}>{node}</div>
      </div>
    )
  }

  return (
    <div className="container">
      <div className="row" style={{ marginBottom: 10 }}>
        <select className="select" value={kind} onChange={e => setKind(e.target.value as EntityKind)}>
          <option value="CHARACTER">Characters</option>
          <option value="LOCATION">Locations</option>
          <option value="QUEST">Quests</option>
        </select>
        <input className="select right" placeholder="Filter by name or id" value={q} onChange={e => setQ(e.target.value)} style={{ minWidth: 200 }} />
      </div>

      <section className="edit-grid">
        {/* List */}
        <div className="card">
          <div className="row" style={{ marginBottom: 8 }}>
            <strong>Items</strong>
            <div className="right" />
            <span className="small" style={{ opacity: .7 }}>{list.length} total</span>
          </div>
          <div className="edit-list">
            {list.filter(item => {
              const text = `${(item as any).id} ${(item as any).name || ''}`.toLowerCase()
              return !q.trim() || text.includes(q.trim().toLowerCase())
            }).map(item => (
              <div key={(item as any).id} className={`edit-item ${activeId === (item as any).id ? 'is-active' : ''}`} onClick={() => setActiveId((item as any).id)}>
                <span>{(item as any).name || (item as any).id}</span>
                <span className="small" style={{ opacity: .7 }}>{(item as any).id}</span>
              </div>
            ))}
            {list.length === 0 && <div className="small" style={{ opacity: .8 }}>No items available.</div>}
          </div>
        </div>

        {/* Editor */}
        <div className="card">
          <div className="row" style={{ marginBottom: 8 }}>
            <strong>Editor</strong>
            <div className="right" />
            {msg && <span className="small" style={{ opacity: .8 }}>{msg}</span>}
          </div>
          {!draft && <div className="small" style={{ opacity: .8 }}>Select an item from the list to edit.</div>}
          {draft && (
            <div className="edit-form">
              {field('ID', <input className="select" value={(draft as any).id} disabled />)}
              {field('Name', <input className="select" value={(draft as any).name || ''} onChange={e => setDraft({ ...(draft as any), name: e.target.value } as Model)} />)}
              {kind === 'CHARACTER' && field('Tags', <input className="select" placeholder="comma,separated" value={((draft as Character).tags || []).join(', ')} onChange={e => setDraft({ ...(draft as Character), tags: e.target.value.split(',').map(s => s.trim()).filter(Boolean) } as any)} />)}
              {kind === 'LOCATION' && field('Parent ID', <input className="select" placeholder="optional" value={(draft as Location).parentId || ''} onChange={e => setDraft({ ...(draft as Location), parentId: e.target.value || undefined } as any)} />)}
              {kind === 'QUEST' && field('Status', (
                <select className="select" value={(draft as Quest).status} onChange={e => setDraft({ ...(draft as Quest), status: e.target.value as Quest['status'] } as any)}>
                  <option value="OPEN">OPEN</option>
                  <option value="ONGOING">ONGOING</option>
                  <option value="DONE">DONE</option>
                </select>
              ))}

              <div className="edit-actions">
                <button onClick={onSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
                <button onClick={onDelete} disabled={!activeId || removing}>{removing ? 'Deleting...' : 'Delete'}</button>
                <button onClick={() => setDraft(active!)} disabled={!active}>Revert</button>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
