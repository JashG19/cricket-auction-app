import { useState, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useRealtimeData } from "../../hooks/useRealtimeData";
import {
  firebaseObjectToArray,
  createLookupMap,
  findPlayerTeam,
  calculateSpentBudget,
  getImagePath,
} from "../../utils/dataTransformUtils";
import { ROUTES } from "../../constants/routes";
import { IoArrowBack, IoClose } from "react-icons/io5";
import { AnimatedNumber } from "../../components/AnimatedNumber";
import pcLogo from "/images/PCL Logo.png";

export const AuctionDashboard = () => {
  const { auctionId } = useParams();
  const navigate = useNavigate();
  const [selectedGroup, setSelectedGroup] = useState("all");
  const [showTeamSelector, setShowTeamSelector] = useState(false);

  // Real-time data
  const {
    data: auctionData,
    loading: auctionLoading,
    error: auctionError,
  } = useRealtimeData(`auctions/${auctionId}`);
  const { data: playersData } = useRealtimeData(
    `auctions/${auctionId}/players`,
  );
  const { data: teamsData } = useRealtimeData(`auctions/${auctionId}/teams`);
  const { data: groupsData } = useRealtimeData(`auctions/${auctionId}/groups`);
  const { data: liveState } = useRealtimeData(
    `auctions/${auctionId}/live_state`,
  );

  // Transform data with memoization
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

  // Lookup maps for O(1) access
  const groupsById = useMemo(() => createLookupMap(groupsList), [groupsList]);

  // Get current player from admin's live_state (synced via Firebase)
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
  const currentTeam = currentPlayer?.soldTo
    ? teamsList.find((t) => String(t.id) === String(currentPlayer.soldTo))
    : null;

  // Live bid from admin's real-time state
  const liveBid = liveState?.currentBid ?? 0;
  const isAuctionPaused = liveState?.isPaused ?? false;
  const isAuctionComplete = liveState?.isComplete ?? false;

  // Filter players by group
  const filteredPlayers =
    selectedGroup === "all"
      ? playersList
      : playersList.filter((p) => String(p.group_id) === String(selectedGroup));

  // Sorted teams for leaderboard (spread to avoid mutating memoized array)
  const sortedTeams = useMemo(
    () =>
      [...teamsList].sort(
        (a, b) =>
          Number(b.budget_total) -
          Number(b.budget_remaining) -
          (Number(a.budget_total) - Number(a.budget_remaining)),
      ),
    [teamsList],
  );

  // Stats
  const soldPlayers = playersList.filter((p) => p.soldTo).length;
  const unsoldPlayers = playersList.filter((p) => p.unsold && !p.soldTo).length;
  const pendingPlayers = playersList.length - soldPlayers - unsoldPlayers;
  const totalSpent = teamsList.reduce(
    (sum, team) => sum + calculateSpentBudget(team),
    0,
  );

  if (auctionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-lightBg dark:bg-gray-900 transition-colors">
        <div className="text-center">
          <p className="text-xl text-textLight dark:text-gray-400 mb-4">
            Loading auction data...
          </p>
          <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-primary dark:border-secondary mx-auto"></div>
        </div>
      </div>
    );
  }

  if (!auctionData || auctionError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-lightBg dark:bg-gray-900 transition-colors">
        <div className="text-center">
          <p className="text-2xl font-bold text-primary dark:text-secondary mb-2">
            Auction Not Found
          </p>
          <p className="text-textLight dark:text-gray-400 mb-6">
            {auctionError ||
              "This auction does not exist or may have been deleted."}
          </p>
          <Link to="/" className="btn btn-primary">
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-lightBg dark:bg-gray-900 p-3 sm:p-4 transition-colors">
      <div className="max-w-7xl mx-auto page-enter">
        {/* Header */}
        <div className="mb-4 sm:mb-6">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-primary dark:text-secondary hover:text-accent dark:hover:text-yellow-400 mb-3"
          >
            <IoArrowBack size={20} /> Back
          </Link>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white dark:bg-gray-800 rounded-lg p-1 shadow-md border border-border dark:border-gray-700 flex-shrink-0">
              <img
                src={pcLogo}
                alt="PCL 26"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <h1 className="text-2xl sm:text-4xl font-bold text-primary dark:text-secondary mb-1">
                {auctionData?.name}
              </h1>
              <p className="text-textLight dark:text-gray-400 text-sm flex items-center gap-2">
                {isAuctionComplete ? (
                  <span className="text-success font-semibold">
                    Auction Complete
                  </span>
                ) : isAuctionPaused ? (
                  <span className="text-yellow-600 dark:text-yellow-400 font-semibold">
                    Auction Paused
                  </span>
                ) : (
                  <>
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                    <span className="text-success font-semibold">
                      Live Auction
                    </span>
                  </>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Main Grid */}
        <div className="grid lg:grid-cols-3 gap-6 mb-8">
          {/* Current Player Section (Left) */}
          <div className="lg:col-span-1">
            {currentPlayer && currentGroup ? (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden card-hover">
                {/* Hero Player Photo */}
                <div className="relative w-full h-56 sm:h-72 lg:h-80">
                  {currentPlayer.photo_url ? (
                    <img
                      src={getImagePath(
                        "player-photo",
                        currentPlayer.photo_url,
                      )}
                      alt={currentPlayer.player_name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.style.display = "none";
                      }}
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                      <span className="text-6xl sm:text-7xl font-bold text-white/30">
                        {currentPlayer.player_name?.charAt(0)}
                      </span>
                    </div>
                  )}
                  {/* Gradient overlay with name */}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 sm:p-5">
                    <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white mb-1">
                      {currentPlayer.player_name}
                    </h2>
                    <div className="flex items-center gap-3">
                      <span className="text-white/80 text-sm">
                        Age: {currentPlayer.age}
                      </span>
                      <span className="bg-secondary text-primary px-2 py-0.5 rounded text-xs font-bold">
                        {currentGroup.group_name}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Compact Info */}
                <div className="p-3 sm:p-4">
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-textLight dark:text-gray-400">
                      Base:{" "}
                      <span className="font-bold text-text dark:text-white">
                        ₹{(currentGroup.base_price || 0).toLocaleString()}
                      </span>
                    </span>
                  </div>

                  {currentPlayer.soldTo && currentTeam && (
                    <div className="bg-success text-white p-3 rounded-lg text-center animate-fade-in-up">
                      <p className="text-sm opacity-90 mb-1">Sold to</p>
                      <p className="font-bold">{currentTeam.team_name}</p>
                      <p className="text-lg font-bold">
                        ₹{(currentPlayer.soldPrice || 0).toLocaleString()}
                      </p>
                    </div>
                  )}

                  {currentPlayer.unsold && !currentPlayer.soldTo && (
                    <div className="bg-red-100 dark:bg-red-900/40 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-300 p-3 rounded-lg text-center">
                      <p className="font-bold">Unsold</p>
                    </div>
                  )}

                  {!currentPlayer.soldTo && !currentPlayer.unsold && (
                    <div className="bg-yellow-100 dark:bg-yellow-900/40 border border-yellow-400 dark:border-yellow-700 text-yellow-700 dark:text-yellow-300 p-3 rounded-lg text-center">
                      <p className="font-bold">Currently Live</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="card text-center py-8">
                <p className="text-textLight dark:text-gray-400">
                  {isAuctionComplete
                    ? "Auction is complete!"
                    : !liveState
                      ? "Waiting for auction to start..."
                      : "No players available"}
                </p>
              </div>
            )}
          </div>

          {/* Current Bid Section (Center) */}
          <div className="lg:col-span-1">
            <div className="bg-gradient-to-br from-primary to-accent rounded-lg shadow-lg p-4 sm:p-8 text-white h-full flex flex-col justify-center items-center text-center">
              <p className="text-base sm:text-lg mb-3 sm:mb-4 opacity-90">
                {currentPlayer?.soldTo
                  ? "Sold For"
                  : isAuctionPaused
                    ? "Bid (Paused)"
                    : "Current Bid"}
              </p>
              <div className="mb-4 sm:mb-6 animate-pulse-bid">
                <AnimatedNumber
                  value={
                    currentPlayer?.soldTo
                      ? currentPlayer.soldPrice || 0
                      : liveBid
                  }
                  className="text-4xl sm:text-6xl font-bold text-secondary"
                />
              </div>

              {isAuctionPaused && !currentPlayer?.soldTo && (
                <div className="bg-yellow-400 text-yellow-900 px-4 py-2 rounded-lg mb-4 font-bold text-sm">
                  AUCTION PAUSED
                </div>
              )}

              <div className="bg-white bg-opacity-20 rounded-lg p-3 sm:p-4 w-full">
                <p className="text-sm opacity-90 mb-1 sm:mb-2">
                  Increment Value
                </p>
                <p className="text-2xl sm:text-3xl font-bold">
                  ₹{(currentGroup?.increment_value || 0).toLocaleString()}
                </p>
              </div>

              {currentGroup?.max_bid_cap && (
                <div className="mt-6 pt-6 border-t border-white border-opacity-30 w-full">
                  <p className="text-sm opacity-90 mb-2">Max Bid Cap</p>
                  <p className="text-2xl font-bold">
                    ₹{currentGroup.max_bid_cap.toLocaleString()}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Teams Leaderboard (Right) */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 sm:p-6 flex flex-col max-h-[600px]">
              <h3 className="text-lg sm:text-xl font-bold text-primary dark:text-secondary mb-4 flex-shrink-0">
                Teams ({teamsList.length})
              </h3>
              <div className="flex-1 space-y-2 overflow-y-auto min-h-0">
                {sortedTeams.map((team, idx) => (
                  <div
                    key={team.id}
                    className="p-3 border-2 border-border dark:border-gray-700 rounded-lg hover:border-primary dark:hover:border-secondary transition card-hover flex items-start gap-2"
                  >
                    {team.team_logo && (
                      <img
                        src={getImagePath("team-logo", team.team_logo)}
                        alt={team.team_name}
                        className="w-10 h-10 object-contain rounded border border-border dark:border-gray-600 flex-shrink-0"
                        onError={(e) => {
                          e.target.style.display = "none";
                        }}
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="font-bold text-text dark:text-white text-sm truncate">
                          #{idx + 1} {team.team_name}
                        </p>
                        <span className="bg-primary dark:bg-secondary text-white dark:text-primary text-xs px-2 py-0.5 rounded-full font-bold flex-shrink-0">
                          {team.squad?.length || 0}
                        </span>
                      </div>

                      <div className="mb-1.5">
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                          <div
                            className="bg-secondary h-1.5 rounded-full transition-all"
                            style={{
                              width: `${Math.min(100, Math.max(0, ((Number(team.budget_total) - Number(team.budget_remaining)) / Number(team.budget_total)) * 100))}%`,
                            }}
                          ></div>
                        </div>
                      </div>

                      <p
                        className={`text-xs font-bold ${Number(team.budget_remaining) > 0 ? "text-success" : "text-danger"}`}
                      >
                        ₹{Number(team.budget_remaining || 0).toLocaleString()}{" "}
                        remaining
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
          <div className="card card-hover text-center p-4">
            <p className="text-textLight dark:text-gray-400 text-xs sm:text-base mb-1 sm:mb-2">
              Total Players
            </p>
            <p className="text-2xl sm:text-4xl font-bold text-primary dark:text-white">
              {playersList.length}
            </p>
          </div>
          <div className="card card-hover text-center p-4">
            <p className="text-textLight dark:text-gray-400 text-xs sm:text-base mb-1 sm:mb-2">
              Sold Players
            </p>
            <p className="text-2xl sm:text-4xl font-bold text-secondary">
              {soldPlayers}
            </p>
          </div>
          <div className="card card-hover text-center p-4">
            <p className="text-textLight dark:text-gray-400 text-xs sm:text-base mb-1 sm:mb-2">
              Unsold Players
            </p>
            <p className="text-2xl sm:text-4xl font-bold text-danger">
              {unsoldPlayers}
            </p>
          </div>
          <div className="card card-hover text-center p-4">
            <p className="text-textLight dark:text-gray-400 text-xs sm:text-base mb-1 sm:mb-2">
              Total Spent
            </p>
            <p className="text-xl sm:text-3xl font-bold text-accent dark:text-secondary">
              ₹{totalSpent.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Quick Links */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
          <Link
            to={ROUTES.TEAM_DETAILS(auctionId)}
            className="card card-hover p-4 sm:p-6 hover:shadow-lg transition cursor-pointer bg-gradient-to-br from-primary to-darkBg text-white"
          >
            <h3 className="text-xl sm:text-2xl font-bold mb-2">
              View Team Details
            </h3>
            <p className="text-gray-200 text-sm">
              See detailed squad information
            </p>
          </Link>

          <Link
            to={ROUTES.PLAYER_POOL(auctionId)}
            className="card card-hover p-4 sm:p-6 hover:shadow-lg transition cursor-pointer bg-gradient-to-br from-accent to-secondary text-white"
          >
            <h3 className="text-xl sm:text-2xl font-bold mb-2">
              Browse Player Pool
            </h3>
            <p className="text-gray-200 text-sm">
              Search and filter all players
            </p>
          </Link>

          <button
            onClick={() => setShowTeamSelector(true)}
            className="card card-hover p-4 sm:p-6 hover:shadow-lg transition cursor-pointer bg-gradient-to-br from-purple-600 to-purple-900 text-white text-left"
          >
            <h3 className="text-xl sm:text-2xl font-bold mb-2">
              Team Owner Login
            </h3>
            <p className="text-gray-200 text-sm">
              Access your team's private dashboard
            </p>
          </button>
        </div>

        {/* Player Pool Preview */}
        <div className="card">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-6">
            <h2 className="text-xl sm:text-2xl font-bold text-primary dark:text-secondary">
              Player Pool ({filteredPlayers.length})
            </h2>
            <select
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
              className="px-4 py-2 border border-border dark:border-gray-600 rounded-lg focus:outline-none focus:border-primary dark:focus:border-secondary bg-white dark:bg-gray-700 text-text dark:text-white"
            >
              <option value="all">All Groups</option>
              {groupsList.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.group_name}
                </option>
              ))}
            </select>
          </div>

          {filteredPlayers.length === 0 ? (
            <p className="text-textLight dark:text-gray-400 py-8 text-center">
              No players in this group
            </p>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredPlayers.map((player) => {
                const group = groupsById.get(String(player.group_id));
                const team = player.soldTo
                  ? teamsList.find(
                      (t) => String(t.id) === String(player.soldTo),
                    )
                  : null;

                return (
                  <div
                    key={player.id}
                    className={`p-4 border-2 rounded-lg transition card-hover ${
                      player.soldTo
                        ? "border-success bg-green-50 dark:bg-green-900/30"
                        : "border-border dark:border-gray-700 hover:border-primary dark:hover:border-secondary"
                    }`}
                  >
                    <p className="font-bold text-text dark:text-white mb-1">
                      {player.player_name}
                    </p>
                    <p className="text-xs text-textLight dark:text-gray-400 mb-2">
                      Age: {player.age}
                    </p>
                    <p className="text-xs mb-2">
                      <span className="bg-secondary text-primary px-2 py-1 rounded text-xs font-bold">
                        {group?.group_name || "N/A"}
                      </span>
                    </p>
                    <p className="text-sm font-semibold text-primary dark:text-secondary mb-2">
                      Base: ₹{(group?.base_price || 0).toLocaleString()}
                    </p>

                    {player.soldTo ? (
                      <div className="text-xs bg-success text-white p-2 rounded">
                        <div className="flex items-center gap-2 mb-1">
                          {team?.team_logo && (
                            <img
                              src={getImagePath("team-logo", team.team_logo)}
                              alt={team?.team_name}
                              className="w-6 h-6 object-contain rounded"
                              onError={(e) => {
                                e.target.style.display = "none";
                              }}
                            />
                          )}
                          <span className="truncate">
                            Sold to {team?.team_name || "Unknown"}
                          </span>
                        </div>
                        <p className="font-bold">
                          ₹{(player.soldPrice || 0).toLocaleString()}
                        </p>
                      </div>
                    ) : player.unsold ? (
                      <p className="text-xs text-danger font-bold">Unsold</p>
                    ) : (
                      <p className="text-xs text-textLight dark:text-gray-400">
                        Status:{" "}
                        <span className="text-warning font-bold">Pending</span>
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Team Selector Modal */}
      {showTeamSelector && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-border dark:border-gray-700 bg-gradient-to-r from-purple-600 to-purple-800 text-white">
              <h3 className="text-xl font-bold">Select Your Team</h3>
              <button
                onClick={() => setShowTeamSelector(false)}
                className="p-1 hover:bg-white/20 rounded-full transition"
              >
                <IoClose size={24} />
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[60vh]">
              <p className="text-textLight dark:text-gray-400 text-sm mb-4">
                Choose your team to access the private owner dashboard with
                detailed budget insights and strategy tools.
              </p>
              <div className="space-y-3">
                {teamsList.length === 0 ? (
                  <p className="text-center text-textLight dark:text-gray-400 py-8">
                    No teams found
                  </p>
                ) : (
                  teamsList.map((team) => (
                    <button
                      key={team.id}
                      onClick={() => {
                        setShowTeamSelector(false);
                        navigate(ROUTES.TEAM_OWNER(auctionId, team.id));
                      }}
                      className="w-full flex items-center gap-4 p-4 border-2 border-border dark:border-gray-700 rounded-lg hover:border-purple-500 dark:hover:border-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/30 transition text-left"
                    >
                      <div className="w-12 h-12 flex-shrink-0 bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden">
                        {team.team_logo ? (
                          <img
                            src={getImagePath("team-logo", team.team_logo)}
                            alt={team.team_name}
                            className="w-full h-full object-contain"
                            onError={(e) => {
                              e.target.style.display = "none";
                            }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-primary dark:text-secondary font-bold text-xl">
                            {team.team_name?.charAt(0) || "T"}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-text dark:text-white truncate">
                          {team.team_name}
                        </p>
                        <p className="text-sm text-textLight dark:text-gray-400">
                          Budget: ₹
                          {(team.budget_remaining || 0).toLocaleString()}{" "}
                          remaining
                        </p>
                      </div>
                      <span className="text-purple-600 dark:text-purple-400 font-semibold text-sm">
                        →
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuctionDashboard;
