// src/graphStyles.ts
import { StylesheetCSS } from 'cytoscape'

/**
 * Local icon assets for different node categories.
 * These files must exist under `public/icons/`.
 */
export const ICONS = {
  char: '/icons/character.svg',
  loc: '/icons/location.svg',
  quest: '/icons/quest.svg',
  event: '/icons/event.svg',
}
export const NODE_ICONS = {
  EVENT: ICONS.event,
  CHARACTER: ICONS.char,
  LOCATION: ICONS.loc,
  QUEST: ICONS.quest,
}

/**
 * Cytoscape stylesheet definition for GraphView.
 *
 * This array configures:
 * - Base node appearance
 * - Node appearance per category (character, location, quest, event)
 * - Base edge appearance
 * - Edge appearance per relation type (PARTICIPATES / OCCURS_AT / ADVANCES_QUEST)
 * - Visual states (faded / selected)
 *
 * @remarks
 * - Cytoscape requires the `css` property instead of `style`.
 * - Many values (like `width`, `height`) can be numbers.
 * - Percentages / positions should be strings.
 */
export const graphStyles: StylesheetCSS[] = [
  /**
   * Default node style.
   * Provides size, background color, border, text positioning.
   */
  {
    selector: 'node',
    css: {
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

  /** Character nodes: rounded rectangle with character icon. */
  { selector: '.char',
    css: {
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

  /** Location nodes: rectangle with location icon. */
  { selector: '.loc',
    css: {
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

  /** Quest nodes: diamond with quest icon. */
  { selector: '.quest',
    css: {
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

  /** Event nodes: ellipse with event icon. */
  { selector: '.event',
    css: {
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

  // ====== Base edge style ======
  {
    selector: 'edge',
    css: {
      width: 1,
      'line-color': '#2d3a59',
      'target-arrow-color': '#2d3a59',
      'target-arrow-shape': 'triangle',
      'curve-style': 'bezier',
      label: 'data(label)',
      'font-size': '8px',
      color: '#9aa3b2',
      'text-background-color': '#0f1219',
      'text-background-opacity': 0.8,
      'text-background-padding': '2',
      'text-background-shape': 'roundrectangle',
    }
  },

  /** Edge: Event → Character (PARTICIPATES) → solid blue. */
  { selector: 'edge[rel = "PARTICIPATES"]',
    css: {
      'line-color': '#3498db',
      'target-arrow-color': '#3498db',
      'line-style': 'solid',
      width: 2
    }
  },

  /** Edge: Event → Location (OCCURS_AT) → dashed green. */
  { selector: 'edge[rel = "OCCURS_AT"]',
    css: {
      'line-color': '#2ecc71',
      'target-arrow-color': '#2ecc71',
      'line-style': 'dashed',
      width: 2
    }
  },

  /** Edge: Event → Quest (ADVANCES_QUEST) → dotted orange. */
  { selector: 'edge[rel = "ADVANCES_QUEST"]',
    css: {
      'line-color': '#e67e22',
      'target-arrow-color': '#e67e22',
      'line-style': 'dotted',
      width: 2
    }
  },

  /** Faded style: applied to de-emphasize non-neighborhood elements. */
  { selector: '.faded', css: { opacity: 0.2 } },

  /** Highlight style: applied to selected nodes/edges. */
  {
    selector: 'node:selected, edge:selected',
    css: {
      'border-width': 2,
      'border-color': '#6aa0ff',
      'line-color': '#6aa0ff',
      'target-arrow-color': '#6aa0ff'
    }
  }
]
