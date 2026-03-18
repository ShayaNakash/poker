import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AdminProvider } from './lib/adminAuth'
import { ToastProvider } from './lib/toast'
import GamesList from './screens/GamesList'
import CreateGame from './screens/CreateGame'
import AdminDashboard from './screens/AdminDashboard'
import EndGame from './screens/EndGame'
import Settlements from './screens/Settlements'
import ViewerPage from './screens/ViewerPage'
import History from './screens/History'
import './index.css'

export default function App() {
  return (
    <AdminProvider>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<GamesList />} />
            <Route path="/create-game" element={<CreateGame />} />
            <Route path="/game/:gameId" element={<AdminDashboard />} />
            <Route path="/game/:gameId/end" element={<EndGame />} />
            <Route path="/game/:gameId/settlements" element={<Settlements />} />
            <Route path="/view/:token" element={<ViewerPage />} />
            <Route path="/history" element={<History />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </AdminProvider>
  )
}
