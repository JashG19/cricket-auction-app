import { useState, useEffect, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { useRealtimeData } from "../../hooks/useRealtimeData";
import {
  firebaseObjectToArray,
  createLookupMap,
  calculateSpentBudget,
  getImagePath,
} from "../../utils/dataTransformUtils";
import { ROUTES } from "../../constants/routes";
import { IoArrowBack, IoLockClosed, IoWarning, IoCheckmarkCircle, IoAlertCircle } from "react-icons/io5";
import {
  generateTeamInsights,
  formatCurrency,
  getRiskColorClass,
} from "../../utils/strategyInsights";

export const TeamOwnerView = () => {
  const { auctionId, teamId } = useParams();
  const [pinInput, setPinInput] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [pinError, setPinError] = useState("");

  // Check localStorage for saved auth
  useEffect(() => {
    const stored = localStorage.getItem(`team_pin_${auctionId}_${teamId}`);
    if (stored === "true") {
      setAuthenticated(true);
    }
  }, [auctionId, teamId]);

  // Data subscriptions
  const { data: teamData, loading: teamLoading } = useRealtimeData(
    `auctions/${auctionId}/teams/${teamId}`,
  );
  const { data: playersData } = useRealtimeData(
    `auctions/${auctionId}/players`,
  );
  const { data: groupsData } = useRealtimeData(`auctions/${auctionId}/groups`);
  const { data: liveState } = useRealtimeData(
    `auctions/${auctionId}/live_state`,
  );
  const { data: auctionData } = useRealtimeData(`auctions/${auctionId}`);

  const playersList = useMemo(
    () => firebaseObjectToArray(playersData),
    [playersData],
  );
  const groupsList = useMemo(
    () => firebaseObjectToArray(groupsData),
    [groupsData],
  );
  const playersById = useMemo(
    () => createLookupMap(playersList),
    [playersList],
  );
  const groupsById = useMemo(() => createLookupMap(groupsList), [groupsList]);

  // Resolve current live player
  const currentLivePlayer = liveState?.currentPlayerId
    ? playersById.get(String(liveState.currentPlayerId))
    : null;
  const currentLiveGroup = currentLivePlayer
    ? groupsById.get(String(currentLivePlayer.group_id))
    : null;

  // Get squad details
  const squad = useMemo(() => {
    if (!teamData?.squad) return [];
    return (teamData.squad || [])
      .map((pid) => playersById.get(String(pid)))
      .filter(Boolean)
      .sort((a, b) => (Number(b.soldPrice) || 0) - (Number(a.soldPrice) || 0));
  }, [teamData?.squad, playersById]);

  // Squad stats
  const squadStats = useMemo(() => {
    if (squad.length === 0)
      return { total: 0, avgPrice: 0, totalSpent: 0, mostExpensive: null };
    const totalSpent = squad.reduce(
      (sum, p) => sum + (Number(p.soldPrice) || 0),
      0,
    );
    const sorted = [...squad].sort(
      (a, b) => (Number(b.soldPrice) || 0) - (Number(a.soldPrice) || 0),
    );
    return {
      total: squad.length,
      avgPrice: Math.round(totalSpent / squad.length),
      totalSpent,
      mostExpensive: sorted[0],
    };
  }, [squad]);

  // Strategy insights for this team
  const teamInsights = useMemo(() => {
    if (!teamData || !groupsList.length || !playersList.length) return null;
    
    // Build team object with required fields
    const team = {
      id: teamId,
      team_name: teamData.team_name,
      budget_remaining: Number(teamData.budget_remaining) || 0,
      squad: teamData.squad || [],
    };
    
    // Pass full playersList (not squad) as 2nd argument
    return generateTeamInsights(
      team, 
      playersList,  // ALL players, not just squad
      groupsList, 
      currentLivePlayer,  // currentPlayer
      currentLiveGroup,   // currentGroup (object with group_name)
      liveState?.currentBid || 0  // currentBid
    );
  }, [teamData, teamId, playersList, groupsList, currentLivePlayer, currentLiveGroup, liveState?.currentBid]);

  const spent = teamData ? calculateSpentBudget(teamData) : 0;
  const budgetTotal = Number(teamData?.budget_total) || 0;
  const budgetRemaining = Number(teamData?.budget_remaining) || 0;
  const spentPercent = budgetTotal > 0 ? (spent / budgetTotal) * 100 : 0;

  // PIN validation
  const handlePinSubmit = (e) => {
    e.preventDefault();
    if (!teamData) return;

    if (String(pinInput) === String(teamData.pin)) {
      setAuthenticated(true);
      setPinError("");
      localStorage.setItem(`team_pin_${auctionId}_${teamId}`, "true");
    } else {
      setPinError("Incorrect PIN. Please try again.");
    }
  };

  // Loading state
  if (teamLoading || !teamData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-lightBg">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-primary mx-auto"></div>
          <p className="text-textLight mt-4">Loading team data...</p>
        </div>
      </div>
    );
  }

  // PIN entry screen
  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary to-darkBg p-4">
        <div className="bg-white rounded-lg shadow-2xl p-6 sm:p-8 max-w-sm w-full text-center">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <IoLockClosed size={32} className="text-primary" />
          </div>
          <h2 className="text-xl font-bold text-primary mb-1">
            {teamData.team_name}
          </h2>
          <p className="text-sm text-textLight mb-6">
            Enter your team PIN to access the dashboard
          </p>

          <form onSubmit={handlePinSubmit}>
            <input
              type="password"
              value={pinInput}
              onChange={(e) => {
                setPinInput(e.target.value);
                setPinError("");
              }}
              placeholder="Enter PIN"
              maxLength={6}
              className="w-full px-4 py-3 border-2 border-border rounded-lg text-center text-2xl tracking-widest font-bold focus:outline-none focus:border-primary mb-3"
              autoFocus
            />
            {pinError && <p className="text-danger text-sm mb-3">{pinError}</p>}
            <button type="submit" className="w-full btn btn-primary btn-lg">
              Access Dashboard
            </button>
          </form>

          <Link
            to={ROUTES.AUCTION_DASHBOARD(auctionId)}
            className="inline-flex items-center gap-1 text-sm text-textLight hover:text-primary mt-4"
          >
            <IoArrowBack size={14} /> Back to Auction
          </Link>
        </div>
      </div>
    );
  }

  // Authenticated team dashboard
  return (
    <div className="min-h-screen bg-lightBg p-3 sm:p-6">
      <div className="max-w-4xl mx-auto page-enter">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-6">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-4xl font-bold text-primary truncate">
              {teamData.team_name}
            </h1>
            <p className="text-textLight text-sm">
              Owner: {teamData.owner_name} | {auctionData?.name}
            </p>
          </div>
          <Link
            to={ROUTES.AUCTION_DASHBOARD(auctionId)}
            className="btn btn-sm btn-secondary flex items-center gap-1 self-start sm:self-auto"
          >
            <IoArrowBack size={16} /> Auction
          </Link>
        </div>

        {/* Budget Card */}
        <div className="card mb-6 bg-gradient-to-r from-primary to-accent p-4 sm:p-6">
          <div className="grid grid-cols-3 gap-4 text-center mb-4">
            <div>
              <p className="text-white/80 text-xs sm:text-sm">Total Budget</p>
              <p className="text-lg sm:text-2xl font-bold text-white">
                ₹{budgetTotal.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-white/80 text-xs sm:text-sm">Spent</p>
              <p className="text-lg sm:text-2xl font-bold text-secondary">
                ₹{spent.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-white/80 text-xs sm:text-sm">Remaining</p>
              <p className="text-lg sm:text-2xl font-bold text-green-300">
                ₹{budgetRemaining.toLocaleString()}
              </p>
            </div>
          </div>
          <div className="w-full bg-white/20 rounded-full h-3">
            <div
              className="bg-secondary h-3 rounded-full transition-all"
              style={{ width: `${Math.min(100, spentPercent)}%` }}
            ></div>
          </div>
          <p className="text-white/60 text-xs text-right mt-1">
            {spentPercent.toFixed(1)}% used
          </p>
        </div>

        {/* Live Auction Status */}
        {liveState && !liveState.isComplete && currentLivePlayer && (
          <div className="card mb-6 border-2 border-secondary">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-3 h-3 bg-success rounded-full animate-pulse"></div>
              <h2 className="text-lg font-bold text-primary">Live Auction</h2>
              {liveState.isPaused && (
                <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full font-bold">
                  PAUSED
                </span>
              )}
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <p className="font-bold text-text text-lg">
                  {currentLivePlayer.player_name}
                </p>
                <p className="text-sm text-textLight">
                  Age: {currentLivePlayer.age} |{" "}
                  {currentLiveGroup?.group_name || "Unknown Group"}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-textLight">Current Bid</p>
                <p className="text-2xl sm:text-3xl font-bold text-secondary animate-pulse-bid">
                  ₹{(liveState.currentBid || 0).toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        )}

        {liveState?.isComplete && (
          <div className="card mb-6 bg-green-50 border-2 border-success text-center p-4">
            <p className="text-lg font-bold text-success">Auction Complete!</p>
          </div>
        )}

        {/* Strategy Insights Section */}
        {teamInsights && !liveState?.isComplete && (
          <div className="card mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-primary">Strategy Insights</h2>
              <span className={`px-3 py-1 rounded-full text-sm font-bold ${getRiskColorClass(teamInsights.budgetAnalysis.riskLevel)}`}>
                {teamInsights.budgetAnalysis.riskLevel?.level || 'UNKNOWN'} Risk
              </span>
            </div>

            {/* Budget Analysis */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-textLight mb-1">Mandatory Reserve</p>
                <p className="text-lg font-bold text-primary">{formatCurrency(teamInsights.budgetAnalysis.mandatoryReserve)}</p>
                <p className="text-xs text-textLight">Min needed for requirements</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-textLight mb-1">Flexible Budget</p>
                <p className={`text-lg font-bold ${teamInsights.budgetAnalysis.flexibleBudget >= 0 ? 'text-success' : 'text-danger'}`}>
                  {formatCurrency(teamInsights.budgetAnalysis.flexibleBudget)}
                </p>
                <p className="text-xs text-textLight">Available for bidding</p>
              </div>
            </div>

            {/* Group Requirements */}
            {teamInsights.groupOpportunities && teamInsights.groupOpportunities.length > 0 && (
              <div className="mb-4">
                <p className="text-sm font-semibold text-text mb-2">Group Requirements</p>
                <div className="flex flex-wrap gap-2">
                  {teamInsights.groupOpportunities.map((opp) => (
                    <div 
                      key={opp.group}
                      className={`text-xs px-3 py-2 rounded-lg border ${
                        opp.stillNeed > 0 
                          ? 'bg-orange-50 border-orange-200 text-orange-800' 
                          : opp.canBuyMore > 0
                            ? 'bg-blue-50 border-blue-200 text-blue-800'
                            : 'bg-green-50 border-green-200 text-green-800'
                      }`}
                    >
                      <span className="font-bold">{opp.group}</span>
                      {opp.stillNeed > 0 ? (
                        <span className="ml-1">Need {opp.stillNeed} more</span>
                      ) : opp.canBuyMore > 0 ? (
                        <span className="ml-1">Can buy {opp.canBuyMore} more</span>
                      ) : (
                        <span className="ml-1 flex items-center gap-1"><IoCheckmarkCircle size={12} /> Complete</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Warnings */}
            {teamInsights.warnings && teamInsights.warnings.length > 0 && (
              <div className="space-y-2">
                {teamInsights.warnings.map((warning, idx) => (
                  <div 
                    key={idx}
                    className={`flex items-start gap-2 p-3 rounded-lg text-sm ${
                      warning.severity === 'critical' ? 'bg-red-50 text-red-800 border border-red-200' :
                      warning.severity === 'high' ? 'bg-orange-50 text-orange-800 border border-orange-200' :
                      'bg-yellow-50 text-yellow-800 border border-yellow-200'
                    }`}
                  >
                    {warning.severity === 'critical' ? (
                      <IoAlertCircle size={18} className="text-red-600 flex-shrink-0 mt-0.5" />
                    ) : (
                      <IoWarning size={18} className={`flex-shrink-0 mt-0.5 ${
                        warning.severity === 'high' ? 'text-orange-600' : 'text-yellow-600'
                      }`} />
                    )}
                    <span>{warning.message}</span>
                  </div>
                ))}
              </div>
            )}

            {/* No warnings - show success */}
            {(!teamInsights.warnings || teamInsights.warnings.length === 0) && teamInsights.budgetAnalysis.riskLevel?.level === 'SAFE' && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 text-green-800 border border-green-200 text-sm">
                <IoCheckmarkCircle size={18} className="text-green-600" />
                <span>Budget is healthy. You can bid comfortably on upcoming players.</span>
              </div>
            )}
          </div>
        )}

        {/* Squad Table */}
        <div className="card mb-6">
          <h2 className="text-xl sm:text-2xl font-bold text-primary mb-4">
            Your Squad ({squad.length}
            {auctionData?.max_players_per_team
              ? `/${auctionData.max_players_per_team}`
              : ""}
            )
          </h2>

          {squad.length === 0 ? (
            <p className="text-textLight py-4">No players acquired yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full table-improved">
                <thead>
                  <tr className="border-b-2 border-border">
                    <th className="text-left py-3 px-3 font-bold text-primary text-sm">
                      #
                    </th>
                    <th className="text-left py-3 px-3 font-bold text-primary text-sm">
                      Player
                    </th>
                    <th className="text-left py-3 px-3 font-bold text-primary text-sm">
                      Age
                    </th>
                    <th className="text-left py-3 px-3 font-bold text-primary text-sm">
                      Group
                    </th>
                    <th className="text-right py-3 px-3 font-bold text-primary text-sm">
                      Price
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {squad.map((player, idx) => {
                    const group = groupsById.get(String(player.group_id));
                    return (
                      <tr
                        key={player.id}
                        className="border-b border-border hover:bg-gray-50"
                      >
                        <td className="py-3 px-3 text-textLight text-sm">
                          {idx + 1}
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2">
                            {player.photo_url ? (
                              <img
                                src={getImagePath(
                                  "player-photo",
                                  player.photo_url,
                                )}
                                alt={player.player_name}
                                className="w-8 h-8 rounded-full object-cover"
                                onError={(e) => {
                                  e.target.style.display = "none";
                                }}
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs text-textLight">
                                {player.player_name?.charAt(0)}
                              </div>
                            )}
                            <span className="font-semibold text-text text-sm">
                              {player.player_name}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-text text-sm">
                          {player.age}
                        </td>
                        <td className="py-3 px-3">
                          <span className="text-xs bg-secondary text-primary px-2 py-1 rounded font-bold">
                            {group?.group_name || "N/A"}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-success text-sm">
                          ₹{(player.soldPrice || 0).toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Squad Stats */}
        {squad.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            <div className="card card-hover text-center p-4">
              <p className="text-textLight text-xs sm:text-sm mb-1">
                Total Players
              </p>
              <p className="text-xl sm:text-2xl font-bold text-primary">
                {squadStats.total}
              </p>
            </div>
            <div className="card card-hover text-center p-4">
              <p className="text-textLight text-xs sm:text-sm mb-1">
                Avg Price
              </p>
              <p className="text-xl sm:text-2xl font-bold text-primary">
                ₹{squadStats.avgPrice.toLocaleString()}
              </p>
            </div>
            <div className="card card-hover text-center p-4">
              <p className="text-textLight text-xs sm:text-sm mb-1">
                Total Spent
              </p>
              <p className="text-xl sm:text-2xl font-bold text-secondary">
                ₹{squadStats.totalSpent.toLocaleString()}
              </p>
            </div>
            <div className="card card-hover text-center p-4">
              <p className="text-textLight text-xs sm:text-sm mb-1">
                Most Expensive
              </p>
              <p className="text-sm sm:text-base font-bold text-primary truncate">
                {squadStats.mostExpensive?.player_name || "-"}
              </p>
              {squadStats.mostExpensive && (
                <p className="text-xs text-success font-bold">
                  ₹{(squadStats.mostExpensive.soldPrice || 0).toLocaleString()}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TeamOwnerView;
