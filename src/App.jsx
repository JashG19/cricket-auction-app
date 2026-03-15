import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Home } from "./pages/Home";
import { LoginPage } from "./pages/LoginPage";
import { NotFound } from "./pages/NotFound";
import { AdminSetup } from "./pages/admin/AdminSetup";
import { AdminPlayers } from "./pages/admin/AdminPlayers";
import { AdminLive } from "./pages/admin/AdminLive";
import { AdminResults } from "./pages/admin/AdminResults";
import { AuctionDashboard } from "./pages/viewer/AuctionDashboard";
import { TeamDetails } from "./pages/viewer/TeamDetails";
import { PlayerPool } from "./pages/viewer/PlayerPool";
import { AuthGate } from "./components/AuthGate";
import "./App.css";

function App() {
  return (
    <Router>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<LoginPage />} />

        {/* Admin Routes */}
        <Route
          path="/admin/setup"
          element={
            <AuthGate requireAdmin>
              <AdminSetup />
            </AuthGate>
          }
        />
        <Route
          path="/admin/players/:auctionId"
          element={
            <AuthGate requireAdmin>
              <AdminPlayers />
            </AuthGate>
          }
        />
        <Route
          path="/admin/live/:auctionId"
          element={
            <AuthGate requireAdmin>
              <AdminLive />
            </AuthGate>
          }
        />
        <Route
          path="/admin/results/:auctionId"
          element={
            <AuthGate requireAdmin>
              <AdminResults />
            </AuthGate>
          }
        />

        {/* Viewer Routes */}
        <Route path="/auction/:auctionId" element={<AuctionDashboard />} />
        <Route path="/auction/:auctionId/teams" element={<TeamDetails />} />
        <Route path="/auction/:auctionId/players" element={<PlayerPool />} />

        {/* 404 Not Found */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Router>
  );
}

export default App;
