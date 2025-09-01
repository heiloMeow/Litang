import React, { useEffect, useState, useCallback, useMemo } from 'react'
import { getNodes, queryTimeline, subscribeGraph } from '../api/mock'
import type { Character, Location, Quest, EventNode } from '../types'

export default function Timeline() {
  const [chars, setChars] = useState<Character[]>([])
  const [locs, setLocs] = useState<Location[]>([])
  const [qs,   setQs]   = useState<Quest[]>([])

  const [selectedChars, setSelectedChars] = useState<string[]>([])
  const [selectedLocs,  setSelectedLocs]  = useState<string[]>([])
  const [selectedQs,    setSelectedQs]    = useState<string[]>([])

  const [events, setEvents] = useState<EventNode[]>([])
  const [loading, setLoading] = useState(false)

  const charName = useMemo(()=>Object.fromEntries(chars.map(c=>[c.id,c.name])),[chars])
  const locName  = useMemo(()=>Object.fromEntries(locs.map(l=>[l.id,l.name])),[locs])
  const qName    = useMemo(()=>Object.fromEntries(qs.map(q=>[q.id,q.name])),[qs])

  const load = useCallback(async () => {
    setLoading(true)
    const data = await queryTimeline({
      characterIds: selectedChars.length ? selectedChars : undefined,
      locationIds:  selectedLocs.length  ? selectedLocs  : undefined,
      questIds:     selectedQs.length    ? selectedQs    : undefined, // ← 新增
    })
    setEvents(data)
    setLoading(false)
  }, [selectedChars, selectedLocs, selectedQs])

  useEffect(() => {
    getNodes('CHARACTER').then(setChars)
    getNodes('LOCATION').then(setLocs)
    getNodes('QUEST').then(setQs)
    load()
    const off = subscribeGraph(() => { load() })
    return off
  }, [load])

  return (
    <div className="container">
      <div className="row">
        <select className="select" multiple value={selectedChars}
                onChange={(e)=> setSelectedChars(Array.from(e.target.selectedOptions).map(o=>o.value))}
                title="Filter by characters">
          {chars.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        <select className="select" multiple value={selectedLocs}
                onChange={(e)=> setSelectedLocs(Array.from(e.target.selectedOptions).map(o=>o.value))}
                title="Filter by locations">
          {locs.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>

        {/* 新增：Task筛选 */}
        <select className="select" multiple value={selectedQs}
                onChange={(e)=> setSelectedQs(Array.from(e.target.selectedOptions).map(o=>o.value))}
                title="Filter by quests">
          {qs.map(q => <option key={q.id} value={q.id}>{q.name}</option>)}
        </select>

        <button onClick={load}>Filter</button>
        <button onClick={() => { setSelectedChars([]); setSelectedLocs([]); setSelectedQs([]); }}>Clear</button>
      </div>

      {loading && <div className="small" style={{marginTop:8, opacity:.8}}>Loading…</div>}

      <div className="list" style={{marginTop:12}}>
        {events.map(e => (
          <div key={e.id} className="card">
            <div className="small">{new Date(e.ts).toLocaleString()}</div>
            <div style={{fontWeight:600, margin:'6px 0'}}>{e.title}</div>
            <div className="small">
              character：{(e.characters||[]).map(id=>charName[id]||id).join(', ') || '—'}
              {' | '}
              Location：{e.location ? (locName[e.location] || e.location) : '—'}
            </div>
            {/* 显示Task名 */}
            <div className="small" style={{marginTop:4}}>
              Quest: {(e.questIds||[]).map(id=>qName[id]||id).join(', ') || '—'}
            </div>
            {e.summary && <div style={{marginTop:6}}>{e.summary}</div>}
          </div>
        ))}
        {!loading && events.length === 0 && (
          <div className="small" style={{opacity:.8}}>No matched events.</div>
        )}
      </div>
    </div>
  )
}
