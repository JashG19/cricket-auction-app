import { useMemo, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { useRealtimeData } from "../../hooks/useRealtimeData";
import {
  firebaseObjectToArray,
  createLookupMap,
  calculateSpentBudget,
  getImagePath,
} from "../../utils/dataTransformUtils";
import { ROUTES } from "../../constants/routes";
import { IoArrowBack } from "react-icons/io5";

export const TeamDetails = () => {
  const { auctionId } = useParams();

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

  // Sort teams by spending (memoized)
  const sortedTeams = useMemo(
    () =>
      [...teamsList].sort(
        (a, b) => calculateSpentBudget(b) - calculateSpentBudget(a),
      ),
    [teamsList],
  );

  // Build a map from playerId -> player for O(1) squad lookups
  const playersById = useMemo(
    () => createLookupMap(playersList),
    [playersList],
  );

  // Get squad for a team (uses map for O(1) lookups)
  const getTeamSquad = useCallback(
    (team) => {
      if (!team.squad) return [];
      return team.squad
        .map((pid) => playersById.get(String(pid)))
        .filter(Boolean)
        .sort((a, b) => (b.soldPrice || 0) - (a.soldPrice || 0));
    },
    [playersById],
  );

  if (auctionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-lightBg">
        <div className="text-center">
          <p className="text-xl text-textLight mb-4">Loading auction data...</p>
          <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-primary mx-auto"></div>
        </div>
      </div>
    );
  }

  if (!auctionData || auctionError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-lightBg">
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
            {auctionData?.name} - Team Details
          </h1>
          <p className="text-textLight text-sm">
            Detailed squad information for all teams
          </p>
        </div>

        {/* Teams Grid */}
        <div className="space-y-8">
          {sortedTeams.map((team, idx) => {
            const squad = getTeamSquad(team);
            const spent = calculateSpentBudget(team);
            const budgetTotal = Number(team.budget_total) || 0;
            const budgetRemaining = Number(team.budget_remaining) || 0;
            const spentPercent =
              budgetTotal > 0 ? Math.min(100, (spent / budgetTotal) * 100) : 0;

            return (
              <div key={team.id} className="card card-hover">
                {/* Team Header */}
                <div className="border-b border-border pb-4 sm:pb-6 mb-4 sm:mb-6">
                  <div className="flex justify-between items-start gap-4 mb-4">
                    <div className="flex items-start gap-4 min-w-0">
                      {team.team_logo && (
                        <img
                          src={getImagePath("team-logo", team.team_logo)}
                          alt={team.team_name}
                          className="w-16 h-16 sm:w-20 sm:h-20 object-contain rounded border border-border flex-shrink-0"
                          onError={(e) => {
                            e.target.style.display = "none";
                          }}
                        />
                      )}
                      <div className="min-w-0">
                        <h2 className="text-xl sm:text-3xl font-bold text-primary mb-1 sm:mb-2 truncate">
                          #{idx + 1} {team.team_name}
                        </h2>
                        <p className="text-sm sm:text-lg text-textLight">
                          Owner: {team.owner_name}
                        </p>
                      </div>
                    </div>
                    <span className="bg-primary text-white text-xl sm:text-3xl px-3 sm:px-4 py-1 sm:py-2 rounded-lg font-bold flex-shrink-0">
                      {squad.length}
                    </span>
                  </div>

                  {/* Budget Info */}
                  <div className="grid grid-cols-3 gap-3 sm:gap-4">
                    <div>
                      <p className="text-textLight text-xs sm:text-sm mb-1">
                        Total Budget
                      </p>
                      <p className="text-lg sm:text-2xl font-bold text-text">
                        ₹{budgetTotal.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-textLight text-xs sm:text-sm mb-1">
                        Spent
                      </p>
                      <p className="text-lg sm:text-2xl font-bold text-secondary">
                        ₹{spent.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-textLight text-xs sm:text-sm mb-1">
                        Remaining
                      </p>
                      <p
                        className={`text-lg sm:text-2xl font-bold ${budgetRemaining > 0 ? "text-success" : "text-danger"}`}
                      >
                        ₹{budgetRemaining.toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {/* Budget Progress Bar */}
                  <div className="mt-4">
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-textLight">Budget Utilization</span>
                      <span className="font-bold text-text">
                        {spentPercent.toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div
                        className="bg-gradient-to-r from-secondary to-accent h-3 rounded-full transition-all"
                        style={{ width: `${spentPercent}%` }}
                      ></div>
                    </div>
                  </div>
                </div>

                {/* Squad Table */}
                {squad.length === 0 ? (
                  <p className="text-textLight text-center py-8">
                    No players yet
                  </p>
                ) : (
                  <div className="overflow-x-auto -mx-4 sm:-mx-6 px-4 sm:px-6 pb-2">
                    <table className="w-full min-w-[600px] table-improved">
                      <thead>
                        <tr className="border-b-2 border-border">
                          <th className="text-left py-4 px-4 font-bold text-primary whitespace-nowrap">
                            #
                          </th>
                          <th className="text-left py-4 px-4 font-bold text-primary whitespace-nowrap">
                            Player Name
                          </th>
                          <th className="text-left py-4 px-4 font-bold text-primary whitespace-nowrap">
                            Age
                          </th>
                          <th className="text-left py-4 px-4 font-bold text-primary whitespace-nowrap">
                            Group
                          </th>
                          <th className="text-right py-4 px-4 font-bold text-primary whitespace-nowrap">
                            Sold Price
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {squad.map((player, idx) => {
                          const group = groupsById.get(String(player.group_id));
                          const playerPhoto = getImagePath(
                            "player-photo",
                            player.photo_url,
                            player.player_name,
                          );
                          return (
                            <tr
                              key={player.id}
                              className="border-b border-border hover:bg-gray-50 transition"
                            >
                              <td className="py-4 px-4 text-textLight">
                                {idx + 1}
                              </td>
                              <td className="py-4 px-4">
                                <div className="flex items-center gap-3">
                                  {playerPhoto && (
                                    <img
                                      src={playerPhoto}
                                      alt={player.player_name}
                                      className="w-8 h-8 rounded-full object-cover"
                                      onError={(e) => {
                                        e.target.style.display = "none";
                                      }}
                                    />
                                  )}
                                  <span className="font-bold text-text">
                                    {player.player_name}
                                  </span>
                                </div>
                              </td>
                              <td className="py-4 px-4 text-text">
                                {player.age}
                              </td>
                              <td className="py-4 px-4">
                                <span className="bg-secondary text-primary px-3 py-1 rounded-full text-xs font-bold">
                                  {group?.group_name || "N/A"}
                                </span>
                              </td>
                              <td className="py-4 px-4 text-right font-bold text-secondary">
                                ₹{(player.soldPrice || 0).toLocaleString()}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Squad Stats */}
                {squad.length > 0 && (
                  <div className="mt-4 sm:mt-6 pt-4 sm:pt-6 border-t border-border">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                      <div className="text-center">
                        <p className="text-textLight text-xs sm:text-sm mb-1">
                          Total Players
                        </p>
                        <p className="text-xl sm:text-2xl font-bold text-primary">
                          {squad.length}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-textLight text-xs sm:text-sm mb-1">
                          Average Price
                        </p>
                        <p className="text-xl sm:text-2xl font-bold text-accent">
                          ₹
                          {(
                            squad.reduce(
                              (sum, p) => sum + (p.soldPrice || 0),
                              0,
                            ) / squad.length
                          ).toLocaleString()}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-textLight text-xs sm:text-sm mb-1">
                          Total Spent on Squad
                        </p>
                        <p className="text-xl sm:text-2xl font-bold text-secondary">
                          ₹
                          {squad
                            .reduce((sum, p) => sum + (p.soldPrice || 0), 0)
                            .toLocaleString()}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-textLight text-xs sm:text-sm mb-1">
                          Most Expensive
                        </p>
                        <p className="text-xs font-bold text-text">
                          {(() => {
                            const mostExpensive = squad.reduce(
                              (max, player) =>
                                (player.soldPrice || 0) > (max?.soldPrice || 0)
                                  ? player
                                  : max,
                              null,
                            );
                            return mostExpensive
                              ? `${mostExpensive.player_name} (₹${(mostExpensive.soldPrice || 0).toLocaleString()})`
                              : "N/A";
                          })()}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default TeamDetails;
