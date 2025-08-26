import React, { useEffect, useState, useCallback, useMemo } from 'react'
import { getNodes, recall, subscribeGraph } from '../api/mock'
import type { Character, Location, Quest } from '../types'

export default function Recall() {
  const [mode, setMode] = useState<'character'|'location'|'quest'>('character')
  const [chars, setChars] = useState<Character[]>([])
  const [locs, setLocs] = useState<Location[]>([])
  const [qs,   setQs]   = useState<Quest[]>([])
  const [id, setId] = useState<string>('')
  const [kw, setKw] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const qName = useMemo(()=>Object.fromEntries(qs.map(q=>[q.id,q.name])),[qs])

  const run = useCallback(async () => {
    if (!id) { setResults([]); return }
    setLoading(true)
    const data = await recall(mode, id, kw) // 现在每条会带 questIds（mock 已改）
    setResults(data)
    setLoading(false)
  }, [mode, id, kw])

  useEffect(()=>{
    getNodes('CHARACTER').then(d => { setChars(d); if (!id && d[0]) setId(d[0].id) })
    getNodes('LOCATION').then(setLocs)
    getNodes('QUEST').then(setQs)
  },[])

  useEffect(()=>{
    run()
    const off = subscribeGraph(() => { run() })
    return off
  }, [run])

  const options = mode==='character' ? chars : mode==='location' ? locs : qs

  return (
    <div className="container">
      <div className="row">
        <select className="select" value={mode} onChange={e=>{ setMode(e.target.value as any); setId(''); }}>
          <option value="character">By Character</option>
          <option value="location">By Location</option>
          <option value="quest">By Quest</option>
        </select>
        <select className="select" value={id} onChange={e=>setId(e.target.value)}>
          <option value="" disabled>Please choose</option>
          {options.map((o:any)=><option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
        <input className="select" placeholder="keyword..." value={kw} onChange={e=>setKw(e.target.value)} />
        <button onClick={run}>Recall</button>
      </div>

      {loading && <div className="small" style={{marginTop:8, opacity:.8}}>Loading…</div>}

      <div className="list" style={{marginTop:12}}>
        {results.map(r => (
          <div key={r.id} className="card">
            <div className="small">{new Date(r.ts).toLocaleString()}</div>
            <div style={{fontWeight:600, margin:'6px 0'}}>{r.title}</div>
            {/* 显示Task名：mock.recall 已返回 questIds */}
            <div className="small" style={{marginTop:4}}>
              Task：{(r.questIds||[]).map((qid:string)=> qName[qid] || qid).join(', ') || '—'}
            </div>
            {r.excerpt && <div style={{marginTop:6}}>{r.excerpt}</div>}
          </div>
        ))}
        {!loading && results.length === 0 && (
          <div className="small" style={{opacity:.8}}>No results.</div>
        )}
      </div>
    </div>
  )
}
