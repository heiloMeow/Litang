import Dexie, { Table } from 'dexie'
import type { EventNode, Edge } from './types'

export class DSDB extends Dexie {
  events!: Table<EventNode, string>
  edges!: Table<Edge, string>
  constructor() {
    super('DungeonScribeDB')
    this.version(1).stores({
      events: 'id, ts, *characters, location',
      edges: 'id, from, to, rel'
    })
  }
}
export const db = new DSDB()
