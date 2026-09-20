import { Routes, Route } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Dashboard } from './pages/Dashboard'
import { Opportunities } from './pages/Opportunities'
import { Candidates } from './pages/Candidates'
import { Settings } from './pages/Settings'

export function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/opportunities" element={<Opportunities />} />
        <Route path="/candidates" element={<Candidates />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </Layout>
  )
}