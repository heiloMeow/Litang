// src/components/GraphView.tsx
import React, { useEffect, useRef, useState } from 'react'
import cytoscape from 'cytoscape'
import { subscribeGraph } from '../api/mock'
import type { GraphData } from '../api/mock'
import type { Edge } from '../types'

type Selected =
  | { kind: 'node'; nodeType: 'EVENT' | 'CHARACTER' | 'LOCATION' | 'QUEST'; id: string }
  | { kind: 'edge'; rel: Edge['rel']; from: string; to: string }
  | null

// Local icons: put files under public/icons/
const ICONS = {
  char:  '/icons/character.svg',
  loc:   '/icons/location.svg',
  quest: '/icons/quest.svg',
  event: '/icons/event.svg',
}

export default function GraphView() {
  const ref = useRef<HTMLDivElement>(null)
  const cyRef = useRef<cytoscape.Core | null>(null)
  const [graphData, setGraphData] = useState<GraphData | null>(null)
  const [selected, setSelected] = useState<Selected>(null)

  // 1) Init Cytoscape (once)
  useEffect(() => {
    const cy = cytoscape({
      container: ref.current!,
      elements: [],
      layout: { name: 'cose', animate: false },
      style: [
        // Nodes: common
        {
          selector: 'node',
          style: {
            width: 54,
            height: 54,
            'background-color': '#1a2230',
            'border-width': 1,
            'border-color': '#2d3a59',
            label: 'data(label)',
            'font-size': '10px',
            color: '#e6e6e6',
            'text-wrap': 'wrap',
            'text-max-width': '120px',
            'text-valign': 'bottom',
            'text-halign': 'center',
            'text-margin-y': 8,
          }
        },
        // Node categories with local icons
        {
          selector: '.char',
          style: {
            shape: 'round-rectangle',
            'background-image': ICONS.char,
            'background-fit': 'contain',
            'background-clip': 'node',
            'background-opacity': 1,
            'background-width': '70%',
            'background-height': '70%',
            'background-position-x': '50%',
            'background-position-y': '50%',
          }
        },
        {
          selector: '.loc',
          style: {
            shape: 'rectangle',
            'background-image': ICONS.loc,
            'background-fit': 'contain',
            'background-clip': 'node',
            'background-opacity': 1,
            'background-width': '70%',
            'background-height': '70%',
            'background-position-x': '50%',
            'background-position-y': '50%',
          }
        },
        {
          selector: '.quest',
          style: {
            shape: 'ellipse',
            'background-image': ICONS.quest,
            'background-fit': 'contain',
            'background-clip': 'node',
            'background-opacity': 1,
            'background-width': '70%',
            'background-height': '70%',
            'background-position-x': '50%',
            'background-position-y': '50%',
          }
        },
        {
          selector: '.event',
          style: {
            shape: 'diamond',
            'background-image': ICONS.event,
            'background-fit': 'contain',
            'background-clip': 'node',
            'background-opacity': 1,
            'background-width': '70%',
            'background-height': '70%',
            'background-position-x': '50%',
            'background-position-y': '50%',
          }
        },

        // ====== Edges: base style ======
        {
          selector: 'edge',
          style: {
            width: 1,
            'line-color': '#2d3a59',
            'target-arrow-color': '#2d3a59',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            label: 'data(label)',
            'font-size': '8px',
            color: '#9aa3b2',
            'text-background-color': '#0f1219',
            'text-background-opacity': 0.8,  // string to appease TS
            'text-background-padding': '2',
            'text-background-shape': 'roundrectangle',
          }
        },
        // ====== Edges: per relationship (uses data(rel)) ======
        // PARTICIPATES → blue solid
        {
          selector: 'edge[rel = "PARTICIPATES"]',
          style: {
            'line-color': '#3498db',
            'target-arrow-color': '#3498db',
            'line-style': 'solid',
            width: 2
          }
        },
        // OCCURS_AT → green dashed
        {
          selector: 'edge[rel = "OCCURS_AT"]',
          style: {
            'line-color': '#2ecc71',
            'target-arrow-color': '#2ecc71',
            'line-style': 'dashed',
            width: 2
          }
        },
        // ADVANCES_QUEST → orange dotted
        {
          selector: 'edge[rel = "ADVANCES_QUEST"]',
          style: {
            'line-color': '#e67e22',
            'target-arrow-color': '#e67e22',
            'line-style': 'dotted',
            width: 2
          }
        },

        { selector: '.faded', style: { opacity: 0.2 } },
        {
          selector: 'node:selected, edge:selected',
          style: {
            'border-width': 2,
            'border-color': '#6aa0ff',
            'line-color': '#6aa0ff',
            'target-arrow-color': '#6aa0ff'
          }
        }
      ]
    })
    cyRef.current = cy

    // Interactions
    cy.on('tap', 'node', (e) => {
      const n = e.target
      const d = n.data() as any
      cy.elements().removeClass('faded')
      const nb = n.closedNeighborhood()
      cy.elements().not(nb).addClass('faded')
      setSelected({ kind: 'node', nodeType: d.nodeType, id: d.id })
    })
    cy.on('tap', 'edge', (e) => {
      const edge = e.target
      cy.elements().removeClass('faded')
      const nb = edge.connectedNodes().union(edge)
      cy.elements().not(nb).addClass('faded')
      const d = edge.data() as any
      setSelected({ kind: 'edge', rel: d.rel, from: d.source, to: d.target })
    })
    cy.on('tap', (evt) => {
      if (evt.target === cy) {
        cy.elements().removeClass('faded')
        setSelected(null)
      }
    })

    const onResize = () => { cy.resize(); cy.fit(cy.elements(), 20) }
    window.addEventListener('resize', onResize)
    return () => { window.removeEventListener('resize', onResize); cy.destroy() }
  }, [])

  // 2) Subscribe graph stream (updates on start/end)
  useEffect(() => {
    const off = subscribeGraph((g) => setGraphData(g))
    return off
  }, [])

  // 3) Repaint on graphData updates
  useEffect(() => {
    const cy = cyRef.current
    if (!cy || !graphData) return

    const elements: cytoscape.ElementDefinition[] = []

    // Nodes
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

    // Edges
    graphData.edges.forEach(e => elements.push({
      data: { id: e.id, source: e.from, target: e.to, label: e.rel, rel: e.rel }
    }))

    // Re-render
    cy.elements().remove()
    cy.add(elements)
    cy.layout({ name: 'cose', animate: false }).run()
    cy.fit(cy.elements(), 20)

    // If previously selected node no longer exists, clear selection
    if (selected?.kind === 'node' && cy.getElementById(selected.id).length === 0) {
      setSelected(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graphData])

  return (
    <div className="container">
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 300px', gap: 12, alignItems: 'stretch' }}>
        <div
          id="graph"
          ref={ref}
          style={{
            width: '100%', height: 520,
            background: '#0f1219',
            border: '1px solid #22283a',
            borderRadius: 12,
            overflow: 'hidden'
          }}
        />
        <DetailsDrawer selected={selected} data={graphData} />
      </div>
    </div>
  )
}

/* ========================= Right drawer (Legend + Details) ========================= */

function DetailsDrawer({ selected, data }: { selected: Selected; data: GraphData | null }) {
  if (!data) return <Aside><h3>Details</h3><p className="small">Loading…</p></Aside>

  if (!selected) {
    return (
      <Aside>
        <h3>Legend</h3>
        {/* Node legend */}
        <LegendRow icon={ICONS.event}  label="EVENT"     hint="Key story beats" />
        <LegendRow icon={ICONS.char}   label="CHARACTER" hint="Players / NPCs" />
        <LegendRow icon={ICONS.loc}    label="LOCATION"  hint="Where events occur" />
        <LegendRow icon={ICONS.quest}  label="QUEST"     hint="Main/side objectives" />

        {/* Edge legend */}
        <div style={{ marginTop: 12, fontWeight: 700 }}>Relations</div>
        <EdgeLegendRow label="PARTICIPATES"  color="#3498db" styleName="solid" />
        <EdgeLegendRow label="OCCURS_AT"     color="#2ecc71" styleName="dashed" />
        <EdgeLegendRow label="ADVANCES_QUEST" color="#e67e22" styleName="dotted" />

        <div className="small" style={{marginTop:12, opacity:.85}}>
          Tip: Click a node or edge on the left to see details. Click on empty canvas to clear highlight.
        </div>
      </Aside>
    )
  }

  if (selected.kind === 'edge') {
    const name = (id: string) =>
      data.nodes.characters.find(c => c.id === id)?.name
      || data.nodes.locations.find(l => l.id === id)?.name
      || data.nodes.quests.find(q => q.id === id)?.name
      || data.nodes.events.find(e => e.id === id)?.title
      || id
    return (
      <Aside>
        <h3>Edge</h3>
        <KV k="Relation" v={selected.rel} />
        <KV k="From" v={name(selected.from)} />
        <KV k="To" v={name(selected.to)} />
      </Aside>
    )
  }

  // Node details
  const id = selected.id
  if (selected.nodeType === 'EVENT') {
    const ev = data.nodes.events.find(x => x.id === id)!
    const locName = ev.location ? (data.nodes.locations.find(l => l.id === ev.location)?.name ?? ev.location) : '—'
    const charNames = ev.characters?.map(cid => data.nodes.characters.find(c => c.id === cid)?.name ?? cid) ?? []
    const questNames = ev.questIds?.map(qid => data.nodes.quests.find(q => q.id === qid)?.name ?? qid) ?? []
    return (
      <Aside>
        <h3>Event</h3>
        <KV k="Title" v={ev.title} />
        <KV k="Time" v={fmt(ev.ts)} />
        <KV k="Location" v={locName} />
        <KV k="Characters" v={charNames.length ? charNames.join(', ') : '—'} />
        <KV k="Advances Quests" v={questNames.length ? questNames.join(', ') : '—'} />
        {ev.summary && <KV k="Summary" v={ev.summary} multiline />}
      </Aside>
    )
  }

  if (selected.nodeType === 'CHARACTER') {
    const c = data.nodes.characters.find(x => x.id === id)!
    const participated = data.nodes.events.filter(e => e.characters?.includes(c.id)).sort((a, b) => a.ts - b.ts)
    return (
      <Aside>
        <h3>Character</h3>
        <KV k="Name" v={c.name} />
        {c.tags?.length ? <KV k="Tags" v={c.tags.join(', ')} /> : null}
        <KV k="Related Events" v={participated.length ? '' : '—'} />
        <ul className="small" style={{ marginTop: 6, paddingLeft: 18 }}>
          {participated.map(e => <li key={e.id}>{fmt(e.ts)} · {e.title}</li>)}
        </ul>
      </Aside>
    )
  }

  if (selected.nodeType === 'LOCATION') {
    const l = data.nodes.locations.find(x => x.id === id)!
    const happened = data.nodes.events.filter(e => e.location === l.id).sort((a, b) => a.ts - b.ts)
    return (
      <Aside>
        <h3>Location</h3>
        <KV k="Name" v={l.name} />
        {l.parentId && <KV k="Parent" v={data.nodes.locations.find(x => x.id === l.parentId)?.name ?? l.parentId} />}
        <KV k="Events Here" v={happened.length ? '' : '—'} />
        <ul className="small" style={{ marginTop: 6, paddingLeft: 18 }}>
          {happened.map(e => <li key={e.id}>{fmt(e.ts)} · {e.title}</li>)}
        </ul>
      </Aside>
    )
  }

  const q = data.nodes.quests.find(x => x.id === id)!
  const advancedBy = data.nodes.events.filter(e => e.questIds?.includes(q.id)).sort((a, b) => a.ts - b.ts)
  return (
    <Aside>
      <h3>Quest</h3>
      <KV k="Name" v={q.name} />
      <KV k="Status" v={q.status} />
      <KV k="Advancing Events" v={advancedBy.length ? '' : '—'} />
      <ul className="small" style={{ marginTop: 6, paddingLeft: 18 }}>
        {advancedBy.map(e => <li key={e.id}>{fmt(e.ts)} · {e.title}</li>)}
      </ul>
    </Aside>
  )
}

/* ========================= Small components & utils ========================= */

function Aside({ children }: { children: React.ReactNode }) {
  return (
    <aside
      className="card"
      style={{ height: 520, overflow: 'auto', position: 'sticky', top: 16 }}
    >
      {children}
    </aside>
  )
}

function KV({ k, v, multiline }: { k: string; v: string; multiline?: boolean }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '86px 1fr', gap: 8, alignItems: 'start', margin: '6px 0' }}>
      <div className="small" style={{ opacity: 0.85 }}>{k}</div>
      {multiline ? <div style={{ whiteSpace: 'pre-wrap' }}>{v}</div> : <div>{v}</div>}
    </div>
  )
}

function LegendRow({ icon, label, hint }: { icon: string; label: string; hint?: string }) {
  return (
    <div style={{ display:'grid', gridTemplateColumns:'28px 1fr', gap:8, alignItems:'center', marginBottom:8 }}>
      <img src={icon} width={22} height={22} alt="" />
      <div>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{label}</div>
        {hint && <div className="small" style={{ opacity:.8 }}>{hint}</div>}
      </div>
    </div>
  )
}

// Edge legend row: draw a tiny SVG that matches in-graph styling
function EdgeLegendRow({ label, color, styleName }: { label: string; color: string; styleName: 'solid'|'dashed'|'dotted' }) {
  const dash = styleName === 'solid' ? '' : (styleName === 'dashed' ? '6,4' : '2,4')
  return (
    <div style={{ display:'grid', gridTemplateColumns:'28px 1fr', gap:8, alignItems:'center', marginBottom:8 }}>
      <svg width="22" height="14" aria-hidden>
        <line x1="2" y1="7" x2="20" y2="7" stroke={color} strokeWidth="2" strokeDasharray={dash} />
        <polygon points="20,7 16,5 16,9" fill={color} />
      </svg>
      <div style={{ fontSize: 13 }}>
        {label}
      </div>
    </div>
  )
}

function fmt(ts: number) {
  try { return new Date(ts).toLocaleString() } catch { return String(ts) }
}
