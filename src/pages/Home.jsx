import { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useRealtimeData } from "../hooks/useRealtimeData";
import { firebaseObjectToArray } from "../utils/dataTransformUtils";
import { ROUTES } from "../constants/routes";
import { Header } from "../components/Header";

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

      {/* Hero */}
      <div className="max-w-6xl mx-auto px-4 py-10 sm:py-20 text-center page-enter">
        <h2 className="text-3xl sm:text-5xl font-bold text-white mb-4 sm:mb-6">
          Cricket Auction Management
        </h2>
        <p className="text-base sm:text-xl text-gray-200 mb-8 sm:mb-12 max-w-2xl mx-auto">
          Manage live cricket auctions with ease. Real-time bidding, team
          management, and comprehensive analytics.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
          <button
            onClick={handleAdminClick}
            className="bg-secondary hover:bg-yellow-400 text-primary font-bold py-3 px-8 rounded-lg transition transform hover:scale-105"
          >
            {isAdmin ? "Go to Admin Panel" : "Login as Admin"}
          </button>
        </div>

        {/* Live Auctions List */}
        {auctionsList.length > 0 ? (
          <div className="max-w-3xl mx-auto">
            <h3 className="text-2xl font-bold text-white mb-6">
              Available Auctions
            </h3>
            <div className="grid gap-4">
              {auctionsList.map((auction) => (
                <div
                  key={auction.id}
                  onClick={() => navigate(ROUTES.AUCTION_DASHBOARD(auction.id))}
                  className="bg-white bg-opacity-10 backdrop-blur-sm border border-white border-opacity-20 rounded-lg p-6 cursor-pointer hover:bg-opacity-20 hover:-translate-y-1 transition-all duration-200 text-left"
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <h4 className="text-xl font-bold text-white">
                        {auction.name}
                      </h4>
                      <p className="text-gray-300 text-sm">
                        {auction.date
                          ? new Date(auction.date).toLocaleDateString()
                          : "No date set"}
                        {" | "}Purse: ₹
                        {(auction.purse_size || 0).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {auction.live_state && !auction.live_state.isComplete && (
                        <span className="bg-green-500 text-white text-xs px-3 py-1 rounded-full font-bold animate-pulse">
                          LIVE
                        </span>
                      )}
                      {auction.live_state?.isComplete && (
                        <span className="bg-secondary text-primary text-xs px-3 py-1 rounded-full font-bold">
                          COMPLETED
                        </span>
                      )}
                      <span className="text-secondary font-bold text-lg">
                        →
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-gray-300">No auctions available yet.</p>
        )}
      </div>

      {/* Features */}
      <div className="bg-white bg-opacity-10 py-12">
        <div className="max-w-6xl mx-auto px-4">
          <h3 className="text-2xl sm:text-3xl font-bold text-white text-center mb-8 sm:mb-12">
            Key Features
          </h3>

          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6 sm:gap-8">
            {/* Feature 1 */}
            <div className="bg-white bg-opacity-5 p-6 rounded-lg backdrop-blur-sm border border-white border-opacity-10 hover:-translate-y-1 transition-all duration-200">
              <h4 className="text-xl sm:text-2xl font-bold text-secondary mb-3">
                Live Bidding
              </h4>
              <p className="text-gray-200">
                Real-time auction with increment-based bidding system controlled
                by admins
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-white bg-opacity-5 p-6 rounded-lg backdrop-blur-sm border border-white border-opacity-10 hover:-translate-y-1 transition-all duration-200">
              <h4 className="text-xl sm:text-2xl font-bold text-secondary mb-3">
                Team Management
              </h4>
              <p className="text-gray-200">
                Manage teams, budgets, and squad formation in real-time
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-white bg-opacity-5 p-6 rounded-lg backdrop-blur-sm border border-white border-opacity-10 hover:-translate-y-1 transition-all duration-200">
              <h4 className="text-xl sm:text-2xl font-bold text-secondary mb-3">
                Player Grouping
              </h4>
              <p className="text-gray-200">
                Organize players by custom groups with specific bid increments
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-darkBg text-white py-6 text-center">
        <p>&copy; 2026 Cricket Auction App. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default Home;
