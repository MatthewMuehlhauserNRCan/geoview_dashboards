import { DashboardApp } from './app/DashboardApp'
import { sampleDashboardConfig } from './app/sampleConfig'
import './App.css'

function App() {
  return <DashboardApp config={sampleDashboardConfig} />
}

export default App

