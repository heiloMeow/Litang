import React, { useEffect, useState } from 'react'
import { Header } from './components/Header'
import Timeline from './components/Timeline'
import type { Tab } from './types'   // ← 引入 Tab

export default function App() {
  const [tab, setTab] = useState<Tab>('Timeline')  // ← 用统一类型

  useEffect(()=>{
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(()=>{})
    }
  },[])

  return (
    <>
      <Header tab={tab} setTab={setTab} />  {/* 类型现在完全匹配 */}
      {tab==='Timeline' && <Timeline/>}
    </>
  )
}
