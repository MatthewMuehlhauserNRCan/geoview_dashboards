import { useEffect } from 'react'
import { DashboardApp } from './app/DashboardApp'
import { sampleDashboardConfig } from './app/sampleConfig'
import './App.css'

function App() {
  // Standalone viewer only - the embed bundle never touches its host page's <title>.
  useEffect(() => {
    document.title = sampleDashboardConfig.title
  }, [])
  return <DashboardApp config={sampleDashboardConfig} />
}

export default App

