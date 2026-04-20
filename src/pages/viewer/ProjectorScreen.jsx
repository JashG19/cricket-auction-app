import { useState, useEffect, useMemo, useRef } from "react";
import { useParams } from "react-router-dom";
import { useRealtimeData } from "../../hooks/useRealtimeData";
import {
  firebaseObjectToArray,
  createLookupMap,
  getImagePath,
} from "../../utils/dataTransformUtils";
import { AnimatedNumber } from "../../components/AnimatedNumber";
import confetti from "canvas-confetti";
import pcLogo from "/PCL_Logo.png";

export const ProjectorScreen = () => {
  const { auctionId } = useParams();
  const [soldPopup, setSoldPopup] = useState(null);
  const [showTeamBalances, setShowTeamBalances] = useState(false);
  const popupTimerRef = useRef(null);

  // Real-time data
  const { data: playersData } = useRealtimeData(
    `auctions/${auctionId}/players`,
  );
  const { data: teamsData } = useRealtimeData(`auctions/${auctionId}/teams`);
  const { data: groupsData } = useRealtimeData(`auctions/${auctionId}/groups`);
  const { data: liveState } = useRealtimeData(
    `auctions/${auctionId}/live_state`,
  );
  const { data: auctionData } = useRealtimeData(`auctions/${auctionId}`);

  const playersList = useMemo(
    () => firebaseObjectToArray(playersData),
    [playersData],
  );
  const teamsList = useMemo(
    () => firebaseObjectToArray(teamsData),
    [teamsData],
  );
  const groupsList = useMemo(
    () => firebaseObjectToArray(groupsData),
    [groupsData],
  );
  const groupsById = useMemo(() => createLookupMap(groupsList), [groupsList]);
  const teamsById = useMemo(() => createLookupMap(teamsList), [teamsList]);
  const sortedTeamsByBalance = useMemo(
    () =>
      [...teamsList].sort(
        (a, b) => (b.budget_remaining || 0) - (a.budget_remaining || 0),
      ),
    [teamsList],
  );

  // Resolve current player
  const currentPlayer = useMemo(() => {
    if (liveState?.currentPlayerId) {
      return (
        playersList.find(
          (p) => String(p.id) === String(liveState.currentPlayerId),
        ) || null
      );
    }
    return null;
  }, [liveState?.currentPlayerId, playersList]);

  const currentGroup = currentPlayer
    ? groupsById.get(String(currentPlayer.group_id))
    : null;

  const currentPlayerStats = useMemo(() => {
    const stats = currentPlayer?.stats;
    if (!stats) return null;

    const batting = stats.batting || {};
    const bowling = stats.bowling || {};
    const highlights = stats.highlights || {};

    return {
      batting: {
        matches: batting.matches ?? 0,
        runs: batting.runs ?? 0,
        strikeRate: batting.strikeRate ?? highlights.battingStrikeRate ?? 0,
        average: batting.average ?? highlights.battingAverage ?? 0,
      },
      bowling: {
        matches: bowling.matches ?? 0,
        wickets: bowling.wickets ?? highlights.bowlingWickets ?? 0,
        economy: bowling.economy ?? highlights.bowlingEconomy ?? 0,
        average: bowling.average ?? highlights.bowlingAverage ?? 0,
      },
    };
  }, [currentPlayer?.stats]);

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

    // Clear any existing timer
    if (popupTimerRef.current) {
      clearTimeout(popupTimerRef.current);
    }

    setSoldPopup({
      playerId: currentPlayer.id,
      playerName: currentPlayer.player_name,
      photoUrl: getImagePath("player-photo", currentPlayer.photo_url),
      soldPrice: currentPlayer.soldPrice || 0,
      teamName: team.team_name,
      teamLogo: team.team_logo,
    });

    confetti({
      particleCount: 150,
      spread: 100,
      origin: { y: 0.5 },
      colors: ["#ffc107", "#1a3a52", "#10b981", "#ffffff"],
    });

    // Auto-dismiss after 6 seconds
    popupTimerRef.current = setTimeout(() => setSoldPopup(null), 6000);
  }, [currentPlayer?.soldTo, currentPlayer?.id]);

  // Detect unsold → show brief popup
  useEffect(() => {
    if (!currentPlayer?.unsold || currentPlayer?.soldTo) return;
    if (soldPopup?.playerId === currentPlayer.id) return;

    // Clear any existing timer
    if (popupTimerRef.current) {
      clearTimeout(popupTimerRef.current);
    }

    setSoldPopup({
      playerId: currentPlayer.id,
      playerName: currentPlayer.player_name,
      photoUrl: getImagePath("player-photo", currentPlayer.photo_url),
      unsold: true,
    });

    popupTimerRef.current = setTimeout(() => setSoldPopup(null), 4000);
  }, [currentPlayer?.unsold, currentPlayer?.id]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (popupTimerRef.current) {
        clearTimeout(popupTimerRef.current);
      }
    };
  }, []);

  // Full-screen dark background
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a1628] to-[#0F1419] flex flex-col items-center justify-center relative overflow-hidden">
      {/* Auction Name - Top Bar */}
      <div className="absolute top-0 left-0 right-0 bg-gradient-to-r from-primary/90 to-[#0a1628]/90 backdrop-blur-md px-6 py-4 flex items-center justify-between z-10 border-b-2 border-secondary/60">
        {/* PCL Branding */}
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-white rounded-lg p-1.5 shadow-lg">
            <img
              src={pcLogo}
              alt="PCL 26"
              className="w-full h-full object-contain"
            />
          </div>
          <div className="flex flex-col">
            <p className="text-sm font-bold text-secondary tracking-wider">
              PCL 26
            </p>
            <h1 className="text-lg sm:text-xl font-bold text-white truncate">
              {auctionData?.name || "Cricket Auction"}
            </h1>
          </div>
        </div>

        {/* Status Badges + Team Balances Button */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowTeamBalances(!showTeamBalances)}
            className={`px-4 py-2 rounded-full text-sm font-bold shadow-lg transition-all ${
              showTeamBalances
                ? "bg-secondary text-primary"
                : "bg-white/20 text-white hover:bg-white/30"
            }`}
          >
            {showTeamBalances ? "← Back to Auction" : "Team Balances"}
          </button>
          {!isPaused && !isComplete && currentPlayer && (
            <span className="bg-green-500 text-white px-4 py-2 rounded-full text-sm font-bold flex items-center gap-2 shadow-lg">
              <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
              LIVE
            </span>
          )}
          {isPaused && !isComplete && (
            <span className="bg-yellow-400 text-yellow-900 px-4 py-2 rounded-full text-sm font-bold animate-pulse shadow-lg">
              PAUSED
            </span>
          )}
          {isComplete && (
            <span className="bg-green-500 text-white px-4 py-2 rounded-full text-sm font-bold shadow-lg">
              COMPLETE
            </span>
          )}
        </div>
      </div>

      {/* Team Balances View */}
      {showTeamBalances ? (
        <div className="w-full max-w-6xl mx-auto px-6 pt-28 pb-8">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-8 text-center">
            Team Balances
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {sortedTeamsByBalance.map((team) => (
                <div
                  key={team.id}
                  className="bg-white/10 backdrop-blur-sm rounded-xl p-4 sm:p-6 border border-white/20 hover:border-secondary/50 transition-all"
                >
                  <div className="flex items-center gap-3 mb-4">
                    {team.team_logo ? (
                      <img
                        src={getImagePath("team-logo", team.team_logo)}
                        alt={team.team_name}
                        className="w-12 h-12 sm:w-14 sm:h-14 object-contain rounded-lg bg-white p-1"
                        onError={(e) => {
                          e.target.style.display = "none";
                        }}
                      />
                    ) : (
                      <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-lg bg-primary flex items-center justify-center">
                        <span className="text-xl font-bold text-white/50">
                          {team.team_name?.charAt(0)}
                        </span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-bold text-sm sm:text-base truncate">
                        {team.team_name}
                      </p>
                      <p className="text-white/60 text-xs sm:text-sm truncate">
                        {team.owner_name}
                      </p>
                    </div>
                  </div>

                  {/* Budget Bar */}
                  <div className="mb-3">
                    <div className="w-full bg-white/20 rounded-full h-2">
                      <div
                        className="bg-secondary h-2 rounded-full transition-all"
                        style={{
                          width: `${Math.min(100, Math.max(0, ((Number(team.budget_total) - Number(team.budget_remaining)) / Number(team.budget_total)) * 100))}%`,
                        }}
                      ></div>
                    </div>
                  </div>

                  {/* Balance */}
                  <div className="text-center">
                    <p className="text-white/60 text-xs uppercase tracking-wider mb-1">
                      Remaining
                    </p>
                    <p
                      className={`text-2xl sm:text-3xl font-bold ${
                        Number(team.budget_remaining) > 0
                          ? "text-green-400"
                          : "text-red-400"
                      }`}
                    >
                      ₹{Number(team.budget_remaining || 0).toLocaleString()}
                    </p>
                    <p className="text-white/50 text-xs mt-1">
                      of ₹{Number(team.budget_total || 0).toLocaleString()}
                    </p>
                  </div>

                  {/* Players Count */}
                  <div className="mt-3 pt-3 border-t border-white/10 text-center">
                    <span className="text-secondary font-bold text-lg">
                      {team.squad?.length || 0}
                    </span>
                    <span className="text-white/60 text-sm ml-1">players</span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      ) : /* Main Content - Current Player */
      currentPlayer && currentGroup ? (
        <div className="flex flex-col lg:flex-row items-center justify-center gap-8 lg:gap-16 w-full max-w-7xl px-6 pt-28 pb-8">
          {/* Player Photo - LARGE */}
          <div className="relative flex-shrink-0">
            <div className="w-[320px] h-[420px] sm:w-[400px] sm:h-[520px] lg:w-[480px] lg:h-[620px] rounded-2xl overflow-hidden shadow-2xl border-4 border-white/10 bg-gradient-to-br from-primary to-accent">
              {/* Initial as background fallback */}
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[10rem] font-bold text-white/20">
                  {currentPlayer.player_name?.charAt(0)}
                </span>
              </div>
              {/* Photo overlay (if exists) */}
              {currentPlayer.photo_url && (
                <img
                  src={getImagePath("player-photo", currentPlayer.photo_url)}
                  alt={currentPlayer.player_name}
                  className="absolute inset-0 w-full h-full object-cover"
                  onError={(e) => {
                    e.target.style.display = "none";
                  }}
                />
              )}

              {/* Name Overlay at Bottom */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-6 sm:p-8">
                <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-2 leading-tight">
                  {currentPlayer.player_name}
                </h2>
                <div className="flex flex-wrap items-center gap-3 sm:gap-4">
                  <span className="text-white/70 text-lg sm:text-xl">
                    Age: {currentPlayer.age}
                  </span>
                  <span className="bg-secondary text-primary px-3 py-1 rounded-lg text-sm sm:text-base font-bold">
                    {currentGroup.group_name}
                  </span>
                  <span className="bg-white/15 text-white px-3 py-1 rounded-lg text-sm sm:text-base font-bold">
                    Base: ₹{(currentGroup.base_price || 0).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Bid + Stats Panel */}
          <div className="flex flex-col items-center text-center lg:text-left space-y-6 lg:space-y-8">
            {/* Current Bid - HUGE */}
            <div>
              <p className="text-white/60 text-xl sm:text-2xl uppercase tracking-widest mb-2">
                {currentPlayer.soldTo ? "Sold For" : "Current Bid"}
              </p>
              <div className="animate-pulse-bid">
                <AnimatedNumber
                  value={
                    currentPlayer.soldTo
                      ? currentPlayer.soldPrice || 0
                      : liveBid
                  }
                  duration={400}
                  className="text-7xl sm:text-9xl lg:text-[10rem] font-bold text-secondary drop-shadow-lg"
                />
              </div>
            </div>

            {/* Sold Status inline */}
            {currentPlayer.soldTo && (
              <div className="animate-fade-in-up">
                <p className="text-white/50 text-base uppercase tracking-wider mb-2">
                  Sold To
                </p>
                <div className="flex items-center justify-center gap-4">
                  {teamsById.get(String(currentPlayer.soldTo))?.team_logo && (
                    <img
                      src={getImagePath(
                        "team-logo",
                        teamsById.get(String(currentPlayer.soldTo)).team_logo,
                      )}
                      alt=""
                      className="w-14 h-14 sm:w-16 sm:h-16 object-contain rounded-lg border-2 border-green-400/50"
                      onError={(e) => {
                        e.target.style.display = "none";
                      }}
                    />
                  )}
                  <p className="text-3xl sm:text-4xl font-bold text-green-400">
                    {teamsById.get(String(currentPlayer.soldTo))?.team_name ||
                      "Unknown"}
                  </p>
                </div>
              </div>
            )}

            {currentPlayer.unsold && !currentPlayer.soldTo && (
              <div className="animate-fade-in-up">
                <p className="text-4xl sm:text-5xl font-bold text-red-400">
                  UNSOLD
                </p>
              </div>
            )}

            {currentPlayerStats && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 w-full max-w-3xl">
                <div className="bg-white/10 border border-white/20 rounded-2xl p-6 backdrop-blur-sm">
                  <p className="text-secondary text-sm uppercase tracking-[0.2em] mb-4">
                    Batting Spotlight
                  </p>
                  <div className="space-y-3 text-white text-xl">
                    <p className="flex justify-between gap-5">
                      <span className="text-white/70">Matches</span>
                      <span className="font-bold text-2xl">
                        {currentPlayerStats.batting.matches}
                      </span>
                    </p>
                    <p className="flex justify-between gap-5">
                      <span className="text-white/70">Runs</span>
                      <span className="font-bold text-2xl">
                        {currentPlayerStats.batting.runs}
                      </span>
                    </p>
                    <p className="flex justify-between gap-5">
                      <span className="text-white/70">Strike Rate</span>
                      <span
                        className={`font-bold text-2xl ${
                          currentPlayerStats.batting.strikeRate >= 140
                            ? "text-emerald-300"
                            : "text-white"
                        }`}
                      >
                        {Number(currentPlayerStats.batting.strikeRate).toFixed(2)}
                      </span>
                    </p>
                    <p className="flex justify-between gap-5">
                      <span className="text-white/70">Average</span>
                      <span className="font-bold text-2xl">
                        {Number(currentPlayerStats.batting.average).toFixed(2)}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="bg-white/10 border border-white/20 rounded-2xl p-6 backdrop-blur-sm">
                  <p className="text-cyan-300 text-sm uppercase tracking-[0.2em] mb-4">
                    Bowling Spotlight
                  </p>
                  <div className="space-y-3 text-white text-xl">
                    <p className="flex justify-between gap-5">
                      <span className="text-white/70">Matches</span>
                      <span className="font-bold text-2xl">
                        {currentPlayerStats.bowling.matches}
                      </span>
                    </p>
                    <p className="flex justify-between gap-5">
                      <span className="text-white/70">Wickets</span>
                      <span className="font-bold text-2xl">
                        {currentPlayerStats.bowling.wickets}
                      </span>
                    </p>
                    <p className="flex justify-between gap-5">
                      <span className="text-white/70">Economy</span>
                      <span
                        className={`font-bold text-2xl ${
                          currentPlayerStats.bowling.economy > 0 &&
                          currentPlayerStats.bowling.economy < 7
                            ? "text-emerald-300"
                            : "text-white"
                        }`}
                      >
                        {Number(currentPlayerStats.bowling.economy).toFixed(2)}
                      </span>
                    </p>
                    <p className="flex justify-between gap-5">
                      <span className="text-white/70">Average</span>
                      <span className="font-bold text-2xl">
                        {Number(currentPlayerStats.bowling.average).toFixed(2)}
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* No player / Waiting / Complete */
        <div className="text-center page-enter">
          {isComplete ? (
            <>
              <div className="w-24 h-24 bg-white rounded-xl p-2 mx-auto mb-8 shadow-2xl">
                <img
                  src={pcLogo}
                  alt="PCL 26"
                  className="w-full h-full object-contain"
                />
              </div>
              <p className="text-5xl sm:text-7xl font-bold text-secondary mb-4">
                Auction Complete
              </p>
              <p className="text-xl sm:text-2xl text-white/60">
                Thank you for participating in PCL 26!
              </p>
            </>
          ) : (
            <>
              <div className="w-20 h-20 bg-white rounded-xl p-2 mx-auto mb-8 shadow-2xl">
                <img
                  src={pcLogo}
                  alt="PCL 26"
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="w-12 h-12 border-4 border-secondary border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
              <p className="text-2xl sm:text-3xl font-bold text-white/60">
                Waiting for auction to start...
              </p>
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
                    <span className="text-5xl font-bold text-white/40">
                      {soldPopup.playerName?.charAt(0)}
                    </span>
                  </div>
                )}
                <p className="text-red-500 text-sm font-bold uppercase tracking-widest mb-2">
                  Unsold
                </p>
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
                      <span className="text-7xl font-bold text-white/20">
                        {soldPopup.playerName?.charAt(0)}
                      </span>
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
                    <p className="text-white/70 text-sm uppercase tracking-wider mb-1">
                      Selling Price
                    </p>
                    <p className="text-3xl sm:text-5xl font-bold text-secondary">
                      ₹{soldPopup.soldPrice.toLocaleString()}
                    </p>
                  </div>

                  <div className="flex items-center justify-center gap-3">
                    {soldPopup.teamLogo && (
                      <img
                        src={getImagePath("team-logo", soldPopup.teamLogo)}
                        alt={soldPopup.teamName}
                        className="w-12 h-12 sm:w-16 sm:h-16 object-contain rounded-lg border-2 border-border"
                        onError={(e) => {
                          e.target.style.display = "none";
                        }}
                      />
                    )}
                    <div>
                      <p className="text-textLight text-sm uppercase tracking-wider mb-1">
                        Bought By
                      </p>
                      <p className="text-xl sm:text-2xl font-bold text-text">
                        {soldPopup.teamName}
                      </p>
                    </div>
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
