import { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useRealtimeData } from "../hooks/useRealtimeData";
import {
  firebaseObjectToArray,
  getImagePath,
} from "../utils/dataTransformUtils";
import { ROUTES } from "../constants/routes";
import { Header } from "../components/Header";
import { IoPlay, IoCheckmarkCircle, IoTime, IoSettings } from "react-icons/io5";

export const Home = () => {
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const { data: auctionsData } = useRealtimeData("auctions");

  const auctionsList = useMemo(
    () =>
      firebaseObjectToArray(auctionsData).sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
      ),
    [auctionsData],
  );

  // Separate live, completed, and upcoming auctions
  const liveAuctions = auctionsList.filter(
    (a) => a.live_state && !a.live_state.isComplete,
  );
  const completedAuctions = auctionsList.filter(
    (a) => a.live_state?.isComplete,
  );
  const upcomingAuctions = auctionsList.filter((a) => !a.live_state);

  const handleAdminClick = () => {
    if (isAdmin) {
      navigate(ROUTES.ADMIN_SETUP);
    } else {
      navigate(ROUTES.LOGIN);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary to-darkBg">
      {/* Header */}
      <Header showBranding={true} />

      <div className="max-w-6xl mx-auto px-4 py-6 sm:py-10 page-enter">
        {/* Live Auctions Section - PRIMARY FOCUS */}
        {liveAuctions.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              <h2 className="text-2xl sm:text-3xl font-bold text-white">
                Live Auctions
              </h2>
            </div>
            <div className="grid gap-4">
              {liveAuctions.map((auction) => (
                <div
                  key={auction.id}
                  onClick={() => navigate(ROUTES.AUCTION_DASHBOARD(auction.id))}
                  className="bg-gradient-to-r from-green-600/20 to-green-900/20 backdrop-blur-sm border-2 border-green-500/50 rounded-xl p-4 sm:p-6 cursor-pointer hover:border-green-400 hover:scale-[1.02] transition-all duration-200"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex items-center gap-4">
                      {auction.logo && (
                        <img
                          src={getImagePath("auction-logo", auction.logo)}
                          alt={auction.name}
                          className="w-16 h-16 object-contain rounded-lg bg-white/10 p-2"
                          onError={(e) => (e.target.style.display = "none")}
                        />
                      )}
                      <div>
                        <h3 className="text-xl sm:text-2xl font-bold text-white">
                          {auction.name}
                        </h3>
                        <p className="text-green-300 text-sm">
                          {auction.date
                            ? new Date(auction.date).toLocaleDateString()
                            : ""}
                          {auction.purse_size && (
                            <span className="ml-2">
                              Purse: ₹{auction.purse_size.toLocaleString()}
                            </span>
                          )}
                        </p>
                        {auction.live_state?.currentPlayerId && (
                          <p className="text-white/70 text-xs mt-1">
                            Current Bid: ₹
                            {(
                              auction.live_state.currentBid || 0
                            ).toLocaleString()}
                          </p>
                        )}
                      </div>
                    </div>
                    <button className="flex items-center gap-2 bg-green-500 hover:bg-green-400 text-white font-bold py-3 px-6 rounded-lg transition self-start sm:self-auto">
                      <IoPlay size={20} />
                      Watch Live
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Hero Section - Compact when there are live auctions */}
        <div
          className={`text-center ${liveAuctions.length > 0 ? "py-6" : "py-10 sm:py-16"}`}
        >
          <h2
            className={`font-bold text-white mb-3 ${liveAuctions.length > 0 ? "text-2xl sm:text-3xl" : "text-3xl sm:text-5xl"}`}
          >
            {liveAuctions.length > 0
              ? "Join the Action"
              : "Cricket Auction Hub"}
          </h2>
          <p className="text-base sm:text-lg text-gray-300 mb-6 max-w-2xl mx-auto">
            {liveAuctions.length > 0
              ? "Watch live auctions, track team budgets, and follow your favorite players."
              : "Real-time bidding, team management, and comprehensive analytics for cricket auctions."}
          </p>

          {/* Admin Panel Button - Small and Secondary */}
          {isAdmin && (
            <button
              onClick={handleAdminClick}
              className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white font-semibold py-2 px-4 rounded-lg transition text-sm border border-white/20"
            >
              <IoSettings size={16} />
              Admin Panel
            </button>
          )}
        </div>

        {/* Upcoming/Available Auctions */}
        {upcomingAuctions.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <IoTime size={24} className="text-secondary" />
              <h2 className="text-xl sm:text-2xl font-bold text-white">
                Upcoming Auctions
              </h2>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              {upcomingAuctions.map((auction) => (
                <div
                  key={auction.id}
                  onClick={() => navigate(ROUTES.AUCTION_DASHBOARD(auction.id))}
                  className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-4 cursor-pointer hover:bg-white/15 hover:border-secondary/50 transition-all duration-200"
                >
                  <div className="flex items-center gap-3">
                    {auction.logo && (
                      <img
                        src={getImagePath("auction-logo", auction.logo)}
                        alt={auction.name}
                        className="w-12 h-12 object-contain rounded-lg bg-white/10 p-1"
                        onError={(e) => (e.target.style.display = "none")}
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <h4 className="text-lg font-bold text-white truncate">
                        {auction.name}
                      </h4>
                      <p className="text-gray-400 text-sm">
                        {auction.date
                          ? new Date(auction.date).toLocaleDateString()
                          : "Date TBD"}
                        {auction.purse_size && (
                          <span className="ml-2">
                            | ₹{auction.purse_size.toLocaleString()}
                          </span>
                        )}
                      </p>
                    </div>
                    <span className="text-secondary font-bold text-lg">→</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Completed Auctions */}
        {completedAuctions.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <IoCheckmarkCircle size={24} className="text-gray-400" />
              <h2 className="text-xl sm:text-2xl font-bold text-gray-400">
                Completed Auctions
              </h2>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {completedAuctions.map((auction) => (
                <div
                  key={auction.id}
                  onClick={() => navigate(ROUTES.AUCTION_DASHBOARD(auction.id))}
                  className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg p-3 cursor-pointer hover:bg-white/10 transition-all duration-200"
                >
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <h4 className="text-base font-semibold text-gray-300 truncate">
                        {auction.name}
                      </h4>
                      <p className="text-gray-500 text-xs">
                        {auction.date
                          ? new Date(auction.date).toLocaleDateString()
                          : ""}
                      </p>
                    </div>
                    <span className="bg-gray-600 text-white text-xs px-2 py-1 rounded font-semibold flex-shrink-0">
                      Results
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* No Auctions State */}
        {auctionsList.length === 0 && (
          <div className="text-center py-12">
            <div className="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <IoTime size={40} className="text-gray-400" />
            </div>
            <p className="text-gray-400 text-lg mb-4">
              No auctions available yet
            </p>
            {isAdmin && (
              <button
                onClick={handleAdminClick}
                className="bg-secondary hover:bg-yellow-400 text-primary font-bold py-3 px-6 rounded-lg transition"
              >
                Create Your First Auction
              </button>
            )}
          </div>
        )}
      </div>

      {/* Features - Only show if no live auctions */}
      {liveAuctions.length === 0 && (
        <div className="bg-white/5 py-10">
          <div className="max-w-6xl mx-auto px-4">
            <h3 className="text-xl sm:text-2xl font-bold text-white text-center mb-8">
              Features
            </h3>
            <div className="grid sm:grid-cols-3 gap-4 sm:gap-6">
              <div className="bg-white/5 p-4 sm:p-5 rounded-lg border border-white/10">
                <h4 className="text-lg font-bold text-secondary mb-2">
                  Live Bidding
                </h4>
                <p className="text-gray-300 text-sm">
                  Real-time auction with increment-based bidding
                </p>
              </div>
              <div className="bg-white/5 p-4 sm:p-5 rounded-lg border border-white/10">
                <h4 className="text-lg font-bold text-secondary mb-2">
                  Team Management
                </h4>
                <p className="text-gray-300 text-sm">
                  Manage teams, budgets, and squad formation
                </p>
              </div>
              <div className="bg-white/5 p-4 sm:p-5 rounded-lg border border-white/10">
                <h4 className="text-lg font-bold text-secondary mb-2">
                  Player Groups
                </h4>
                <p className="text-gray-300 text-sm">
                  Organize players by custom pricing groups
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-darkBg/50 text-gray-400 py-4 text-center text-sm">
        <p>&copy; 2026 Cricket Auction App</p>
      </footer>
    </div>
  );
};

export default Home;
