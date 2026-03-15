import { useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { useRealtimeData } from "../../hooks/useRealtimeData";
import { firebaseObjectToArray, createLookupMap, findPlayerTeam, calculateSpentBudget } from "../../utils/dataTransformUtils";
import { ROUTES } from "../../constants/routes";
import { IoArrowBack } from "react-icons/io5";

export const AuctionDashboard = () => {
  const { auctionId } = useParams();
  const [selectedGroup, setSelectedGroup] = useState("all");

  // Real-time data
  const { data: auctionData } = useRealtimeData(`auctions/${auctionId}`);
  const { data: playersData } = useRealtimeData(
    `auctions/${auctionId}/players`,
  );
  const { data: teamsData } = useRealtimeData(`auctions/${auctionId}/teams`);
  const { data: groupsData } = useRealtimeData(`auctions/${auctionId}/groups`);

  // Transform data with memoization
  const playersList = useMemo(() => firebaseObjectToArray(playersData), [playersData]);
  const teamsList = useMemo(() => firebaseObjectToArray(teamsData), [teamsData]);
  const groupsList = useMemo(() => firebaseObjectToArray(groupsData), [groupsData]);

  // Lookup maps for O(1) access
  const groupsById = useMemo(() => createLookupMap(groupsList), [groupsList]);

  // Get current player (first unsold player)
  const currentPlayer = playersList.find((p) => !p.soldPrice) || playersList[0];
  const currentGroup = currentPlayer
    ? groupsById.get(String(currentPlayer.group_id))
    : null;
  const currentTeam = currentPlayer
    ? findPlayerTeam(currentPlayer.id, teamsList)
    : null;

  // Filter players by group
  const filteredPlayers =
    selectedGroup === "all"
      ? playersList
      : playersList.filter(
          (p) => String(p.group_id) === String(selectedGroup),
        );

  // Stats
  const soldPlayers = playersList.filter((p) => p.soldPrice).length;
  const unsoldPlayers = playersList.length - soldPlayers;
  const totalSpent = teamsList.reduce(
    (sum, team) => sum + calculateSpentBudget(team),
    0,
  );

  if (!auctionData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-lightBg">
        <div className="text-center">
          <p className="text-xl text-textLight mb-4">Loading auction data...</p>
          <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-primary mx-auto"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-lightBg p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-primary hover:text-accent mb-4"
          >
            <IoArrowBack size={20} /> Back
          </Link>
          <h1 className="text-4xl font-bold text-primary mb-2">
            {auctionData?.name}
          </h1>
          <p className="text-textLight">Live Auction Dashboard</p>
        </div>

        {/* Main Grid */}
        <div className="grid lg:grid-cols-3 gap-6 mb-8">
          {/* Current Player Section (Left) */}
          <div className="lg:col-span-1">
            {currentPlayer && currentGroup ? (
              <div className="bg-white rounded-lg shadow-lg overflow-hidden">
                {/* Player Photo */}
                <div className="w-full h-64 bg-gray-300 flex items-center justify-center text-gray-500">
                  {currentPlayer.photo_url ? (
                    <img
                      src={currentPlayer.photo_url}
                      alt={currentPlayer.player_name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span>No Photo</span>
                  )}
                </div>

                {/* Player Details */}
                <div className="p-6">
                  <h2 className="text-2xl font-bold text-primary mb-4">
                    {currentPlayer.player_name}
                  </h2>

                  <div className="space-y-3 mb-6">
                    <div className="flex justify-between">
                      <span className="text-textLight">Age:</span>
                      <span className="font-bold text-text">
                        {currentPlayer.age}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-textLight">Group:</span>
                      <span className="font-bold text-secondary">
                        {currentGroup.group_name}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-textLight">Base Price:</span>
                      <span className="font-bold text-text">
                        ₹{(currentPlayer.base_price || 0).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-textLight">Role:</span>
                      <span className="font-bold text-text">
                        {currentPlayer.role || "N/A"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-textLight">Nationality:</span>
                      <span className="font-bold text-text">
                        {currentPlayer.nationality || "N/A"}
                      </span>
                    </div>
                  </div>

                  {currentPlayer.soldPrice && currentTeam && (
                    <div className="bg-success text-text p-3 rounded-lg text-center">
                      <p className="text-sm text-textLight mb-1">Sold to</p>
                      <p className="font-bold">{currentTeam.team_name}</p>
                      <p className="text-lg font-bold text-secondary">
                        ₹{currentPlayer.soldPrice.toLocaleString()}
                      </p>
                    </div>
                  )}

                  {!currentPlayer.soldPrice && (
                    <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 p-3 rounded-lg text-center">
                      <p className="text-sm">Status</p>
                      <p className="font-bold">Currently Live</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="card text-center py-8">
                <p className="text-textLight">No players available</p>
              </div>
            )}
          </div>

          {/* Current Bid Section (Center) */}
          <div className="lg:col-span-1">
            <div className="bg-gradient-to-br from-primary to-accent rounded-lg shadow-lg p-8 text-white h-full flex flex-col justify-center items-center text-center">
              <p className="text-lg mb-4 opacity-90">Current Bid</p>
              <div className="text-6xl font-bold text-secondary mb-6 animate-pulse-bid">
                ₹
                {(
                  currentPlayer?.soldPrice ||
                  currentPlayer?.base_price ||
                  0
                ).toLocaleString()}
              </div>

              <div className="bg-white bg-opacity-20 rounded-lg p-4 w-full">
                <p className="text-sm opacity-90 mb-2">Increment Value</p>
                <p className="text-3xl font-bold">
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
            <div className="bg-white rounded-lg shadow-lg p-6 h-full flex flex-col">
              <h3 className="text-xl font-bold text-primary mb-4">
                Teams ({teamsList.length})
              </h3>
              <div className="flex-1 space-y-3 overflow-y-auto">
                {teamsList
                  .sort(
                    (a, b) =>
                      b.budget_total -
                      b.budget_remaining -
                      (a.budget_total - a.budget_remaining),
                  )
                  .map((team, idx) => (
                    <div
                      key={team.id}
                      className="p-4 border-2 border-border rounded-lg hover:border-primary transition"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-bold text-text">
                            #{idx + 1} {team.team_name}
                          </p>
                          <p className="text-xs text-textLight">
                            {team.owner_name}
                          </p>
                        </div>
                        <span className="bg-primary text-white text-xs px-2 py-1 rounded-full font-bold">
                          {team.squad?.length || 0}
                        </span>
                      </div>

                      <div className="mb-2">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-textLight">Budget Used</span>
                          <span className="font-bold text-text">
                            ₹
                            {(
                              team.budget_total - team.budget_remaining
                            ).toLocaleString()}
                            /{team.budget_total.toLocaleString()}
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-secondary h-2 rounded-full transition-all"
                            style={{
                              width: `${Math.max(0, ((team.budget_total - team.budget_remaining) / team.budget_total) * 100)}%`,
                            }}
                          ></div>
                        </div>
                      </div>

                      <p
                        className={`text-sm font-bold ${team.budget_remaining > 0 ? "text-success" : "text-danger"}`}
                      >
                        Remaining: ₹{team.budget_remaining.toLocaleString()}
                      </p>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid md:grid-cols-4 gap-4 mb-8">
          <div className="card text-center">
            <p className="text-textLight mb-2">Total Players</p>
            <p className="text-4xl font-bold text-primary">
              {playersList.length}
            </p>
          </div>
          <div className="card text-center">
            <p className="text-textLight mb-2">Sold Players</p>
            <p className="text-4xl font-bold text-secondary">{soldPlayers}</p>
          </div>
          <div className="card text-center">
            <p className="text-textLight mb-2">Unsold Players</p>
            <p className="text-4xl font-bold text-danger">{unsoldPlayers}</p>
          </div>
          <div className="card text-center">
            <p className="text-textLight mb-2">Total Spent</p>
            <p className="text-3xl font-bold text-accent">
              ₹{totalSpent.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Quick Links */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <Link
            to={ROUTES.TEAM_DETAILS(auctionId)}
            className="card p-6 hover:shadow-lg transition cursor-pointer bg-gradient-to-br from-primary to-darkBg text-white"
          >
            <h3 className="text-2xl font-bold mb-2">View Team Details</h3>
            <p className="text-gray-200">See detailed squad information</p>
          </Link>

          <Link
            to={ROUTES.PLAYER_POOL(auctionId)}
            className="card p-6 hover:shadow-lg transition cursor-pointer bg-gradient-to-br from-accent to-secondary text-white"
          >
            <h3 className="text-2xl font-bold mb-2">Browse Player Pool</h3>
            <p className="text-gray-200">Search and filter all players</p>
          </Link>
        </div>

        {/* Player Pool Preview */}
        <div className="card">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-primary">
              Player Pool ({filteredPlayers.length})
            </h2>
            <select
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
              className="px-4 py-2 border border-border rounded-lg focus:outline-none focus:border-primary"
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
            <p className="text-textLight py-8 text-center">
              No players in this group
            </p>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredPlayers.map((player) => {
                const group = groupsById.get(String(player.group_id));
                const team = findPlayerTeam(player.id, teamsList);

                return (
                  <div
                    key={player.id}
                    className={`p-4 border-2 rounded-lg transition ${
                      player.soldPrice
                        ? "border-success bg-green-50"
                        : "border-border hover:border-primary"
                    }`}
                  >
                    <p className="font-bold text-text mb-1">
                      {player.player_name}
                    </p>
                    <p className="text-xs text-textLight mb-2">
                      Age: {player.age}
                    </p>
                    <p className="text-xs mb-2">
                      <span className="bg-secondary text-primary px-2 py-1 rounded text-xs font-bold">
                        {group?.group_name || "N/A"}
                      </span>
                    </p>
                    <p className="text-sm font-semibold text-primary mb-2">
                      Base: ₹{(group?.base_price || 0).toLocaleString()}
                    </p>

                    {player.soldPrice ? (
                      <div className="text-xs bg-success text-white p-2 rounded text-center">
                        <p>Sold to {team?.team_name}</p>
                        <p className="font-bold">
                          ₹{player.soldPrice.toLocaleString()}
                        </p>
                      </div>
                    ) : (
                      <p className="text-xs text-textLight">
                        Status:{" "}
                        <span className="text-warning font-bold">Unsold</span>
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuctionDashboard;
