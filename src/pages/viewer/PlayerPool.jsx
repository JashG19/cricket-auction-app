import { useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { useRealtimeData } from "../../hooks/useRealtimeData";
import { firebaseObjectToArray, createLookupMap, findPlayerTeam } from "../../utils/dataTransformUtils";
import { ROUTES } from "../../constants/routes";
import { IoArrowBack, IoSearch } from "react-icons/io5";

export const PlayerPool = () => {
  const { auctionId } = useParams();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedGroup, setSelectedGroup] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

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

  // Filter players
  const filteredPlayers = useMemo(() => {
    return playersList.filter((player) => {
      // Search filter
      if (
        searchTerm &&
        !player.player_name.toLowerCase().includes(searchTerm.toLowerCase())
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
      if (statusFilter === "sold" && !player.soldPrice) return false;
      if (statusFilter === "unsold" && player.soldPrice) return false;

      return true;
    });
  }, [playersList, searchTerm, selectedGroup, statusFilter]);

  // Stats
  const totalPlayers = playersList.length;
  const soldCount = playersList.filter((p) => p.soldPrice).length;
  const unsoldCount = totalPlayers - soldCount;

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
            to={ROUTES.AUCTION_DASHBOARD(auctionId)}
            className="inline-flex items-center gap-2 text-primary hover:text-accent mb-4"
          >
            <IoArrowBack size={20} /> Back to Dashboard
          </Link>
          <h1 className="text-4xl font-bold text-primary mb-2">
            {auctionData?.name} - Player Pool
          </h1>
          <p className="text-textLight">
            Browse and filter all {totalPlayers} players
          </p>
        </div>

        {/* Stats */}
        <div className="grid md:grid-cols-3 gap-4 mb-8">
          <div className="card text-center">
            <p className="text-textLight mb-2">Total Players</p>
            <p className="text-4xl font-bold text-primary">{totalPlayers}</p>
          </div>
          <div className="card text-center">
            <p className="text-textLight mb-2">Sold</p>
            <p className="text-4xl font-bold text-secondary">{soldCount}</p>
          </div>
          <div className="card text-center">
            <p className="text-textLight mb-2">Unsold</p>
            <p className="text-4xl font-bold text-danger">{unsoldCount}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="card mb-8">
          <h2 className="text-2xl font-bold text-primary mb-6">Filters</h2>

          <div className="grid md:grid-cols-3 gap-6">
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
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPlayers.map((player) => {
              const group = groupsById.get(String(player.group_id));
              const team = findPlayerTeam(player.id, teamsList);

              return (
                <div
                  key={player.id}
                  className={`rounded-lg shadow-lg overflow-hidden transition hover:shadow-xl ${
                    player.soldPrice
                      ? "bg-green-50 border-2 border-success"
                      : "bg-white border-2 border-border"
                  }`}
                >
                  {/* Player Photo */}
                  <div className="w-full h-40 bg-gray-300 flex items-center justify-center text-gray-500 overflow-hidden">
                    {player.photo_url ? (
                      <img
                        src={player.photo_url}
                        alt={player.player_name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-gray-400">No Photo</span>
                    )}
                  </div>

                  {/* Player Info */}
                  <div className="p-4">
                    <h3 className="text-lg font-bold text-primary mb-2">
                      {player.player_name}
                    </h3>

                    <div className="space-y-2 mb-4 text-sm">
                      <div className="flex justify-between">
                        <span className="text-textLight">Age:</span>
                        <span className="font-bold text-text">
                          {player.age}
                        </span>
                      </div>
                    </div>

                    {/* Group Badge */}
                    <div className="mb-4">
                      <span className="inline-block bg-secondary text-primary px-3 py-1 rounded-full text-xs font-bold">
                        {group?.group_name || "N/A"}
                      </span>
                    </div>

                    {/* Price Info */}
                    <div className="border-t border-border pt-3">
                      <p className="text-xs text-textLight mb-1">Base Price</p>
                      <p className="text-lg font-bold text-text mb-3">
                        ₹{(group?.base_price || 0).toLocaleString()}
                      </p>

                      {player.soldPrice ? (
                        <div className="bg-success text-white p-3 rounded-lg text-center">
                          <p className="text-xs opacity-90 mb-1">Sold to</p>
                          <p className="font-bold mb-1">
                            {team?.team_name || "Unknown"}
                          </p>
                          <p className="text-lg font-bold">
                            ₹{player.soldPrice.toLocaleString()}
                          </p>
                        </div>
                      ) : (
                        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 p-3 rounded-lg text-center">
                          <p className="text-xs font-bold">Currently Unsold</p>
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
