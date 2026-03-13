import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { Home } from './pages/Home'
import { LoginPage } from './pages/LoginPage'
import { NotFound } from './pages/NotFound'
import { AuthGate } from './components/AuthGate'
import './App.css'

function App() {
  return (
    <Router>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<LoginPage />} />

        {/* Admin Routes (placeholder for now) */}
        <Route
          path="/admin/setup"
          element={
            <AuthGate requireAdmin>
              <div className="min-h-screen flex items-center justify-center">
                <h1 className="text-4xl font-bold">Admin Setup - Coming Soon</h1>
              </div>
            </AuthGate>
          }
        />
        <Route
          path="/admin/players"
          element={
            <AuthGate requireAdmin>
              <div className="min-h-screen flex items-center justify-center">
                <h1 className="text-4xl font-bold">Player Management - Coming Soon</h1>
              </div>
            </AuthGate>
          }
        />
        <Route
          path="/admin/live"
          element={
            <AuthGate requireAdmin>
              <div className="min-h-screen flex items-center justify-center">
                <h1 className="text-4xl font-bold">Live Auction - Coming Soon</h1>
              </div>
            </AuthGate>
          }
        />
        <Route
          path="/admin/results"
          element={
            <AuthGate requireAdmin>
              <div className="min-h-screen flex items-center justify-center">
                <h1 className="text-4xl font-bold">Results & Export - Coming Soon</h1>
              </div>
            </AuthGate>
          }
        />

        {/* Viewer Routes (placeholder for now) */}
        <Route
          path="/auction/:auctionId"
          element={
            <div className="min-h-screen flex items-center justify-center">
              <h1 className="text-4xl font-bold">Auction Dashboard - Coming Soon</h1>
            </div>
          }
        />
        <Route
          path="/auction/:auctionId/teams"
          element={
            <div className="min-h-screen flex items-center justify-center">
              <h1 className="text-4xl font-bold">Team Details - Coming Soon</h1>
            </div>
          }
        />
        <Route
          path="/auction/:auctionId/players"
          element={
            <div className="min-h-screen flex items-center justify-center">
              <h1 className="text-4xl font-bold">Player Pool - Coming Soon</h1>
            </div>
          }
        />

        {/* 404 Not Found */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Router>
  )
}

export default App
