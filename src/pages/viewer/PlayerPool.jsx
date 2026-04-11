import { useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { useRealtimeData } from "../../hooks/useRealtimeData";
import {
  firebaseObjectToArray,
  createLookupMap,
  getImagePath,
} from "../../utils/dataTransformUtils";
import { ROUTES } from "../../constants/routes";
import { IoArrowBack, IoSearch } from "react-icons/io5";

export const PlayerPool = () => {
  const { auctionId } = useParams();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedGroup, setSelectedGroup] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

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
  const teamsById = useMemo(() => createLookupMap(teamsList), [teamsList]);

  // Filter players
  const filteredPlayers = useMemo(() => {
    const getPlayerStatus = (player) => {
      if (player.soldTo) return "sold";
      if (player.unsold) return "unsold";
      return "pending";
    };

    return playersList.filter((player) => {
      // Search filter
      if (
        searchTerm &&
        !player.player_name?.toLowerCase().includes(searchTerm.toLowerCase())
      ) {
        return false;
      }

      // Group filter
      if (
        selectedGroup !== "all" &&
        String(player.group_id) !== String(selectedGroup)
      ) {
        return false;
      }

      // Status filter
      if (statusFilter !== "all" && getPlayerStatus(player) !== statusFilter) {
        return false;
      }

      return true;
    });
  }, [playersList, searchTerm, selectedGroup, statusFilter]);

  // Stats
  const totalPlayers = playersList.length;
  const soldCount = playersList.filter((p) => p.soldTo).length;
  const unsoldCount = playersList.filter((p) => p.unsold && !p.soldTo).length;
  const pendingCount = totalPlayers - soldCount - unsoldCount;

  if (auctionLoading) {
    return (
      <div className="min-h-screen bg-lightBg p-3 sm:p-4 transition-colors">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6">
            <div className="skeleton h-6 w-32 mb-3"></div>
            <div className="skeleton h-10 w-64 mb-2"></div>
            <div className="skeleton h-4 w-48"></div>
          </div>
          <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-8">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="card p-4">
                <div className="skeleton h-4 w-20 mx-auto mb-2"></div>
                <div className="skeleton h-10 w-16 mx-auto"></div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="rounded-lg overflow-hidden bg-white shadow-lg"
              >
                <div className="skeleton h-28 sm:h-40 w-full rounded-none"></div>
                <div className="p-3 space-y-2">
                  <div className="skeleton h-5 w-2/3"></div>
                  <div className="skeleton h-4 w-1/3"></div>
                  <div className="skeleton h-6 w-1/2 mt-2"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!auctionData || auctionError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-lightBg transition-colors">
        <div className="text-center">
          <p className="text-2xl font-bold text-primary mb-2">
            Auction Not Found
          </p>
          <p className="text-textLight mb-6">
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
    <div className="min-h-screen bg-lightBg p-3 sm:p-4 transition-colors">
      <div className="max-w-7xl mx-auto page-enter">
        {/* Header */}
        <div className="mb-4 sm:mb-6">
          <Link
            to={ROUTES.AUCTION_DASHBOARD(auctionId)}
            className="inline-flex items-center gap-2 text-primary hover:text-accent mb-3"
          >
            <IoArrowBack size={20} /> Back to Dashboard
          </Link>
          <h1 className="text-2xl sm:text-4xl font-bold text-primary mb-1">
            {auctionData?.name} - Player Pool
          </h1>
          <p className="text-textLight text-sm">
            Browse and filter all {totalPlayers} players
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-6 sm:mb-8">
          <div className="card card-hover text-center p-4">
            <p className="text-textLight text-xs sm:text-base mb-1 sm:mb-2">
              Total Players
            </p>
            <p className="text-2xl sm:text-4xl font-bold text-primary">
              {totalPlayers}
            </p>
          </div>
          <div className="card card-hover text-center p-4">
            <p className="text-textLight text-xs sm:text-base mb-1 sm:mb-2">
              Sold
            </p>
            <p className="text-2xl sm:text-4xl font-bold text-secondary">
              {soldCount}
            </p>
          </div>
          <div className="card card-hover text-center p-4">
            <p className="text-textLight text-xs sm:text-base mb-1 sm:mb-2">
              Unsold
            </p>
            <p className="text-2xl sm:text-4xl font-bold text-danger">
              {unsoldCount}
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="card mb-6 sm:mb-8 p-4 sm:p-6">
          <h2 className="text-xl sm:text-2xl font-bold text-primary mb-4 sm:mb-6">
            Filters
          </h2>

          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
            {/* Search */}
            <div>
              <label className="block font-semibold text-text mb-2">
                Search Player Name
              </label>
              <div className="relative">
                <IoSearch
                  className="absolute left-3 top-3 text-textLight"
                  size={20}
                />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="e.g., Virat Kohli"
                  className="w-full pl-10 pr-4 py-2 border border-border rounded-lg focus:outline-none focus:border-primary"
                />
              </div>
            </div>

            {/* Group Filter */}
            <div>
              <label className="block font-semibold text-text mb-2">
                Player Group
              </label>
              <select
                value={selectedGroup}
                onChange={(e) => setSelectedGroup(e.target.value)}
                className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:border-primary"
              >
                <option value="all">All Groups</option>
                {groupsList.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.group_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <label className="block font-semibold text-text mb-2">
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:border-primary"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="sold">Sold</option>
                <option value="unsold">Unsold</option>
              </select>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-border">
            <p className="text-textLight">
              Showing {filteredPlayers.length} of {totalPlayers} players
              {searchTerm && ` (search: "${searchTerm}")`}
              {selectedGroup !== "all" &&
                ` (group: ${groupsById.get(String(selectedGroup))?.group_name})`}
              {statusFilter !== "all" && ` (status: ${statusFilter})`}
            </p>
            <p className="text-xs text-textLight mt-1">
              Pending: {pendingCount} | Sold: {soldCount} | Unsold:{" "}
              {unsoldCount}
            </p>
          </div>
        </div>

        {/* Players Grid */}
        {filteredPlayers.length === 0 ? (
          <div className="card text-center py-12">
            <p className="text-xl text-textLight">No players found</p>
            <p className="text-textLight mt-2">Try adjusting your filters</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
            {filteredPlayers.map((player) => {
              const group = groupsById.get(String(player.group_id));
              const team = player.soldTo
                ? teamsById.get(String(player.soldTo))
                : null;

              return (
                <div
                  key={player.id}
                  className={`rounded-lg shadow-lg overflow-hidden transition-all duration-200 hover:-translate-y-1 hover:shadow-xl ${
                    player.soldTo
                      ? "bg-green-50 border-2 border-success"
                      : "bg-white border-2 border-border"
                  }`}
                >
                  {/* Player Photo with Gradient Overlay */}
                  <div className="relative w-full h-28 sm:h-40 bg-gray-200 overflow-hidden">
                    {player.photo_url ? (
                      <img
                        src={getImagePath("player-photo", player.photo_url)}
                        alt={player.player_name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.target.style.display = "none";
                        }}
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                        <span className="text-3xl font-bold text-primary/30">
                          {player.player_name?.charAt(0)}
                        </span>
                      </div>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                      <p className="text-white font-bold text-sm truncate">
                        {player.player_name}
                      </p>
                    </div>
                  </div>

                  {/* Player Info */}
                  <div className="p-3 sm:p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-textLight text-xs">
                        Age:{" "}
                        <span className="font-bold text-text">
                          {player.age}
                        </span>
                      </span>
                      <span className="inline-block bg-secondary text-primary px-2 py-0.5 rounded-full text-xs font-bold">
                        {group?.group_name || "N/A"}
                      </span>
                    </div>

                    {/* Price Info */}
                    <div className="border-t border-border pt-3">
                      <p className="text-xs text-textLight mb-1">Base Price</p>
                      <p className="text-lg font-bold text-text mb-3">
                        ₹{(group?.base_price || 0).toLocaleString()}
                      </p>

                      {player.soldTo ? (
                        <div className="bg-success text-white p-3 rounded-lg text-center">
                          <p className="text-xs opacity-90 mb-1">Sold to</p>
                          <p className="font-bold mb-1">
                            {team?.team_name || "Unknown"}
                          </p>
                          <p className="text-lg font-bold">
                            ₹{(player.soldPrice || 0).toLocaleString()}
                          </p>
                        </div>
                      ) : player.unsold ? (
                        <div className="bg-red-100 border border-red-400 text-red-700 p-3 rounded-lg text-center">
                          <p className="text-xs font-bold">Unsold</p>
                        </div>
                      ) : (
                        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 p-3 rounded-lg text-center">
                          <p className="text-xs font-bold">Pending</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default PlayerPool;
