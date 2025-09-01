// src/components/Recall.tsx
import React, { useEffect, useState, useCallback, useMemo } from 'react'
import { getNodes, queryTimeline, subscribeGraph } from '../api/mock'
import type { Character, Location, Quest, EventNode } from '../types'

export default function Recall() {
  const [chars, setChars] = useState<Character[]>([])
  const [locs,  setLocs]  = useState<Location[]>([])
  const [qs,    setQs]    = useState<Quest[]>([])
  const [kw, setKw] = useState('')
  const [events, setEvents] = useState<EventNode[]>([])
  const [results, setResults] = useState<EventNode[]>([])
  const [loading, setLoading] = useState(false)

  // 便于把 id→name 映射出来用于匹配与展示
  const charName = useMemo(()=>Object.fromEntries(chars.map(c=>[c.id,c.name])),[chars])
  const locName  = useMemo(()=>Object.fromEntries(locs.map(l=>[l.id,l.name])),[locs])
  const qName    = useMemo(()=>Object.fromEntries(qs.map(q=>[q.id,q.name])),[qs])

  // 拉全量事件（Recall 现在改为前端纯关键词过滤）
  const loadAll = useCallback(async () => {
    setLoading(true)
    const data = await queryTimeline({}) // 全量（mock 会合并 base+live）
    setEvents(data)
    setLoading(false)
  }, [])

  // 订阅流式更新：数据一变就重新拉全量
  useEffect(() => {
    loadAll()
    const off = subscribeGraph(() => { loadAll() })
    return off
  }, [loadAll])

  // 同时加载元数据（名字映射用）
  useEffect(() => {
    getNodes('CHARACTER').then(setChars)
    getNodes('LOCATION').then(setLocs)
    getNodes('QUEST').then(setQs)
  }, [])

  // 关键词过滤（防抖 200ms）
  useEffect(() => {
    const t = setTimeout(() => {
      const k = kw.trim().toLowerCase()
      if (!k) { setResults(events); return }
      const match = (text?: string) => (text ?? '').toLowerCase().includes(k)
      const matched = events.filter(e => {
        if (match(e.title) || match(e.summary)) return true
        const loc = e.location ? (locName[e.location] || e.location) : ''
        if (match(loc)) return true
        const anyChar = (e.characters||[]).some(id => match(charName[id] || id))
        if (anyChar) return true
        const anyQuest = (e.questIds||[]).some(id => match(qName[id] || id))
        if (anyQuest) return true
        return false
      })
      setResults(matched)
    }, 200)
    return () => clearTimeout(t)
  }, [kw, events, charName, locName, qName])

  return (
    <div className="container">
      <div className="row" style={{ display: 'flex' }}>
        <input
          className="select"
          placeholder="Search for Event / Quest / Character / Location ..."
          value={kw}
          onChange={e=>setKw(e.target.value)}
          style={{ flex: 1, marginRight: 8 }} // 占满剩余空间
        />
        <button onClick={() => setKw('')}>Clear</button>
      </div>



      {loading && <div className="small" style={{marginTop:8, opacity:.8}}>Loading…</div>}

      <div className="list" style={{marginTop:12}}>
        {results.map(e => (
          <div key={e.id} className="card">
            <div className="small">{new Date(e.ts).toLocaleString()}</div>
            <div style={{fontWeight:600, margin:'6px 0'}}>{e.title}</div>
            {e.summary && <div style={{marginTop:6}}>{e.summary}</div>}
            <div className="small" style={{marginTop:6}}>
              Character：{(e.characters||[]).map(id=>charName[id]||id).join(', ') || '—'}
              {' | '}Location：{e.location ? (locName[e.location]||e.location) : '—'}
              {' | '}Quest：{(e.questIds||[]).map(id=>qName[id]||id).join(', ') || '—'}
            </div>
          </div>
        ))}

        {!loading && results.length === 0 && (
          <div className="small" style={{opacity:.8}}>No results found.</div>
        )}
      </div>
    </div>
  )
}
