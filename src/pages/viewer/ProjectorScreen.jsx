import { useState, useEffect, useMemo } from "react";
import { useParams } from "react-router-dom";
import { useRealtimeData } from "../../hooks/useRealtimeData";
import {
  firebaseObjectToArray,
  createLookupMap,
} from "../../utils/dataTransformUtils";
import { AnimatedNumber } from "../../components/AnimatedNumber";
import confetti from "canvas-confetti";

export const ProjectorScreen = () => {
  const { auctionId } = useParams();
  const [soldPopup, setSoldPopup] = useState(null);

  // Real-time data
  const { data: playersData } = useRealtimeData(`auctions/${auctionId}/players`);
  const { data: teamsData } = useRealtimeData(`auctions/${auctionId}/teams`);
  const { data: groupsData } = useRealtimeData(`auctions/${auctionId}/groups`);
  const { data: liveState } = useRealtimeData(`auctions/${auctionId}/live_state`);
  const { data: auctionData } = useRealtimeData(`auctions/${auctionId}`);

  const playersList = useMemo(() => firebaseObjectToArray(playersData), [playersData]);
  const teamsList = useMemo(() => firebaseObjectToArray(teamsData), [teamsData]);
  const groupsList = useMemo(() => firebaseObjectToArray(groupsData), [groupsData]);
  const groupsById = useMemo(() => createLookupMap(groupsList), [groupsList]);
  const teamsById = useMemo(() => createLookupMap(teamsList), [teamsList]);

  // Resolve current player
  const currentPlayer = useMemo(() => {
    if (liveState?.currentPlayerId) {
      return playersList.find((p) => String(p.id) === String(liveState.currentPlayerId)) || null;
    }
    return null;
  }, [liveState?.currentPlayerId, playersList]);

  const currentGroup = currentPlayer
    ? groupsById.get(String(currentPlayer.group_id))
    : null;

  const liveBid = liveState?.currentBid ?? 0;
  const isPaused = liveState?.isPaused ?? false;
  const isComplete = liveState?.isComplete ?? false;

  // Detect when a player gets sold → show popup + confetti
  useEffect(() => {
    if (!currentPlayer?.soldTo) return;

    const team = teamsById.get(String(currentPlayer.soldTo));
    if (!team) return;

    // Only show popup if not already showing for this player
    if (soldPopup?.playerId === currentPlayer.id) return;

    setSoldPopup({
      playerId: currentPlayer.id,
      playerName: currentPlayer.player_name,
      photoUrl: currentPlayer.photo_url,
      soldPrice: currentPlayer.soldPrice || 0,
      teamName: team.team_name,
    });

    confetti({
      particleCount: 150,
      spread: 100,
      origin: { y: 0.5 },
      colors: ["#ffc107", "#1a3a52", "#10b981", "#ffffff"],
    });

    // Auto-dismiss after 6 seconds
    const timer = setTimeout(() => setSoldPopup(null), 6000);
    return () => clearTimeout(timer);
  }, [currentPlayer?.soldTo, currentPlayer?.id]);

  // Detect unsold → show brief popup
  useEffect(() => {
    if (!currentPlayer?.unsold || currentPlayer?.soldTo) return;
    if (soldPopup?.playerId === currentPlayer.id) return;

    setSoldPopup({
      playerId: currentPlayer.id,
      playerName: currentPlayer.player_name,
      photoUrl: currentPlayer.photo_url,
      unsold: true,
    });

    const timer = setTimeout(() => setSoldPopup(null), 4000);
    return () => clearTimeout(timer);
  }, [currentPlayer?.unsold, currentPlayer?.id]);

  // Full-screen dark background
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a1628] to-[#0F1419] flex flex-col items-center justify-center relative overflow-hidden">

      {/* Auction Name - Top Bar */}
      <div className="absolute top-0 left-0 right-0 bg-black/40 backdrop-blur-sm px-6 py-3 flex items-center justify-between z-10">
        <h1 className="text-lg sm:text-xl font-bold text-secondary truncate">
          {auctionData?.name || "Cricket Auction"}
        </h1>
        {isPaused && !isComplete && (
          <span className="bg-yellow-400 text-yellow-900 px-4 py-1 rounded-full text-sm font-bold animate-pulse">
            PAUSED
          </span>
        )}
        {isComplete && (
          <span className="bg-green-500 text-white px-4 py-1 rounded-full text-sm font-bold">
            AUCTION COMPLETE
          </span>
        )}
      </div>

      {/* Main Content */}
      {currentPlayer && currentGroup ? (
        <div className="flex flex-col lg:flex-row items-center justify-center gap-8 lg:gap-16 w-full max-w-7xl px-6 py-16">

          {/* Player Photo - LARGE */}
          <div className="relative flex-shrink-0">
            <div className="w-[320px] h-[420px] sm:w-[400px] sm:h-[520px] lg:w-[480px] lg:h-[620px] rounded-2xl overflow-hidden shadow-2xl border-4 border-white/10">
              {currentPlayer.photo_url ? (
                <img
                  src={currentPlayer.photo_url}
                  alt={currentPlayer.player_name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                  <span className="text-[10rem] font-bold text-white/20">
                    {currentPlayer.player_name?.charAt(0)}
                  </span>
                </div>
              )}

              {/* Name Overlay at Bottom */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-6 sm:p-8">
                <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-2 leading-tight">
                  {currentPlayer.player_name}
                </h2>
                <div className="flex items-center gap-4">
                  <span className="text-white/70 text-lg sm:text-xl">Age: {currentPlayer.age}</span>
                  <span className="bg-secondary text-primary px-3 py-1 rounded-lg text-sm sm:text-base font-bold">
                    {currentGroup.group_name}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Bid Panel */}
          <div className="flex flex-col items-center text-center lg:text-left space-y-6 lg:space-y-8">
            {/* Base Price + Increment Info */}
            <div className="flex gap-6 sm:gap-10">
              <div>
                <p className="text-white/50 text-sm sm:text-base uppercase tracking-wider mb-1">Base Price</p>
                <p className="text-2xl sm:text-3xl font-bold text-white">
                  ₹{(currentGroup.base_price || 0).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-white/50 text-sm sm:text-base uppercase tracking-wider mb-1">Increment</p>
                <p className="text-2xl sm:text-3xl font-bold text-white">
                  ₹{(currentGroup.increment_value || 0).toLocaleString()}
                </p>
              </div>
              {currentGroup.max_bid_cap && (
                <div>
                  <p className="text-white/50 text-sm sm:text-base uppercase tracking-wider mb-1">Max Cap</p>
                  <p className="text-2xl sm:text-3xl font-bold text-red-400">
                    ₹{currentGroup.max_bid_cap.toLocaleString()}
                  </p>
                </div>
              )}
            </div>

            {/* Current Bid - HUGE */}
            <div>
              <p className="text-white/60 text-lg sm:text-xl uppercase tracking-widest mb-2">
                {currentPlayer.soldTo ? "Sold For" : "Current Bid"}
              </p>
              <div className="animate-pulse-bid">
                <AnimatedNumber
                  value={currentPlayer.soldTo ? (currentPlayer.soldPrice || 0) : liveBid}
                  duration={400}
                  className="text-6xl sm:text-8xl lg:text-9xl font-bold text-secondary drop-shadow-lg"
                />
              </div>
            </div>

            {/* Sold Status inline */}
            {currentPlayer.soldTo && (
              <div className="animate-fade-in-up">
                <p className="text-white/50 text-base uppercase tracking-wider mb-1">Sold To</p>
                <p className="text-3xl sm:text-4xl font-bold text-green-400">
                  {teamsById.get(String(currentPlayer.soldTo))?.team_name || "Unknown"}
                </p>
              </div>
            )}

            {currentPlayer.unsold && !currentPlayer.soldTo && (
              <div className="animate-fade-in-up">
                <p className="text-4xl sm:text-5xl font-bold text-red-400">UNSOLD</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* No player / Waiting / Complete */
        <div className="text-center page-enter">
          {isComplete ? (
            <>
              <p className="text-6xl sm:text-8xl font-bold text-secondary mb-6">Auction Complete</p>
              <p className="text-2xl text-white/60">Thank you for participating!</p>
            </>
          ) : (
            <>
              <div className="w-16 h-16 border-4 border-secondary border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
              <p className="text-3xl sm:text-4xl font-bold text-white/60">Waiting for auction to start...</p>
            </>
          )}
        </div>
      )}

      {/* SOLD / UNSOLD Popup Overlay */}
      {soldPopup && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 fade-in"
          onClick={() => setSoldPopup(null)}
        >
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden animate-fade-in-up">
            {soldPopup.unsold ? (
              /* Unsold Popup */
              <div className="p-8 sm:p-12 text-center">
                {soldPopup.photoUrl ? (
                  <img
                    src={soldPopup.photoUrl}
                    alt={soldPopup.playerName}
                    className="w-32 h-32 sm:w-40 sm:h-40 rounded-full object-cover mx-auto mb-6 border-4 border-red-400"
                  />
                ) : (
                  <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-full bg-gradient-to-br from-red-400 to-red-600 flex items-center justify-center mx-auto mb-6">
                    <span className="text-5xl font-bold text-white/40">{soldPopup.playerName?.charAt(0)}</span>
                  </div>
                )}
                <p className="text-red-500 text-sm font-bold uppercase tracking-widest mb-2">Unsold</p>
                <h3 className="text-2xl sm:text-3xl font-bold text-text mb-2">
                  {soldPopup.playerName}
                </h3>
              </div>
            ) : (
              /* Sold Popup */
              <>
                {/* Player Photo */}
                <div className="w-full h-48 sm:h-64 relative">
                  {soldPopup.photoUrl ? (
                    <img
                      src={soldPopup.photoUrl}
                      alt={soldPopup.playerName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                      <span className="text-7xl font-bold text-white/20">{soldPopup.playerName?.charAt(0)}</span>
                    </div>
                  )}
                  <div className="absolute top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-full font-bold text-sm uppercase tracking-wider shadow-lg">
                    Sold!
                  </div>
                </div>

                {/* Sold Details */}
                <div className="p-6 sm:p-8 text-center">
                  <h3 className="text-2xl sm:text-3xl font-bold text-primary mb-4">
                    {soldPopup.playerName}
                  </h3>

                  <div className="bg-gradient-to-r from-primary to-accent rounded-xl p-4 sm:p-6 mb-4">
                    <p className="text-white/70 text-sm uppercase tracking-wider mb-1">Selling Price</p>
                    <p className="text-3xl sm:text-5xl font-bold text-secondary">
                      ₹{soldPopup.soldPrice.toLocaleString()}
                    </p>
                  </div>

                  <div>
                    <p className="text-textLight text-sm uppercase tracking-wider mb-1">Bought By</p>
                    <p className="text-xl sm:text-2xl font-bold text-text">
                      {soldPopup.teamName}
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectorScreen;
