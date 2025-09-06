import React, { useState } from 'react'
import { Header } from './components/Header'
import Timeline from './components/Timeline'
import Recall from './components/Recall'
import GraphView from './components/GraphView'
import type { Tab } from './types'

export default function App() {
  const [tab, setTab] = useState<Tab>('Timeline')

  return (
    <>
      <Header tab={tab} setTab={setTab} />
      {tab==='Timeline' && <Timeline/>}
      {tab==='Recall'   && <Recall/>}
      {tab==='Graph'    && <GraphView/>}
    </>
  )
}
