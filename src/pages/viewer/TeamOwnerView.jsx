import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { useRealtimeData } from "../../hooks/useRealtimeData";
import { useAuctionConfig } from "../../hooks/useAuctionConfig";
import {
  firebaseObjectToArray,
  createLookupMap,
  calculateSpentBudget,
  getImagePath,
} from "../../utils/dataTransformUtils";
import { ROUTES } from "../../constants/routes";
import {
  IoArrowBack,
  IoLockClosed,
  IoWarning,
  IoCheckmarkCircle,
  IoAlertCircle,
  IoHeart,
  IoHeartOutline,
  IoSearch,
  IoPeople,
  IoStatsChart,
  IoList,
} from "react-icons/io5";
import {
  generateTeamInsights,
  formatCurrency,
  getRiskColorClass,
} from "../../utils/strategyInsights";
import { LiveBidAmount } from "../../components/LiveBidAmount";

// Tab definitions
const TABS = [
  { key: "myPlayers", label: "My Squad", icon: IoPeople },
  { key: "strategy", label: "Strategy", icon: IoStatsChart },
  { key: "wishlist", label: "Wishlist", icon: IoHeart },
  { key: "allPlayers", label: "All Players", icon: IoList },
];

export const TeamOwnerView = () => {
  const { auctionId, teamId } = useParams();
  const [pinInput, setPinInput] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [pinError, setPinError] = useState("");
  const [wishlistIds, setWishlistIds] = useState([]);
  const [activeTab, setActiveTab] = useState("myPlayers");

  // All Players tab state
  const [allPlayersSearch, setAllPlayersSearch] = useState("");
  const [allPlayersStatus, setAllPlayersStatus] = useState("all");
  const [allPlayersGroup, setAllPlayersGroup] = useState("all");
  const [allPlayersQuickFilter, setAllPlayersQuickFilter] = useState("all");

  // Wishlist filter state
  const [wishlistFilter, setWishlistFilter] = useState("all");
  const [wishlistGroupFilter, setWishlistGroupFilter] = useState("all");

  // Sale notification popup state
  const [saleNotification, setSaleNotification] = useState(null);
  const prevSoldIdsRef = useRef(new Set());
  const saleTimerRef = useRef(null);

  const wishlistStorageKey = useMemo(
    () => `wishlist_${auctionId}_${teamId}`,
    [auctionId, teamId],
  );

  // Check localStorage for saved auth
  useEffect(() => {
    const stored = localStorage.getItem(`team_pin_${auctionId}_${teamId}`);
    if (stored === "true") {
      setAuthenticated(true);
    }
  }, [auctionId, teamId]);

  useEffect(() => {
    if (!authenticated) return;
    const storedWishlist = localStorage.getItem(wishlistStorageKey);
    if (!storedWishlist) {
      setWishlistIds([]);
      return;
    }
    try {
      const parsed = JSON.parse(storedWishlist);
      setWishlistIds(Array.isArray(parsed) ? parsed : []);
    } catch {
      setWishlistIds([]);
    }
  }, [authenticated, wishlistStorageKey]);

  // Data subscriptions
  const { data: teamData, loading: teamLoading } = useRealtimeData(
    `auctions/${auctionId}/teams/${teamId}`,
  );
  const { data: playersData } = useRealtimeData(
    `auctions/${auctionId}/players`,
  );
  const { data: teamsData } = useRealtimeData(
    `auctions/${auctionId}/teams`,
  );
  const { data: groupsData } = useRealtimeData(`auctions/${auctionId}/groups`);
  const { data: liveCurrentPlayerId } = useRealtimeData(
    `auctions/${auctionId}/live_state/currentPlayerId`,
  );
  const { data: liveIsPaused } = useRealtimeData(
    `auctions/${auctionId}/live_state/isPaused`,
  );
  const { data: liveIsComplete } = useRealtimeData(
    `auctions/${auctionId}/live_state/isComplete`,
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

  // Load dynamic auction config
  const { groupRules, totalPlayersPerTeam } = useAuctionConfig(
    auctionId,
    groupsList,
  );

  const playersById = useMemo(
    () => createLookupMap(playersList),
    [playersList],
  );
  const groupsById = useMemo(() => createLookupMap(groupsList), [groupsList]);
  const teamsById = useMemo(() => createLookupMap(teamsList), [teamsList]);

  // --- Sale notification detection ---
  const dismissSaleNotification = useCallback(() => {
    setSaleNotification(null);
    if (saleTimerRef.current) {
      clearTimeout(saleTimerRef.current);
      saleTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!authenticated || !playersList.length || !teamsList.length) return;

    const currentSoldIds = new Set(
      playersList.filter((p) => p.soldTo).map((p) => String(p.id)),
    );

    // On first load, just seed the ref without showing notifications
    if (prevSoldIdsRef.current.size === 0 && currentSoldIds.size > 0) {
      prevSoldIdsRef.current = currentSoldIds;
      return;
    }

    // Find newly sold players
    for (const id of currentSoldIds) {
      if (!prevSoldIdsRef.current.has(id)) {
        const player = playersList.find((p) => String(p.id) === id);
        if (player) {
          const soldTeam = teamsById.get(String(player.soldTo));
          const group = groupsById.get(String(player.group_id));
          const isMine = String(player.soldTo) === String(teamId);

          setSaleNotification({
            playerName: player.player_name,
            groupName: group?.group_name || "Unknown",
            price: player.soldPrice || 0,
            teamName: soldTeam?.team_name || "Unknown Team",
            isMine,
            age: player.age,
          });

          // Auto-dismiss after 6 seconds
          if (saleTimerRef.current) clearTimeout(saleTimerRef.current);
          saleTimerRef.current = setTimeout(() => {
            setSaleNotification(null);
            saleTimerRef.current = null;
          }, 6000);
          break; // Only show one at a time
        }
      }
    }

    prevSoldIdsRef.current = currentSoldIds;
  }, [authenticated, playersList, teamsList, teamsById, groupsById, teamId]);

  // Resolve current live player
  const currentLivePlayer =
    liveCurrentPlayerId !== null && liveCurrentPlayerId !== undefined
      ? playersById.get(String(liveCurrentPlayerId))
      : null;
  const currentLiveGroup = currentLivePlayer
    ? groupsById.get(String(currentLivePlayer.group_id))
    : null;
  const currentLiveGroupId = currentLiveGroup?.id ?? null;
  const isAuctionPaused = liveIsPaused ?? false;
  const isAuctionComplete = liveIsComplete ?? false;
  const settledBidForStrategy =
    currentLivePlayer?.soldTo && currentLivePlayer?.soldPrice
      ? Number(currentLivePlayer.soldPrice) || 0
      : 0;

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
      playersList, // ALL players, not just squad
      groupsList,
      currentLivePlayer, // currentPlayer
      currentLiveGroup, // currentGroup (object with group_name)
      settledBidForStrategy, // Recompute on settled sale state, not each live increment
      [], // teamsList (empty - not needed for single team view)
      groupRules,
      totalPlayersPerTeam,
    );
  }, [
    teamData,
    teamId,
    playersList,
    groupsList,
    currentLivePlayer,
    currentLiveGroup,
    settledBidForStrategy,
    groupRules,
    totalPlayersPerTeam,
  ]);

  const spent = teamData ? calculateSpentBudget(teamData) : 0;
  const budgetTotal = Number(teamData?.budget_total) || 0;
  const budgetRemaining = Number(teamData?.budget_remaining) || 0;
  const spentPercent = budgetTotal > 0 ? (spent / budgetTotal) * 100 : 0;
  const wishlistSet = useMemo(
    () => new Set(wishlistIds.map((id) => String(id))),
    [wishlistIds],
  );
  const wishlistPlayers = useMemo(
    () => playersList.filter((p) => wishlistSet.has(String(p.id))),
    [playersList, wishlistSet],
  );
  const getPlayerStatus = (player) => {
    if (player?.soldTo) return "sold";
    if (player?.unsold) return "unsold";
    return "pending";
  };

  // Wishlist filtered candidates
  const wishlistCandidates = useMemo(() => playersList, [playersList]);
  const filteredWishlistCandidates = useMemo(() => {
    return wishlistCandidates.filter((player) => {
      if (wishlistFilter !== "all" && getPlayerStatus(player) !== wishlistFilter)
        return false;
      if (
        wishlistGroupFilter !== "all" &&
        String(player.group_id) !== String(wishlistGroupFilter)
      )
        return false;
      return true;
    });
  }, [wishlistCandidates, wishlistFilter, wishlistGroupFilter]);

  // All Players tab filtered list
  const filteredAllPlayers = useMemo(() => {
    let list = playersList;

    // Quick filters for mobile-first fast switching
    if (allPlayersQuickFilter === "myTargets") {
      list = list.filter(
        (p) => wishlistSet.has(String(p.id)) && !p.soldTo,
      );
    } else if (
      allPlayersQuickFilter === "currentGroup" &&
      currentLiveGroupId !== null &&
      currentLiveGroupId !== undefined
    ) {
      list = list.filter(
        (p) => String(p.group_id) === String(currentLiveGroupId),
      );
    }

    // Status filter
    if (allPlayersStatus !== "all") {
      list = list.filter((p) => getPlayerStatus(p) === allPlayersStatus);
    }

    // Group filter
    if (allPlayersGroup !== "all") {
      list = list.filter((p) => String(p.group_id) === String(allPlayersGroup));
    }

    // Name search
    if (allPlayersSearch.trim()) {
      const q = allPlayersSearch.trim().toLowerCase();
      list = list.filter((p) =>
        p.player_name?.toLowerCase().includes(q),
      );
    }

    return list;
  }, [
    playersList,
    allPlayersQuickFilter,
    allPlayersStatus,
    allPlayersGroup,
    allPlayersSearch,
    wishlistSet,
    currentLiveGroupId,
  ]);

  const handleAllPlayersQuickFilter = (filterKey) => {
    setAllPlayersQuickFilter(filterKey);
    setAllPlayersSearch("");

    if (filterKey === "all") {
      setAllPlayersStatus("all");
      setAllPlayersGroup("all");
      return;
    }

    if (filterKey === "unsold") {
      setAllPlayersStatus("unsold");
      setAllPlayersGroup("all");
      return;
    }

    if (filterKey === "myTargets") {
      setAllPlayersStatus("all");
      setAllPlayersGroup("all");
      return;
    }

    if (filterKey === "currentGroup") {
      setAllPlayersStatus("all");
      setAllPlayersGroup(
        currentLiveGroupId !== null && currentLiveGroupId !== undefined
          ? String(currentLiveGroupId)
          : "all",
      );
    }
  };

  const updateWishlist = (updater) => {
    setWishlistIds((prevIds) => {
      const nextIds =
        typeof updater === "function" ? updater(prevIds) : updater;
      localStorage.setItem(wishlistStorageKey, JSON.stringify(nextIds));
      return nextIds;
    });
  };

  const handleToggleWishlist = (playerId) => {
    const normalizedId = String(playerId);
    updateWishlist((prevIds) => {
      const prevSet = new Set(prevIds.map((id) => String(id)));
      if (prevSet.has(normalizedId)) {
        return prevIds.filter((id) => String(id) !== normalizedId);
      }
      return [...prevIds, normalizedId];
    });
  };

  const handleClearWishlist = () => {
    updateWishlist([]);
  };

  // Resolve team name for a sold player
  const getSoldTeamName = (player) => {
    if (!player?.soldTo) return null;
    const team = teamsById.get(String(player.soldTo));
    return team?.team_name || "Unknown Team";
  };

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

  // --- Helper: Status Badge ---
  const StatusBadge = ({ player }) => {
    const status = getPlayerStatus(player);
    const soldTeamName = getSoldTeamName(player);
    const isSoldToMyTeam = player.soldTo && String(player.soldTo) === String(teamId);

    if (status === "sold") {
      return (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700">
            SOLD
          </span>
          <span className={`text-xs font-semibold ${isSoldToMyTeam ? "text-accent" : "text-textLight"}`}>
            → {isSoldToMyTeam ? "Your Team" : soldTeamName}
          </span>
          <span className="text-xs font-bold text-success">
            ₹{(player.soldPrice || 0).toLocaleString()}
          </span>
        </div>
      );
    }
    if (status === "unsold") {
      return (
        <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700">
          UNSOLD
        </span>
      );
    }
    return (
      <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-bold bg-yellow-100 text-yellow-700">
        PENDING
      </span>
    );
  };

  // Authenticated team dashboard
  return (
    <div className="min-h-screen bg-lightBg p-3 sm:p-6 transition-colors">
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
        {!isAuctionComplete && currentLivePlayer && (
          <div className="card mb-6 border-2 border-secondary">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-3 h-3 bg-success rounded-full animate-pulse"></div>
              <h2 className="text-lg font-bold text-primary">Live Auction</h2>
              {isAuctionPaused && (
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
                  <LiveBidAmount
                    auctionId={auctionId}
                    sold={Boolean(currentLivePlayer?.soldTo)}
                    soldPrice={currentLivePlayer?.soldPrice || 0}
                  />
                </p>
              </div>
            </div>
          </div>
        )}

        {isAuctionComplete && (
          <div className="card mb-6 bg-green-50 border-2 border-success text-center p-4">
            <p className="text-lg font-bold text-success">Auction Complete!</p>
          </div>
        )}

        {/* ===== TAB BAR ===== */}
        <div className="overflow-x-auto owner-tab-bar mb-6">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            const badgeCount =
              tab.key === "wishlist"
                ? wishlistSet.size
                : tab.key === "myPlayers"
                  ? squad.length
                  : null;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`owner-tab ${isActive ? "owner-tab-active" : ""}`}
              >
                <Icon size={16} />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden text-xs">{tab.label.split(" ").pop()}</span>
                {badgeCount !== null && badgeCount > 0 && (
                  <span className="owner-tab-badge">{badgeCount}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* ===== TAB CONTENT ===== */}

        {/* ---- My Players Tab ---- */}
        {activeTab === "myPlayers" && (
          <div className="animate-fade-in-up">
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
                <div className="overflow-x-auto -mx-4 sm:-mx-6 px-4 sm:px-6 pb-2">
                  <table className="w-full min-w-[600px] table-improved">
                    <thead>
                      <tr className="border-b-2 border-border">
                        <th className="text-left py-3 px-3 font-bold text-primary text-sm whitespace-nowrap">
                          #
                        </th>
                        <th className="text-left py-3 px-3 font-bold text-primary text-sm whitespace-nowrap">
                          Player
                        </th>
                        <th className="text-left py-3 px-3 font-bold text-primary text-sm whitespace-nowrap">
                          Age
                        </th>
                        <th className="text-left py-3 px-3 font-bold text-primary text-sm whitespace-nowrap">
                          Group
                        </th>
                        <th className="text-right py-3 px-3 font-bold text-primary text-sm whitespace-nowrap">
                          Price
                        </th>
                        <th className="text-center py-3 px-3 font-bold text-primary text-sm whitespace-nowrap">
                          Wishlist
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {squad.map((player, idx) => {
                        const group = groupsById.get(String(player.group_id));
                        const isWishlisted = wishlistSet.has(String(player.id));
                        const playerPhoto = getImagePath(
                          "player-photo",
                          player.photo_url,
                          player.player_name,
                        );
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
                                {playerPhoto ? (
                                  <img
                                    src={playerPhoto}
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
                            <td className="py-3 px-3 text-center">
                              <button
                                type="button"
                                onClick={() => handleToggleWishlist(player.id)}
                                className="p-2 rounded-full border border-border hover:scale-105 transition"
                                title={
                                  isWishlisted
                                    ? "Remove from wishlist"
                                    : "Add to wishlist"
                                }
                              >
                                {isWishlisted ? (
                                  <IoHeart className="text-danger" size={16} />
                                ) : (
                                  <IoHeartOutline
                                    className="text-textLight"
                                    size={16}
                                  />
                                )}
                              </button>
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
        )}

        {/* ---- Strategy Tab ---- */}
        {activeTab === "strategy" && (
          <div className="animate-fade-in-up">
            {teamInsights && !isAuctionComplete ? (
              <div className="card">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-primary">
                    Strategy Insights
                  </h2>
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-bold ${getRiskColorClass(teamInsights.budgetAnalysis.riskLevel)}`}
                  >
                    {teamInsights.budgetAnalysis.riskLevel?.level || "UNKNOWN"} Risk
                  </span>
                </div>

                {/* Budget Analysis */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-textLight mb-1">Mandatory Reserve</p>
                    <p className="text-lg font-bold text-primary">
                      {formatCurrency(teamInsights.budgetAnalysis.mandatoryReserve)}
                    </p>
                    <p className="text-xs text-textLight">
                      Min needed for requirements
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-textLight mb-1">Flexible Budget</p>
                    <p
                      className={`text-lg font-bold ${teamInsights.budgetAnalysis.flexibleBudget >= 0 ? "text-success" : "text-danger"}`}
                    >
                      {formatCurrency(teamInsights.budgetAnalysis.flexibleBudget)}
                    </p>
                    <p className="text-xs text-textLight">Available for bidding</p>
                  </div>
                </div>

                {/* Group Requirements */}
                {teamInsights.groupOpportunities &&
                  teamInsights.groupOpportunities.length > 0 && (
                    <div className="mb-4">
                      <p className="text-sm font-semibold text-text mb-2">
                        Group Requirements
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {teamInsights.groupOpportunities.map((opp) => (
                          <div
                            key={opp.group}
                            className={`text-xs px-3 py-2 rounded-lg border flex items-center gap-2 ${
                              opp.stillNeed > 0
                                ? "bg-orange-50 border-orange-200 text-orange-800"
                                : opp.canBuyMore > 0
                                  ? "bg-blue-50 border-blue-200 text-blue-800"
                                  : "bg-green-50 border-green-200 text-green-800"
                            }`}
                          >
                            <div className="flex flex-col items-start">
                              <span className="font-bold">{opp.group}</span>
                              {groupRules[opp.group]?.basePrice > 0 && (
                                <span className="text-[10px] opacity-70">
                                  Base ₹{groupRules[opp.group].basePrice.toLocaleString()}
                                </span>
                              )}
                            </div>
                            {opp.stillNeed > 0 ? (
                              <span className="ml-1">
                                Need {opp.stillNeed} more
                              </span>
                            ) : opp.canBuyMore > 0 ? (
                              <span className="ml-1">
                                Can buy {opp.canBuyMore} more
                              </span>
                            ) : (
                              <span className="ml-1 flex items-center gap-1">
                                <IoCheckmarkCircle size={12} /> Complete
                              </span>
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
                          warning.severity === "critical"
                            ? "bg-red-50 text-red-800 border border-red-200"
                            : warning.severity === "high"
                              ? "bg-orange-50 text-orange-800 border border-orange-200"
                              : "bg-yellow-50 text-yellow-800 border border-yellow-200"
                        }`}
                      >
                        {warning.severity === "critical" ? (
                          <IoAlertCircle
                            size={18}
                            className="text-red-600 flex-shrink-0 mt-0.5"
                          />
                        ) : (
                          <IoWarning
                            size={18}
                            className={`flex-shrink-0 mt-0.5 ${
                              warning.severity === "high"
                                ? "text-orange-600"
                                : "text-yellow-600"
                            }`}
                          />
                        )}
                        <span>{warning.message}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* No warnings - show success */}
                {(!teamInsights.warnings || teamInsights.warnings.length === 0) &&
                  teamInsights.budgetAnalysis.riskLevel?.level === "SAFE" && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 text-green-800 border border-green-200 text-sm">
                      <IoCheckmarkCircle size={18} className="text-green-600" />
                      <span>
                        Budget is healthy. You can bid comfortably on upcoming
                        players.
                      </span>
                    </div>
                  )}
              </div>
            ) : isAuctionComplete ? (
              <div className="card text-center py-12">
                <IoCheckmarkCircle size={48} className="text-success mx-auto mb-3" />
                <p className="text-lg font-bold text-primary mb-1">
                  Auction Complete
                </p>
                <p className="text-textLight text-sm">
                  Strategy insights are available during the live auction.
                  Check the "My Players" tab to review your final squad.
                </p>
              </div>
            ) : (
              <div className="card text-center py-12">
                <IoStatsChart size={48} className="text-textLight mx-auto mb-3" />
                <p className="text-lg font-bold text-primary mb-1">
                  No Insights Available
                </p>
                <p className="text-textLight text-sm">
                  Strategy insights will appear once the auction begins.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ---- Wishlist Tab ---- */}
        {activeTab === "wishlist" && (
          <div className="animate-fade-in-up">
            <div className="card mb-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-primary">
                    Private Wishlist ({wishlistSet.size})
                  </h2>
                  <p className="text-xs sm:text-sm text-textLight">
                    Visible only on this owner dashboard for this team.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleClearWishlist}
                  disabled={wishlistSet.size === 0}
                  className="btn btn-sm btn-danger self-start sm:self-auto disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Clear Wishlist
                </button>
              </div>

              {/* Wishlisted Players Grid */}
              {wishlistPlayers.length > 0 && (
                <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {wishlistPlayers.map((player) => {
                    const group = groupsById.get(String(player.group_id));
                    const isSoldElsewhere =
                      player.soldTo && String(player.soldTo) !== String(teamId);
                    const isSoldToMe =
                      player.soldTo && String(player.soldTo) === String(teamId);
                    const soldTeamName = getSoldTeamName(player);
                    return (
                      <div
                        key={`wish-${player.id}`}
                        className="border border-border rounded-lg p-3 bg-rose-50/60"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-semibold text-text truncate">
                            {player.player_name}
                          </p>
                          <button
                            type="button"
                            onClick={() => handleToggleWishlist(player.id)}
                            className="p-1 rounded-full hover:scale-105 transition"
                            title="Remove from wishlist"
                          >
                            <IoHeart className="text-danger" size={16} />
                          </button>
                        </div>
                        <p className="text-xs text-textLight mt-1">
                          {group?.group_name || "N/A"} | Age: {player.age || "N/A"}
                        </p>
                        {isSoldElsewhere && (
                          <p className="text-xs text-danger mt-1 font-semibold">
                            Sold to {soldTeamName} — ₹{(player.soldPrice || 0).toLocaleString()}
                          </p>
                        )}
                        {isSoldToMe && (
                          <p className="text-xs text-success mt-1 font-semibold">
                            ✓ In your squad — ₹{(player.soldPrice || 0).toLocaleString()}
                          </p>
                        )}
                        {player.unsold && !player.soldTo && (
                          <p className="text-xs text-red-500 mt-1 font-semibold">
                            Unsold
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Browse all to add to wishlist */}
              <div className="border-t border-border pt-4">
                <p className="text-sm font-semibold text-text mb-3">
                  Browse players to add to wishlist
                </p>
                {/* Status filters */}
                <div className="mb-2 flex flex-wrap gap-2">
                  {["all", "pending", "sold", "unsold"].map((filterKey) => (
                    <button
                      key={filterKey}
                      type="button"
                      onClick={() => setWishlistFilter(filterKey)}
                      className={`btn btn-sm ${
                        wishlistFilter === filterKey ? "btn-primary" : "btn-secondary"
                      }`}
                    >
                      {filterKey.charAt(0).toUpperCase() + filterKey.slice(1)}
                    </button>
                  ))}
                </div>
                {/* Group filters */}
                <div className="mb-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setWishlistGroupFilter("all")}
                    className={`btn btn-sm ${
                      wishlistGroupFilter === "all" ? "btn-primary" : "btn-secondary"
                    }`}
                  >
                    All Groups
                  </button>
                  {[...groupsList]
                    .sort((a, b) => (a.order || 0) - (b.order || 0))
                    .map((group) => (
                      <button
                        key={group.id}
                        type="button"
                        onClick={() => setWishlistGroupFilter(group.id)}
                        className={`btn btn-sm ${
                          wishlistGroupFilter === group.id
                            ? "btn-primary"
                            : "btn-secondary"
                        }`}
                      >
                        {group.group_name}
                      </button>
                    ))}
                </div>

                <div className="max-h-72 overflow-y-auto border border-border rounded-lg">
                  {filteredWishlistCandidates.length === 0 ? (
                    <p className="text-textLight text-sm p-4">
                      No players in this filter.
                    </p>
                  ) : (
                    <div className="divide-y divide-border">
                      {filteredWishlistCandidates.map((player) => {
                        const group = groupsById.get(String(player.group_id));
                        const isWishlisted = wishlistSet.has(String(player.id));
                        return (
                          <div
                            key={`candidate-${player.id}`}
                            className="flex items-center justify-between gap-3 p-3 hover:bg-gray-50"
                          >
                            <div className="min-w-0">
                              <p className="font-semibold text-text truncate">
                                {player.player_name}
                              </p>
                              <p className="text-xs text-textLight">
                                {group?.group_name || "N/A"} | Age:{" "}
                                {player.age || "N/A"}
                              </p>
                              <div className="mt-1">
                                <StatusBadge player={player} />
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleToggleWishlist(player.id)}
                              className="p-2 rounded-full border border-border hover:scale-105 transition flex-shrink-0"
                              title={
                                isWishlisted
                                  ? "Remove from wishlist"
                                  : "Add to wishlist"
                              }
                            >
                              {isWishlisted ? (
                                <IoHeart className="text-danger" size={18} />
                              ) : (
                                <IoHeartOutline
                                  className="text-textLight"
                                  size={18}
                                />
                              )}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ---- All Players Tab ---- */}
        {activeTab === "allPlayers" && (
          <div className="animate-fade-in-up">
            <div className="card">
              <h2 className="text-xl sm:text-2xl font-bold text-primary mb-4">
                All Players ({filteredAllPlayers.length})
              </h2>

              {/* Quick Filters */}
              <div className="mb-4 -mx-1 px-1 overflow-x-auto">
                <div className="flex items-center gap-2 min-w-max">
                  {[
                    { key: "all", label: "All" },
                    { key: "unsold", label: "Unsold" },
                    { key: "myTargets", label: "My Targets" },
                    { key: "currentGroup", label: "Current Group" },
                  ].map((chip) => {
                    const isActive = allPlayersQuickFilter === chip.key;
                    const isDisabled =
                      chip.key === "currentGroup" &&
                      (currentLiveGroupId === null ||
                        currentLiveGroupId === undefined);

                    return (
                      <button
                        key={chip.key}
                        type="button"
                        onClick={() => handleAllPlayersQuickFilter(chip.key)}
                        disabled={isDisabled}
                        className={`px-3 py-1.5 rounded-full text-xs sm:text-sm font-semibold border transition whitespace-nowrap ${
                          isActive
                            ? "bg-primary text-white border-primary"
                            : "bg-white text-textLight border-border hover:border-primary/40 hover:text-primary"
                        } ${
                          isDisabled
                            ? "opacity-50 cursor-not-allowed hover:border-border hover:text-textLight"
                            : ""
                        }`}
                      >
                        {chip.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Search & Filters */}
              <div className="flex flex-col sm:flex-row gap-3 mb-4">
                {/* Name search */}
                <div className="relative flex-1">
                  <IoSearch
                    size={18}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-textLight"
                  />
                  <input
                    type="text"
                    value={allPlayersSearch}
                    onChange={(e) => setAllPlayersSearch(e.target.value)}
                    placeholder="Search player name..."
                    className="w-full pl-10 pr-4 py-2 border border-border rounded-lg focus:outline-none focus:border-primary bg-white text-text text-sm"
                  />
                </div>

                {/* Status filter */}
                <select
                  value={allPlayersStatus}
                  onChange={(e) => setAllPlayersStatus(e.target.value)}
                  className="px-3 py-2 border border-border rounded-lg focus:outline-none focus:border-primary bg-white text-text text-sm"
                >
                  <option value="all">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="sold">Sold</option>
                  <option value="unsold">Unsold</option>
                </select>

                {/* Group filter */}
                <select
                  value={allPlayersGroup}
                  onChange={(e) => setAllPlayersGroup(e.target.value)}
                  className="px-3 py-2 border border-border rounded-lg focus:outline-none focus:border-primary bg-white text-text text-sm"
                >
                  <option value="all">All Groups</option>
                  {groupsList.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.group_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Player List */}
              {filteredAllPlayers.length === 0 ? (
                <p className="text-textLight py-8 text-center">
                  No players match your filters.
                </p>
              ) : (
                <div className="border border-border rounded-lg overflow-hidden">
                  <div className="max-h-[70vh] overflow-y-auto divide-y divide-border">
                    {filteredAllPlayers.map((player) => {
                      const group = groupsById.get(String(player.group_id));
                      const isWishlisted = wishlistSet.has(String(player.id));
                      const isSoldToMe =
                        player.soldTo && String(player.soldTo) === String(teamId);
                      const playerPhoto = getImagePath(
                        "player-photo",
                        player.photo_url,
                        player.player_name,
                      );
                      return (
                        <div
                          key={`all-${player.id}`}
                          className={`flex items-center justify-between gap-3 p-3 hover:bg-gray-50 transition-colors ${
                            isSoldToMe ? "bg-green-50/50" : ""
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            {/* Player Avatar */}
                            {playerPhoto ? (
                              <img
                                src={playerPhoto}
                                alt={player.player_name}
                                className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                                onError={(e) => {
                                  e.target.style.display = "none";
                                }}
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-sm font-bold text-textLight flex-shrink-0">
                                {player.player_name?.charAt(0)}
                              </div>
                            )}

                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="font-semibold text-text text-sm truncate">
                                  {player.player_name}
                                </p>
                                {isSoldToMe && (
                                  <span className="text-xs bg-accent text-white px-1.5 py-0.5 rounded font-bold flex-shrink-0">
                                    YOUR TEAM
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-textLight">
                                {group?.group_name || "N/A"} | Age: {player.age || "N/A"}
                              </p>
                              <div className="mt-1">
                                <StatusBadge player={player} />
                              </div>
                            </div>
                          </div>

                          {/* Wishlist Toggle */}
                          <button
                            type="button"
                            onClick={() => handleToggleWishlist(player.id)}
                            className="p-2 rounded-full border border-border hover:scale-105 transition flex-shrink-0"
                            title={
                              isWishlisted
                                ? "Remove from wishlist"
                                : "Add to wishlist"
                            }
                          >
                            {isWishlisted ? (
                              <IoHeart className="text-danger" size={18} />
                            ) : (
                              <IoHeartOutline className="text-textLight" size={18} />
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ===== SALE NOTIFICATION POPUP ===== */}
      {saleNotification && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pointer-events-none pt-6 sm:pt-10">
          <div
            className={`pointer-events-auto w-[90vw] max-w-md rounded-2xl shadow-2xl overflow-hidden sale-popup-enter ${
              saleNotification.isMine
                ? "bg-gradient-to-br from-green-600 to-green-800 ring-4 ring-green-400/50"
                : "bg-gradient-to-br from-primary to-accent ring-4 ring-secondary/40"
            }`}
          >
            {/* Header banner */}
            <div className={`px-4 py-2 text-center text-xs font-bold tracking-widest uppercase ${
              saleNotification.isMine
                ? "bg-green-400/30 text-green-100"
                : "bg-secondary/30 text-secondary"
            }`}>
              {saleNotification.isMine ? "🎉 Sold to Your Team!" : "Player Sold"}
            </div>

            {/* Body */}
            <div className="p-5 text-center">
              <p className="text-2xl sm:text-3xl font-bold text-white mb-1">
                {saleNotification.playerName}
              </p>
              <p className="text-white/70 text-sm mb-3">
                {saleNotification.groupName} | Age: {saleNotification.age || "N/A"}
              </p>

              <div className="inline-flex items-center gap-2 bg-white/15 rounded-xl px-5 py-3 mb-3">
                <span className="text-white/80 text-sm">Sold for</span>
                <span className="text-secondary text-2xl sm:text-3xl font-bold">
                  ₹{saleNotification.price.toLocaleString()}
                </span>
              </div>

              <p className="text-white text-base font-semibold">
                → {saleNotification.teamName}
              </p>
            </div>

            {/* Dismiss */}
            <button
              type="button"
              onClick={dismissSaleNotification}
              className="w-full py-2 text-xs text-white/50 hover:text-white/80 transition bg-black/10 cursor-pointer"
            >
              Tap to dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamOwnerView;
