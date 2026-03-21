import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AdminProvider } from './lib/adminAuth'
import { ToastProvider } from './lib/toast'
import { AuthProvider, useAuth } from './lib/authContext'
import AuthScreen from './screens/AuthScreen'
import ResetPassword from './screens/ResetPassword'
import LandingPage from './screens/LandingPage'
import FeedbackScreen from './screens/FeedbackScreen'
import GamesList from './screens/GamesList'
import CreateGame from './screens/CreateGame'
import AdminDashboard from './screens/AdminDashboard'
import EndGame from './screens/EndGame'
import Settlements from './screens/Settlements'
import ViewerPage from './screens/ViewerPage'
import History from './screens/History'
import './index.css'

// Protected route — redirects to landing if not authenticated
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="loading-screen"><div className="spinner" /></div>
  if (!user) return <Navigate to="/welcome" replace />
  return children
}

// Public route — redirects to home if already authenticated
function PublicRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="loading-screen"><div className="spinner" /></div>
  if (user) return <Navigate to="/" replace />
  return children
}

// Guest route — shows landing page for non-authenticated users
function GuestRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="loading-screen"><div className="spinner" /></div>
  if (!user) return <Navigate to="/welcome" replace />
  return children
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public — viewer link (no auth needed) */}
      <Route path="/view/:token" element={<ViewerPage />} />

      {/* Landing page — public */}
      <Route path="/welcome" element={<LandingPage />} />

      {/* Auth */}
      <Route path="/auth" element={
        <PublicRoute><AuthScreen /></PublicRoute>
      } />
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* Protected routes */}
      <Route path="/" element={
        <ProtectedRoute><GamesList /></ProtectedRoute>
      } />
      <Route path="/create-game" element={
        <ProtectedRoute><CreateGame /></ProtectedRoute>
      } />
      <Route path="/game/:gameId/end" element={
        <ProtectedRoute><EndGame /></ProtectedRoute>
      } />
      <Route path="/game/:gameId/settlements" element={
        <ProtectedRoute><Settlements /></ProtectedRoute>
      } />
      <Route path="/game/:gameId" element={
        <ProtectedRoute><AdminDashboard /></ProtectedRoute>
      } />
      <Route path="/history" element={
        <ProtectedRoute><History /></ProtectedRoute>
      } />
      <Route path="/feedback" element={
        <ProtectedRoute><FeedbackScreen /></ProtectedRoute>
      } />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AdminProvider>
        <ToastProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </ToastProvider>
      </AdminProvider>
    </AuthProvider>
  )
}
