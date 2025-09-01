export type NodeType = "CHARACTER"|"LOCATION"|"QUEST"|"NPC"|"LORE"|"ITEM"|"EVENT";
export const TABS = ['Timeline'] as const;
export type Tab = typeof TABS[number];

export interface Character { id:string; name:string; tags?:string[] }
export interface Location  { id:string; name:string; parentId?:string }
export interface Quest     { id:string; name:string; status:"OPEN"|"ONGOING"|"DONE" }

export interface EventNode {
  id:string;
  type:"EVENT";
  title:string;
  ts:number;                 // epoch ms
  characters:string[];
  location?:string;
  questIds?:string[];
  summary?:string;
}

export interface Edge {
  id:string;
  from:string; to:string;
  rel:"OCCURS_AT"|"PARTICIPATES"|"ADVANCES_QUEST"|"INTERACTS"|"REFERS";
}

export interface Session {
  id: string;
  title?: string;
  startedAt: number;   // epoch ms
  endedAt?: number;
}

