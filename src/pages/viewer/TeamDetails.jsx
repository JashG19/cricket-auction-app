import { useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { useRealtimeData } from "../../hooks/useRealtimeData";
import { firebaseObjectToArray, createLookupMap, calculateSpentBudget } from "../../utils/dataTransformUtils";
import { ROUTES } from "../../constants/routes";
import { IoArrowBack } from "react-icons/io5";

export const TeamDetails = () => {
  const { auctionId } = useParams();

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

  // Sort teams by spending
  const sortedTeams = [...teamsList].sort(
    (a, b) => calculateSpentBudget(b) - calculateSpentBudget(a),
  );

  // Get squad for each team
  const getTeamSquad = (team) => {
    return playersList
      .filter((p) =>
        team.squad?.some((playerId) => String(playerId) === String(p.id)),
      )
      .sort((a, b) => (b.soldPrice || 0) - (a.soldPrice || 0));
  };

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
            {auctionData?.name} - Team Details
          </h1>
          <p className="text-textLight">
            Detailed squad information for all teams
          </p>
        </div>

        {/* Teams Grid */}
        <div className="space-y-8">
          {sortedTeams.map((team, idx) => {
            const squad = getTeamSquad(team);
            const spent = calculateSpentBudget(team);
            const spentPercent = (spent / team.budget_total) * 100;

            return (
              <div key={team.id} className="card">
                {/* Team Header */}
                <div className="border-b border-border pb-6 mb-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h2 className="text-3xl font-bold text-primary mb-2">
                        #{idx + 1} {team.team_name}
                      </h2>
                      <p className="text-lg text-textLight">
                        Owner: {team.owner_name}
                      </p>
                    </div>
                    <span className="bg-primary text-white text-3xl px-4 py-2 rounded-lg font-bold">
                      {squad.length}
                    </span>
                  </div>

                  {/* Budget Info */}
                  <div className="grid md:grid-cols-3 gap-4">
                    <div>
                      <p className="text-textLight text-sm mb-1">
                        Total Budget
                      </p>
                      <p className="text-2xl font-bold text-text">
                        ₹{team.budget_total.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-textLight text-sm mb-1">Spent</p>
                      <p className="text-2xl font-bold text-secondary">
                        ₹{spent.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-textLight text-sm mb-1">Remaining</p>
                      <p
                        className={`text-2xl font-bold ${team.budget_remaining > 0 ? "text-success" : "text-danger"}`}
                      >
                        ₹{team.budget_remaining.toLocaleString()}
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
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b-2 border-border">
                          <th className="text-left py-4 px-4 font-bold text-primary">
                            #
                          </th>
                          <th className="text-left py-4 px-4 font-bold text-primary">
                            Player Name
                          </th>
                          <th className="text-left py-4 px-4 font-bold text-primary">
                            Age
                          </th>
                          <th className="text-left py-4 px-4 font-bold text-primary">
                            Group
                          </th>
                          <th className="text-right py-4 px-4 font-bold text-primary">
                            Sold Price
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {squad.map((player, idx) => {
                          const group = groupsById.get(String(player.group_id));
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
                                  {player.photo_url && (
                                    <img
                                      src={player.photo_url}
                                      alt={player.player_name}
                                      className="w-8 h-8 rounded-full object-cover"
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
                  <div className="mt-6 pt-6 border-t border-border">
                    <div className="grid md:grid-cols-4 gap-4">
                      <div className="text-center">
                        <p className="text-textLight text-sm mb-1">
                          Total Players
                        </p>
                        <p className="text-2xl font-bold text-primary">
                          {squad.length}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-textLight text-sm mb-1">
                          Average Price
                        </p>
                        <p className="text-2xl font-bold text-accent">
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
                        <p className="text-textLight text-sm mb-1">
                          Total Spent on Squad
                        </p>
                        <p className="text-2xl font-bold text-secondary">
                          ₹
                          {squad
                            .reduce((sum, p) => sum + (p.soldPrice || 0), 0)
                            .toLocaleString()}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-textLight text-sm mb-1">
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
