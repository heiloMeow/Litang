// src/components/GraphView.tsx
import React, { useEffect, useRef, useState } from 'react'
import cytoscape from 'cytoscape'
import { queryTimeline } from '../api/timeline'
import type { EventNode } from '../types'
import { graphStyles, ICONS } from './graphStyles'
import './graphView.css'

/** Lightweight node shapes only for building the graph in this component. */
type CharNode = { id: string; name: string }
type LocNode  = { id: string; name: string }
type QuestNode= { id: string; name: string; status?: string }

/** Edge relation kinds supported in the graph visualization. */
type EdgeRel  = 'PARTICIPATES' | 'OCCURS_AT' | 'ADVANCES_QUEST'

/** Directed edge between two nodes with a typed relation. */
type Edge     = { id: string; from: string; to: string; rel: EdgeRel }

/** In-memory graph structure rendered by Cytoscape. */
type GraphData = {
  nodes: {
    characters: CharNode[]
    locations:  LocNode[]
    quests:     QuestNode[]
    events:     EventNode[]
  }
  edges: Edge[]
}

/** Current selection state for the floating details panel. */
type Selected =
  | { kind: 'node'; nodeType: 'EVENT' | 'CHARACTER' | 'LOCATION' | 'QUEST'; id: string }
  | { kind: 'edge'; rel: EdgeRel; from: string; to: string }
  | null

/**
 * GraphView (full-bleed)
 * - Graph canvas fills the viewport height.
 * - Legend/Details is a floating overlay (toggle with a FAB).
 * - Small search bar is overlaid at top-left.
 */
export default function GraphView() {
  const ref = useRef<HTMLDivElement>(null)
  const cyRef = useRef<cytoscape.Core | null>(null)

  const [graphData, setGraphData] = useState<GraphData | null>(null)
  const [selected, setSelected]   = useState<Selected>(null)
  const [q, setQ]                 = useState('')
  const [loading, setLoading]     = useState(false)
  const [showLegend, setShowLegend] = useState(true)

  // Initialize Cytoscape once
  useEffect(() => {
    const cy = cytoscape({
      container: ref.current!,
      elements: [],
      layout: { name: 'cose', animate: false },
      style: graphStyles
    })
    cyRef.current = cy

    // Node tap → focus neighborhood + open details.
    cy.on('tap', 'node', (e) => {
      const n = e.target
      const d = n.data() as any
      cy.elements().removeClass('faded')
      const nb = n.closedNeighborhood()
      cy.elements().not(nb).addClass('faded')
      setSelected({ kind: 'node', nodeType: d.nodeType, id: d.id })
    })

    // Edge tap → focus connected nodes + open edge details.
    cy.on('tap', 'edge', (e) => {
      const edge = e.target
      cy.elements().removeClass('faded')
      const nb = edge.connectedNodes().union(edge)
      cy.elements().not(nb).addClass('faded')
      const d = edge.data() as any
      setSelected({ kind: 'edge', rel: d.rel, from: d.source, to: d.target })
    })

    // Tap on empty canvas → clear selection + defocus.
    cy.on('tap', (evt) => {
      if (evt.target === cy) {
        cy.elements().removeClass('faded')
        setSelected(null)
      }
    })

    const onResize = () => { cy.resize(); cy.fit(cy.elements(), 28) }
    window.addEventListener('resize', onResize)
    
    return () => { window.removeEventListener('resize', onResize); cy.destroy() }
  }, [])

  // Fetch timeline → build graph when `q` changes
  useEffect(() => {
    ;(async () => {
      setLoading(true)
      const events = await queryTimeline({ q })
      setGraphData(buildGraphFromEvents(events))
      setLoading(false)
    })()
  }, [q])

  // Render graphData into Cytoscape
  useEffect(() => {
    const cy = cyRef.current
    if (!cy || !graphData) return

    const elements: cytoscape.ElementDefinition[] = []
    const pushNodes = (arr: any[], group: 'char'|'loc'|'quest'|'event') => {
      arr.forEach((n: any) => elements.push({
        data: {
          id: n.id,
          label: n.name || n.title,
          nodeType:
            group === 'char' ? 'CHARACTER' :
            group === 'loc'  ? 'LOCATION'  :
            group === 'quest'? 'QUEST'     : 'EVENT',
          raw: n
        },
        classes: group
      }))
    }
    pushNodes(graphData.nodes.characters, 'char')
    pushNodes(graphData.nodes.locations,  'loc')
    pushNodes(graphData.nodes.quests,     'quest')
    pushNodes(graphData.nodes.events,     'event')

    graphData.edges.forEach(e => elements.push({
      data: { id: e.id, source: e.from, target: e.to, label: e.rel, rel: e.rel }
    }))

    cy.elements().remove()
    cy.add(elements)
    cy.layout({ name: 'cose', animate: false }).run()
    cy.fit(cy.elements(), 28)

    // If selected node is gone (e.g. filtered), clear selection.
    if (selected?.kind === 'node' && cy.getElementById(selected.id).length === 0) {
      setSelected(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graphData])

  return (
    <div className="graph-full" style={{ flex: 1, minHeight: 0, position: 'relative' }}>
      <div id="graph" ref={ref} />

      {/* Search overlay (top-left) */}
      <div className="overlay search-overlay">
        <input
          className="select"
          placeholder="Search in GraphView… (title / summary / char / loc / quest)"
          value={q}
          onChange={e => setQ(e.target.value)}
        />
        <button onClick={() => setQ(q.trim())}>Refresh</button>
        {loading && <span className="small" style={{ marginLeft: 8, opacity:.8 }}>Loading…</span>}
      </div>

      {/* Floating legend/details panel (top-right) */}
      {showLegend && (
        <div className="overlay legend-overlay">
          {!selected ? (
            <>
              <h3>Legend</h3>
              <LegendRow iconSrc={ICONS.event}  label="EVENT"     hint="Key story moment" />
              <LegendRow iconSrc={ICONS.char}   label="CHARACTER" hint="Participant / NPC" />
              <LegendRow iconSrc={ICONS.loc}    label="LOCATION"  hint="Where it happened (hierarchical)" />
              <LegendRow iconSrc={ICONS.quest}  label="QUEST"     hint="Main/side quest advanced" />

              <div style={{ marginTop: 12, fontWeight: 700 }}>Relations</div>
              <EdgeLegendRow label="PARTICIPATES"   color="#3498db" styleName="solid" />
              <EdgeLegendRow label="OCCURS_AT"      color="#2ecc71" styleName="dashed" />
              <EdgeLegendRow label="ADVANCES_QUEST" color="#e67e22" styleName="dotted" />

              <div className="small tip">
                Tip: click any node/edge on the canvas to see details; click empty canvas to clear highlight.
              </div>
            </>
          ) : (
            <DetailsPanel
              selected={selected as NonNullable<Selected>} // non-null here
              data={graphData}
            />
          )}
        </div>
      )}

      {/* FAB to toggle panel */}
      <button
        className="legend-fab"
        aria-label="Toggle legend"
        onClick={() => setShowLegend(v => !v)}
        title={showLegend ? 'Hide panel' : 'Show panel'}
      >
        {showLegend ? '✕' : 'ℹ️'}
      </button>
    </div>
  )
}

/** Build an in-memory graph from timeline events (dedupe & connect). */
function buildGraphFromEvents(events: EventNode[]): GraphData {
  const charMap  = new Map<string, CharNode>()
  const locMap   = new Map<string, LocNode>()
  const questMap = new Map<string, QuestNode>()
  const edges: Edge[] = []

  events.forEach((e) => {
    ;(e.characters ?? []).forEach((cid, j) => {
      if (!charMap.has(cid)) charMap.set(cid, { id: cid, name: cid })
      edges.push({ id: `par-${e.id}-${j}`, from: e.id, to: cid, rel: 'PARTICIPATES' })
    })
    if (e.location) {
      if (!locMap.has(e.location)) locMap.set(e.location, { id: e.location, name: e.location })
      edges.push({ id: `occ-${e.id}`, from: e.id, to: e.location, rel: 'OCCURS_AT' })
    }
    ;(e.questIds ?? []).forEach((qid, j) => {
      if (!questMap.has(qid)) questMap.set(qid, { id: qid, name: qid })
      edges.push({ id: `adv-${e.id}-${j}`, from: e.id, to: qid, rel: 'ADVANCES_QUEST' })
    })
  })

  return {
    nodes: {
      characters: Array.from(charMap.values()),
      locations:  Array.from(locMap.values()),
      quests:     Array.from(questMap.values()),
      events
    },
  edges }
}

/** Details panel (legend overlay turns into details when something is selected). */
function DetailsPanel(
  { selected, data }: { selected: NonNullable<Selected>; data: GraphData | null }
) {
  if (!data) return <p className="small">Loading…</p>

  // --- Edge branch (no nodeType here) ---
  if (selected.kind === 'edge') {
    const name = (id: string) =>
      data.nodes.characters.find(c => c.id === id)?.name
      || data.nodes.locations.find(l => l.id === id)?.name
      || data.nodes.quests.find(q => q.id === id)?.name
      || data.nodes.events.find(e => e.id === id)?.title
      || id
    return (
      <>
        <h3>Edge</h3>
        <KV k="Relation" v={selected.rel} />
        <KV k="From"     v={name(selected.from)} />
        <KV k="To"       v={name(selected.to)} />
      </>
    )
  }

  // --- Node branch (safe to use nodeType) ---
  const id = selected.id
  switch (selected.nodeType) {
    case 'EVENT': {
      const ev = data.nodes.events.find(x => x.id === id)!
      const locName   = ev.location ? (data.nodes.locations.find(l => l.id === ev.location)?.name ?? ev.location) : '—'
      const charNames = ev.characters?.map(cid => data.nodes.characters.find(c => c.id === cid)?.name ?? cid) ?? []
      const questNames= ev.questIds?.map(qid => data.nodes.quests.find(q => q.id === qid)?.name ?? qid) ?? []
      return (
        <>
          <h3>Event</h3>
          <KV k="Title" v={ev.title} />
          <KV k="Time"  v={fmt(ev.ts)} />
          <KV k="Location"   v={locName} />
          <KV k="Characters" v={charNames.length ? charNames.join(', ') : '—'} />
          <KV k="Quests"     v={questNames.length ? questNames.join(', ') : '—'} />
          {ev.summary && <KV k="Summary" v={ev.summary} multiline />}
        </>
      )
    }
    case 'CHARACTER': {
      const c = data.nodes.characters.find(x => x.id === id)!
      const participated = data.nodes.events.filter(e => e.characters?.includes(c.id)).sort((a, b) => a.ts - b.ts)
      return (
        <>
          <h3>Character</h3>
          <KV k="Name" v={c.name} />
          <KV k="Events" v={participated.length ? '' : '—'} />
          <ul className="small list">
            {participated.map(e => <li key={e.id}>{fmt(e.ts)} · {e.title}</li>)}
          </ul>
        </>
      )
    }
    case 'LOCATION': {
      const l = data.nodes.locations.find(x => x.id === id)!
      const happened = data.nodes.events.filter(e => e.location === l.id).sort((a, b) => a.ts - b.ts)
      return (
        <>
          <h3>Location</h3>
          <KV k="Name" v={l.name} />
          <KV k="Events" v={happened.length ? '' : '—'} />
          <ul className="small list">
            {happened.map(e => <li key={e.id}>{fmt(e.ts)} · {e.title}</li>)}
          </ul>
        </>
      )
    }
    case 'QUEST': {
      const qn = data.nodes.quests.find(x => x.id === id)!
      const advancedBy = data.nodes.events.filter(e => e.questIds?.includes(qn.id)).sort((a, b) => a.ts - b.ts)
      return (
        <>
          <h3>Quest</h3>
          <KV k="Name" v={qn.name} />
          <KV k="Advanced by" v={advancedBy.length ? '' : '—'} />
          <ul className="small list">
            {advancedBy.map(e => <li key={e.id}>{fmt(e.ts)} · {e.title}</li>)}
          </ul>
        </>
      )
    }
  }
}

/** Legend nodes & edges */
function LegendRow({ iconSrc, label, hint }: { iconSrc: string; label: string; hint?: string }) {
  return (
    <div className="legend-row">
      <img src={iconSrc} width={22} height={22} alt="" />
      <div>
        <div className="legend-label">{label}</div>
        {hint && <div className="legend-hint">{hint}</div>}
      </div>
    </div>
  )
}

function EdgeLegendRow({ label, color, styleName }: { label: string; color: string; styleName: 'solid'|'dashed'|'dotted' }) {
  const dash = styleName === 'solid' ? '' : (styleName === 'dashed' ? '6,4' : '2,4')
  return (
    <div className="legend-row">
      <svg width="22" height="14" aria-hidden>
        <line x1="2" y1="7" x2="20" y2="7" stroke={color} strokeWidth="2" strokeDasharray={dash} />
        <polygon points="20,7 16,5 16,9" fill={color} />
      </svg>
      <div className="legend-edge-label">{label}</div>
    </div>
  )
}

/** Small key-value utility for details panel. */
function KV({ k, v, multiline }: { k: string; v: string; multiline?: boolean }) {
  return (
    <div className="kv">
      <div className="kv-k">{k}</div>
      {multiline ? <div className="kv-v multiline">{v}</div> : <div className="kv-v">{v}</div>}
    </div>
  )
}

/** Format timestamp. */
function fmt(ts: number) {
  try { return new Date(ts).toLocaleString() } catch { return String(ts) }
}
