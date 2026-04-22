import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useBidding } from "../../hooks/useBidding";
import { useRealtimeData } from "../../hooks/useRealtimeData";
import { useAuctionConfig } from "../../hooks/useAuctionConfig";
import { useToast } from "../../components/Toast";
import { ToastContainer } from "../../components/ToastContainer";
import { Modal } from "../../components/Modal";
import { Header } from "../../components/Header";
import {
  firebaseObjectToArray,
  getImagePath,
} from "../../utils/dataTransformUtils";
import {
  getTeamGroupCounts,
  checkTeamEligibilityWithMode,
  getNextAplusPlayer,
  getRandomPlayer,
  getNextSequentialPlayer,
  isPhase1Complete,
  getSequentialProgress,
  normalizeGroupName,
  getFirstGroup,
  AUCTION_MODES,
} from "../../utils/auctionUtils";
import {
  generateTeamInsights,
  getRiskColorClass,
  formatCurrency,
} from "../../utils/strategyInsights";
import { ROUTES } from "../../constants/routes";
import {
  IoPause,
  IoPlay,
  IoArrowBack,
  IoArrowForward,
  IoCheckmark,
  IoClose,
  IoRefresh,
  IoPeople,
  IoVolumeHigh,
  IoVolumeMute,
  IoTv,
  IoFlash,
} from "react-icons/io5";
import { ref, update } from "firebase/database";
import { db } from "../../utils/firebaseConfig";
import { useSound } from "../../hooks/useSound";
import { AnimatedNumber } from "../../components/AnimatedNumber";
import { IoAlertCircle } from "react-icons/io5";
import confetti from "canvas-confetti";

export const AdminLive = () => {
  const { auctionId } = useParams();
  const navigate = useNavigate();
  const { toasts, showToast, removeToast } = useToast();
  const { isMuted, toggleMute, play } = useSound();

  // Real-time data
  const { data: auctionData, error: auctionError } = useRealtimeData(
    `auctions/${auctionId}`,
  );
  const { data: playersData, error: playersError } = useRealtimeData(
    `auctions/${auctionId}/players`,
  );
  const { data: teamsData, error: teamsError } = useRealtimeData(
    `auctions/${auctionId}/teams`,
  );
  const { data: groupsData, error: groupsError } = useRealtimeData(
    `auctions/${auctionId}/groups`,
  );

  // Auction state
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0);
  const [currentPlayerId, setCurrentPlayerId] = useState(null); // For phase-based selection
  const [auctionPhase, setAuctionPhase] = useState(1); // 1 = A+ round, 2 = Random selection
  const [unsoldAplusIds, setUnsoldAplusIds] = useState([]); // Queue of unsold A+ players for re-auction
  const [auctionPaused, setAuctionPaused] = useState(false);
  const [showWinnerModal, setShowWinnerModal] = useState(false);
  const [showUnsoldPanel, setShowUnsoldPanel] = useState(false);
  const [initialAdvanceDone, setInitialAdvanceDone] = useState(false);
  const [showStrategyInsights, setShowStrategyInsights] = useState(false);
  const [selectedTeamInsight, setSelectedTeamInsight] = useState(null);
  const [forceReauction, setForceReauction] = useState(false); // Force show bidding controls for re-auction

  // Bidding state
  const {
    currentBid,
    bidHistory,
    incrementBid,
    decrementBid,
    undoLastBid,
    resetBid,
  } = useBidding(auctionId, null);

  // Get data arrays
  const playersList = firebaseObjectToArray(playersData);
  const teamsList = firebaseObjectToArray(teamsData);
  const groupsList = firebaseObjectToArray(groupsData);

  // Load dynamic auction config (groupRules, totals, groupOrder) - uses groupsList as fallback
  const {
    groupRules,
    totalPlayersPerTeam,
    totalMinReserve,
    groupOrder,
    loading: configLoading,
  } = useAuctionConfig(auctionId, groupsList);

  // Get auction mode (default to "open_after_aplus" for backward compatibility)
  const auctionMode =
    auctionData?.auction_mode || AUCTION_MODES.OPEN_AFTER_APLUS;
  const isSequentialMode = auctionMode === AUCTION_MODES.SEQUENTIAL;

  // Sort players by group order (groups are in Firebase creation order)
  const sortedPlayers = useMemo(() => {
    if (playersList.length === 0) return [];
    if (groupsList.length === 0) return [...playersList];
    const groupOrderMap = new Map(
      groupsList.map((g, idx) => [String(g.id), idx]),
    );
    return [...playersList].sort((a, b) => {
      const aIdx = groupOrderMap.get(String(a.group_id)) ?? 999;
      const bIdx = groupOrderMap.get(String(b.group_id)) ?? 999;
      return aIdx - bIdx;
    });
  }, [playersList, groupsList]);

  const playersMissingGroup = useMemo(
    () => sortedPlayers.filter((player) => !player.group_id),
    [sortedPlayers],
  );

  const playersWithInvalidGroup = useMemo(() => {
    const validGroupIds = new Set(groupsList.map((group) => String(group.id)));
    return sortedPlayers.filter(
      (player) =>
        player.group_id && !validGroupIds.has(String(player.group_id)),
    );
  }, [sortedPlayers, groupsList]);

  // Current player - use ID-based selection for phase system, fall back to index
  const currentPlayer = useMemo(() => {
    if (currentPlayerId) {
      return (
        sortedPlayers.find((p) => String(p.id) === String(currentPlayerId)) ||
        sortedPlayers[currentPlayerIndex]
      );
    }
    return sortedPlayers[currentPlayerIndex];
  }, [sortedPlayers, currentPlayerId, currentPlayerIndex]);

  const currentGroup = currentPlayer
    ? groupsList.find((g) => String(g.id) === String(currentPlayer.group_id))
    : null;

  // Compute team eligibility for current bid using new auction rules
  const teamEligibility = useMemo(() => {
    const maxSquadSize =
      Number(auctionData?.max_players_per_team) || totalPlayersPerTeam || 9;
    const currentGroupName = currentGroup?.group_name || null;
    const bid = Number(currentBid) || 0;

    return teamsList.map((team) => {
      // Get team's current group counts
      const groupCounts = getTeamGroupCounts(
        team.squad,
        sortedPlayers,
        groupsList,
        groupRules,
      );

      // Use mode-aware eligibility checker
      const eligibility = checkTeamEligibilityWithMode(
        team,
        bid,
        currentGroupName,
        groupCounts,
        auctionMode,
        groupsList,
        sortedPlayers,
        maxSquadSize,
        groupOrder,
        groupRules,
      );

      const normalizedGroupName = normalizeGroupName(
        currentGroupName,
        groupRules,
      );

      return {
        teamId: team.id,
        eligible: eligibility.eligible,
        canAfford: eligibility.canAffordBid && eligibility.canMeetMinimums,
        squadFull: eligibility.squadFull,
        groupFull: eligibility.groupFull,
        groupCount: groupCounts[normalizedGroupName] || 0,
        reasons: eligibility.reasons,
        minReserveNeeded: eligibility.minReserveNeeded,
        budgetAfterBid: eligibility.budgetAfterBid,
        groupCounts, // Full breakdown for debugging/display
      };
    });
  }, [
    teamsList,
    currentBid,
    currentGroup,
    sortedPlayers,
    groupsList,
    auctionData?.max_players_per_team,
    auctionMode,
    groupRules,
    totalPlayersPerTeam,
  ]);

  // Strategy insights for all teams (computed only when panel is open)
  const teamInsights = useMemo(() => {
    if (!showStrategyInsights) return [];
    return teamsList.map((team) =>
      generateTeamInsights(
        team,
        sortedPlayers,
        groupsList,
        currentPlayer,
        currentGroup,
        Number(currentBid) || 0,
        teamsList,
        groupRules,
        totalPlayersPerTeam,
      ),
    );
  }, [
    showStrategyInsights,
    teamsList,
    sortedPlayers,
    groupsList,
    currentPlayer,
    currentGroup,
    currentBid,
    groupRules,
    totalPlayersPerTeam,
  ]);

  // Single team insight (for modal view)
  const selectedInsight = useMemo(() => {
    if (!selectedTeamInsight) return null;
    const team = teamsList.find(
      (t) => String(t.id) === String(selectedTeamInsight),
    );
    if (!team) return null;
    return generateTeamInsights(
      team,
      sortedPlayers,
      groupsList,
      currentPlayer,
      currentGroup,
      Number(currentBid) || 0,
      teamsList,
      groupRules,
      totalPlayersPerTeam,
    );
  }, [
    selectedTeamInsight,
    teamsList,
    sortedPlayers,
    groupsList,
    currentPlayer,
    currentGroup,
    currentBid,
    groupRules,
    totalPlayersPerTeam,
  ]);

  // Derived auction progress
  // forceReauction overrides the unsold check to allow re-auctioning
  const isPlayerProcessed = !!(
    currentPlayer?.soldTo ||
    (currentPlayer?.unsold && !forceReauction)
  );
  const soldCount = sortedPlayers.filter((p) => p.soldTo).length;
  const unsoldCount = sortedPlayers.filter((p) => p.unsold).length;
  const remainingCount = sortedPlayers.length - soldCount - unsoldCount;
  const isAuctionComplete = remainingCount === 0 && sortedPlayers.length > 0;

  // Check if Phase 1 (first group round) is complete
  const phase1Complete = useMemo(() => {
    return isPhase1Complete(sortedPlayers, groupsList, groupOrder);
  }, [sortedPlayers, groupsList, groupOrder]);

  // First group info for phase tracking (dynamic - not hardcoded to "A+")
  const firstGroup = useMemo(
    () => getFirstGroup(groupsList, groupOrder),
    [groupsList, groupOrder],
  );
  const firstGroupPlayers = firstGroup
    ? sortedPlayers.filter((p) => String(p.group_id) === String(firstGroup.id))
    : [];
  const firstGroupSold = firstGroupPlayers.filter((p) => p.soldTo).length;
  const firstGroupTotal = firstGroupPlayers.length;

  // Group-level progress for the current group
  const currentGroupPlayers = currentGroup
    ? sortedPlayers.filter(
        (p) => String(p.group_id) === String(currentGroup.id),
      )
    : [];
  const currentGroupProcessed = currentGroupPlayers.filter(
    (p) => p.soldTo || p.unsold,
  ).length;

  // Get next player based on current phase and auction mode
  // PURE FUNCTION - does not modify state, just returns the next player
  const getNextPlayer = () => {
    // SEQUENTIAL MODE: Groups one after another
    if (isSequentialMode) {
      // Skip current player to get the NEXT one
      // Function signature: getNextSequentialPlayer(players, groups, skipPlayerId, groupOrder, groupRules)
      const nextPlayer = getNextSequentialPlayer(
        sortedPlayers,
        groupsList,
        currentPlayer?.id,
        groupOrder,
        groupRules,
      );
      return nextPlayer;
    }

    // OPEN AFTER FIRST GROUP MODE: First group first, then random
    if (auctionPhase === 1) {
      // Phase 1: First group round
      const nextFirstGroup = getNextAplusPlayer(
        sortedPlayers,
        groupsList,
        unsoldAplusIds,
        groupOrder,
      );
      if (nextFirstGroup) {
        return nextFirstGroup;
      }

      // If no first group left and all first group are sold, we should transition to Phase 2
      // But don't modify state here - just return what Phase 2 would return
      if (phase1Complete) {
        return getRandomPlayer(sortedPlayers, groupsList, groupOrder);
      }

      return null;
    } else {
      // Phase 2: Random selection from remaining groups
      return getRandomPlayer(sortedPlayers, groupsList, groupOrder);
    }
  };

  // Handle phase transitions and side effects when actually advancing to next player
  const advanceToNextPlayer = () => {
    const nextPlayer = getNextPlayer();
    if (!nextPlayer) return;

    // Handle Open Auction mode side effects
    if (!isSequentialMode) {
      // Phase 1 to Phase 2 transition
      if (auctionPhase === 1 && phase1Complete) {
        setAuctionPhase(2);
        setUnsoldAplusIds([]);
      }

      // Clear unsold flag for re-auctioned A+ players
      if (
        auctionPhase === 1 &&
        nextPlayer.unsold &&
        unsoldAplusIds.includes(nextPlayer.id)
      ) {
        const playerRef = ref(
          db,
          `auctions/${auctionId}/players/${nextPlayer.id}`,
        );
        update(playerRef, { unsold: null }).catch((err) =>
          console.error("Error clearing unsold flag:", err),
        );
        setUnsoldAplusIds((prev) =>
          prev.filter((id) => String(id) !== String(nextPlayer.id)),
        );
      }

      // Clear unsold flag for Phase 2 re-auctioned players
      if (auctionPhase === 2 && nextPlayer.unsold) {
        const playerRef = ref(
          db,
          `auctions/${auctionId}/players/${nextPlayer.id}`,
        );
        update(playerRef, { unsold: null }).catch((err) =>
          console.error("Error clearing unsold flag:", err),
        );
      }
    }

    // Set force reauction flag for unsold players
    if (nextPlayer.unsold) {
      setForceReauction(true);
    } else {
      setForceReauction(false);
    }

    setCurrentPlayerId(nextPlayer.id);
  };

  // Find the next unprocessed player after a given index (legacy, kept for compatibility)
  const findNextUnsold = (afterIndex = currentPlayerIndex) => {
    for (let i = afterIndex + 1; i < sortedPlayers.length; i++) {
      if (!sortedPlayers[i].soldTo && !sortedPlayers[i].unsold) return i;
    }
    return -1;
  };

  // Sync live state to Firebase so viewers can see current player & bid in real-time
  useEffect(() => {
    if (!auctionId || sortedPlayers.length === 0) return;
    const liveStateRef = ref(db, `auctions/${auctionId}/live_state`);

    // Get sequential progress if in sequential mode
    const seqProgress = isSequentialMode
      ? getSequentialProgress(sortedPlayers, groupsList, groupOrder, groupRules)
      : null;

    update(liveStateRef, {
      currentPlayerId: currentPlayer?.id || null,
      currentBid: currentBid,
      isPaused: auctionPaused,
      isComplete: isAuctionComplete,
      auctionPhase: auctionPhase,
      auctionMode: auctionMode,
      unsoldAplusCount: unsoldAplusIds.length,
      currentSequentialGroup: seqProgress?.currentGroup || null,
      updatedAt: new Date().toISOString(),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    auctionId,
    currentPlayer?.id,
    currentBid,
    auctionPaused,
    isAuctionComplete,
    auctionPhase,
    auctionMode,
    unsoldAplusIds.length,
    sortedPlayers.length,
    isSequentialMode,
    groupsList.length, // Use length instead of array reference
    groupRules,
  ]);

  // Initialize bid when switching to a new player (only when player ID changes)
  useEffect(() => {
    if (currentPlayer && currentGroup) {
      // Only reset bid when switching to a genuinely new player
      resetBid(currentGroup.base_price || 0);
    }
    // Only depend on player ID and group base price, not isPlayerProcessed
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPlayerId, currentGroup?.base_price]);

  // On initial load, advance to the first player based on phase and mode
  useEffect(() => {
    if (
      initialAdvanceDone ||
      sortedPlayers.length === 0 ||
      groupsList.length === 0
    )
      return;
    setInitialAdvanceDone(true);

    // SEQUENTIAL MODE: Start with next player in sequence
    if (isSequentialMode) {
      const nextPlayer = getNextSequentialPlayer(
        sortedPlayers,
        groupsList,
        undefined,
        groupOrder,
        groupRules,
      );
      if (nextPlayer) {
        setCurrentPlayerId(nextPlayer.id);
      }
      return;
    }

    // OPEN AFTER FIRST GROUP MODE
    // Check if we should be in Phase 2 (all first group already sold)
    if (phase1Complete) {
      setAuctionPhase(2);
      const nextPlayer = getRandomPlayer(sortedPlayers, groupsList, groupOrder);
      if (nextPlayer) {
        setCurrentPlayerId(nextPlayer.id);
      }
    } else {
      // Phase 1: Start with first group player
      const nextPlayer = getNextAplusPlayer(
        sortedPlayers,
        groupsList,
        [],
        groupOrder,
      );
      if (nextPlayer) {
        setCurrentPlayerId(nextPlayer.id);
      } else {
        // Fallback to first unprocessed player
        const first = sortedPlayers[0];
        if (first && (first.soldTo || first.unsold)) {
          const nextIdx = findNextUnsold(-1);
          if (nextIdx !== -1) setCurrentPlayerIndex(nextIdx);
        }
      }
    }
  }, [
    sortedPlayers.length,
    groupsList.length,
    initialAdvanceDone,
    isSequentialMode,
    groupOrder,
    groupRules,
  ]);

  // Play fanfare when auction completes
  useEffect(() => {
    if (isAuctionComplete) {
      play("complete");
    }
  }, [isAuctionComplete, play]);

  // Handle increment
  const handleIncrement = async () => {
    if (!currentGroup || isPlayerProcessed) return;
    try {
      await incrementBid(
        currentGroup.increment_value,
        currentGroup.max_bid_cap,
        null,
      );
      play("bid");
    } catch (error) {
      showToast(error.message, "error");
    }
  };

  // Handle decrement
  const handleDecrement = async () => {
    if (!currentGroup || isPlayerProcessed) return;
    if (currentBid <= (currentGroup?.base_price || 0)) {
      showToast("Cannot go below base price", "error");
      return;
    }
    try {
      await decrementBid(
        currentGroup.increment_value,
        currentGroup.base_price || 0,
      );
    } catch (error) {
      showToast(error.message, "error");
    }
  };

  // Mark player as unsold and advance
  const handleMarkUnsold = async () => {
    if (!currentPlayer || isPlayerProcessed) return;
    try {
      const playerRef = ref(
        db,
        `auctions/${auctionId}/players/${currentPlayer.id}`,
      );
      await update(playerRef, { unsold: true });
      showToast(`${currentPlayer.player_name} marked as unsold`, "info");
      play("unsold");
      setForceReauction(false); // Reset force flag

      // Phase 1: Add first-group players to re-auction queue
      const isFirstGroupPlayer =
        firstGroup && String(currentPlayer.group_id) === String(firstGroup.id);
      if (auctionPhase === 1 && isFirstGroupPlayer) {
        setUnsoldAplusIds((prev) => [...prev, currentPlayer.id]);
        showToast(
          `${firstGroup.group_name} player will be re-auctioned after other ${firstGroup.group_name} players`,
          "warning",
        );
      }

      // Advance to next player using phase logic
      advanceToNextPlayer();
    } catch (error) {
      showToast("Error: " + error.message, "error");
    }
  };

  // List of unsold players (for the re-auction panel) - exclude first-group during Phase 1
  const unsoldPlayersList = sortedPlayers.filter((p) => {
    if (!p.unsold || p.soldTo) return false;
    // During Phase 1, first-group unsold players are handled separately via queue
    if (
      auctionPhase === 1 &&
      firstGroup &&
      String(p.group_id) === String(firstGroup.id)
    ) {
      return false;
    }
    return true;
  });

  // Bring an unsold player back into the auction
  const handleReauction = async (player) => {
    try {
      const playerRef = ref(db, `auctions/${auctionId}/players/${player.id}`);
      await update(playerRef, { unsold: null });
      showToast(`${player.player_name} added back to auction`, "success");
      // Set as current player
      setCurrentPlayerId(player.id);
      setShowUnsoldPanel(false);
    } catch (error) {
      showToast("Error: " + error.message, "error");
    }
  };

  // Sold to team
  const handleSoldToTeam = async (teamId) => {
    try {
      const playerRef = ref(
        db,
        `auctions/${auctionId}/players/${currentPlayer.id}`,
      );
      await update(playerRef, {
        soldTo: teamId,
        soldPrice: currentBid,
        unsold: null, // Clear unsold flag when sold
      });

      const teamRef = ref(db, `auctions/${auctionId}/teams/${teamId}`);
      const selectedTeam = teamsList.find(
        (t) => String(t.id) === String(teamId),
      );
      if (!selectedTeam) {
        throw new Error(`Team with ID ${teamId} not found`);
      }

      await update(teamRef, {
        squad: [...(selectedTeam.squad || []), currentPlayer.id],
        budget_remaining:
          Number(selectedTeam.budget_remaining || 0) - Number(currentBid),
      });

      showToast(
        `${currentPlayer.player_name} sold to ${selectedTeam.team_name}!`,
        "success",
      );
      play("sold");
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ["#ffc107", "#1a3a52", "#10b981"],
      });
      setShowWinnerModal(false);
      setForceReauction(false); // Reset force flag

      // Remove from unsold queue if it was an A+ re-auction
      if (unsoldAplusIds.includes(currentPlayer.id)) {
        setUnsoldAplusIds((prev) =>
          prev.filter((id) => id !== currentPlayer.id),
        );
      }

      // Advance to next player using phase logic
      advanceToNextPlayer();
    } catch (error) {
      showToast("Error updating auction: " + error.message, "error");
    }
  };

  // --- RENDER ---

  const isLoading = !auctionData || !playersData || !teamsData || !groupsData;
  const hasError = auctionError || playersError || teamsError || groupsError;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-lightBg transition-colors">
        <div className="text-center max-w-md">
          {hasError ? (
            <div className="bg-red-100 border border-red-400 text-red-700 p-4 rounded mb-4">
              <p className="font-bold mb-2">Firebase Error:</p>
              <p className="text-sm">{hasError}</p>
            </div>
          ) : (
            <>
              <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-primary mx-auto"></div>
              <p className="text-textLight mt-4">Loading auction data...</p>
            </>
          )}
        </div>
      </div>
    );
  }

  if (sortedPlayers.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-lightBg transition-colors">
        <div className="text-center max-w-md">
          <p className="text-xl text-textLight mb-4">
            No players added to this auction!
          </p>
          <p className="text-textLight mb-6">
            Please add players before starting the live auction.
          </p>
          <a href={`/admin/players/${auctionId}`} className="btn btn-primary">
            Go Back to Add Players
          </a>
        </div>
      </div>
    );
  }

  if (playersMissingGroup.length > 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-lightBg transition-colors">
        <div className="text-center max-w-lg">
          <p className="text-xl text-textLight mb-4">
            Group assignment required before Live
          </p>
          <p className="text-textLight mb-4">
            {playersMissingGroup.length} player(s) are still unassigned to any
            group.
          </p>
          <p className="text-sm text-danger mb-6">
            Open the Players page, use Segregate, and assign every player to a
            valid group.
          </p>
          <button
            onClick={() => navigate(ROUTES.ADMIN_PLAYERS(auctionId))}
            className="btn btn-primary"
          >
            Go to Players & Segregate
          </button>
        </div>
      </div>
    );
  }

  // --- AUCTION COMPLETE SCREEN ---
  if (isAuctionComplete) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary to-darkBg flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-2xl p-6 sm:p-8 max-w-lg w-full text-center">
          <h1 className="text-2xl sm:text-3xl font-bold text-primary mb-2">
            Auction Complete!
          </h1>
          <p className="text-textLight mb-6">
            All {sortedPlayers.length} players have been processed.
          </p>

          <div className="flex justify-center gap-8 mb-6">
            <div className="text-center">
              <p className="text-3xl font-bold text-success">{soldCount}</p>
              <p className="text-sm text-textLight">Sold</p>
            </div>
            {unsoldCount > 0 && (
              <div className="text-center">
                <p className="text-3xl font-bold text-danger">{unsoldCount}</p>
                <p className="text-sm text-textLight">Unsold</p>
              </div>
            )}
          </div>

          {/* Team summary */}
          <div className="space-y-3 mb-6 text-left">
            {teamsList.map((team) => {
              const teamPlayerCount = sortedPlayers.filter(
                (p) => String(p.soldTo) === String(team.id),
              ).length;
              const spent =
                Number(team.budget_total || 0) -
                Number(team.budget_remaining || 0);
              return (
                <div
                  key={team.id}
                  className="flex justify-between items-center p-3 bg-lightBg rounded-lg"
                >
                  <div>
                    <p className="font-bold text-primary">{team.team_name}</p>
                    <p className="text-xs text-textLight">
                      {teamPlayerCount} players
                    </p>
                  </div>
                  <p className="font-bold text-text">
                    ₹{spent.toLocaleString()}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="flex gap-4 justify-center">
            <a
              href={ROUTES.ADMIN_RESULTS(auctionId)}
              className="btn btn-primary"
            >
              View Results
            </a>
            <a href={ROUTES.ADMIN_SETUP} className="btn btn-secondary">
              Back to Dashboard
            </a>
          </div>

          {/* Re-auction unsold players from complete screen */}
          {unsoldPlayersList.length > 0 && (
            <div className="mt-6 pt-6 border-t border-border text-left">
              <h3 className="font-bold text-primary mb-3">
                Unsold Players ({unsoldPlayersList.length}) - Bring back for
                re-auction?
              </h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {unsoldPlayersList.map((player) => {
                  const group = groupsList.find(
                    (g) => String(g.id) === String(player.group_id),
                  );
                  return (
                    <div
                      key={player.id}
                      className="flex justify-between items-center p-2 bg-lightBg rounded-lg"
                    >
                      <div>
                        <p className="font-semibold text-text text-sm">
                          {player.player_name}
                        </p>
                        <p className="text-xs text-textLight">
                          {group?.group_name} | ₹
                          {(group?.base_price || 0).toLocaleString()}
                        </p>
                      </div>
                      <button
                        onClick={async () => {
                          const playerRef = ref(
                            db,
                            `auctions/${auctionId}/players/${player.id}`,
                          );
                          await update(playerRef, { unsold: null });
                          showToast(
                            `${player.player_name} added back to auction`,
                            "success",
                          );
                        }}
                        className="btn btn-sm btn-primary flex items-center gap-1 text-xs"
                      >
                        <IoRefresh size={12} /> Re-auction
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Invalid group fallback (only when current player cannot be resolved to a valid group)
  if (!currentPlayer || !currentGroup) {
    const invalidIdSet = new Set(playersWithInvalidGroup.map((p) => String(p.id)));
    const validPlayers = sortedPlayers.filter(
      (p) => !invalidIdSet.has(String(p.id)),
    );
    const invalidCount = playersWithInvalidGroup.length;
    const currentSortedIndex = sortedPlayers.findIndex(
      (p) => String(p.id) === String(currentPlayer?.id || currentPlayerId),
    );

    return (
      <div className="min-h-screen flex items-center justify-center bg-lightBg transition-colors">
        <div className="text-center max-w-lg">
          <p className="text-xl text-textLight mb-4">
            Player has invalid group assignment
          </p>
          <p className="text-textLight mb-4">
            {invalidCount > 0
              ? "One or more players reference a group_id that does not exist in this auction."
              : "Could not resolve the current player in the active auction order."}
          </p>
          <p className="text-sm text-danger mb-6">
            {invalidCount > 0
              ? `${invalidCount} of ${sortedPlayers.length} player(s) have invalid groups. Open Players and use Edit or Segregate to assign valid groups.`
              : "Try skipping to a valid player, or open Players to repair group assignments."}
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            {validPlayers.length > 0 && (
              <button
                onClick={() => {
                  const startIdx =
                    currentSortedIndex !== -1
                      ? currentSortedIndex
                      : currentPlayerIndex;
                  const nextValidIdx = sortedPlayers.findIndex(
                    (p, idx) =>
                      idx > startIdx && !invalidIdSet.has(String(p.id)),
                  );
                  if (nextValidIdx !== -1) {
                    setCurrentPlayerIndex(nextValidIdx);
                    setCurrentPlayerId(sortedPlayers[nextValidIdx]?.id || null);
                  } else {
                    const firstValidIdx = sortedPlayers.findIndex(
                      (p) => !invalidIdSet.has(String(p.id)),
                    );
                    if (firstValidIdx !== -1) {
                      setCurrentPlayerIndex(firstValidIdx);
                      setCurrentPlayerId(sortedPlayers[firstValidIdx]?.id || null);
                    }
                  }
                }}
                className="btn btn-primary"
              >
                Skip to Next Valid Player ({validPlayers.length} available)
              </button>
            )}
            <button
              onClick={() => navigate(ROUTES.ADMIN_PLAYERS(auctionId))}
              className="btn btn-secondary"
            >
              Go to Players & Fix Groups
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- MAIN AUCTION UI ---
  return (
    <div className="h-screen overflow-hidden bg-gradient-to-br from-primary to-darkBg flex flex-col">
      <Header showBranding={true} />

      <div className="flex-1 p-2 sm:p-4 overflow-auto">
        <div className="max-w-7xl mx-auto h-full flex flex-col">
          {/* Auction Title */}
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-2 sm:mb-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-secondary truncate">
                  {auctionData?.name}
                </h1>
                {/* Phase/Mode Badge */}
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-bold whitespace-nowrap ${
                    isSequentialMode
                      ? "bg-blue-500 text-white"
                      : auctionPhase === 1
                        ? "bg-yellow-500 text-black"
                        : "bg-green-500 text-white"
                  }`}
                >
                  {isSequentialMode
                    ? `SEQ: ${normalizeGroupName(currentGroup?.group_name) || "—"}`
                    : auctionPhase === 1
                      ? "PHASE 1"
                      : "PHASE 2"}
                </span>
              </div>
              <p className="text-gray-300 text-[10px] sm:text-xs lg:text-sm">
                {soldCount} sold, {unsoldCount} unsold, {remainingCount}{" "}
                remaining
                {!isSequentialMode && auctionPhase === 1 && firstGroup && (
                  <span className="ml-1 sm:ml-2 text-yellow-300">
                    | {firstGroup.group_name}: {firstGroupSold}/
                    {firstGroupTotal}
                    {unsoldAplusIds.length > 0 &&
                      ` (+${unsoldAplusIds.length})`}
                  </span>
                )}
                {isSequentialMode && currentGroup && (
                  <span className="ml-1 sm:ml-2 text-blue-300">
                    | {normalizeGroupName(currentGroup.group_name, groupRules)}:{" "}
                    {currentGroupPlayers.filter((p) => p.soldTo).length}/
                    {currentGroupPlayers.length}
                  </span>
                )}
              </p>
            </div>
            <div className="flex gap-1 sm:gap-2 flex-wrap">
              <button
                onClick={toggleMute}
                className="btn btn-sm btn-secondary p-1.5 sm:p-2"
                title={isMuted ? "Unmute sounds" : "Mute sounds"}
              >
                {isMuted ? (
                  <IoVolumeMute size={14} />
                ) : (
                  <IoVolumeHigh size={14} />
                )}
              </button>
              <button
                onClick={() =>
                  window.open(ROUTES.PROJECTOR(auctionId), "_blank")
                }
                className="btn btn-sm btn-secondary p-1.5 sm:px-2 sm:py-1.5 flex items-center gap-1"
                title="Open Projector Screen"
              >
                <IoTv size={14} />
                <span className="hidden sm:inline text-xs">Projector</span>
              </button>
              <button
                onClick={() => navigate(ROUTES.ADMIN_PLAYERS(auctionId))}
                className="btn btn-sm btn-secondary p-1.5 sm:px-2 sm:py-1.5 flex items-center gap-1"
              >
                <IoPeople size={14} />
                <span className="hidden sm:inline text-xs">Players</span>
              </button>
              <button
                onClick={() => setShowStrategyInsights(!showStrategyInsights)}
                className={`btn btn-sm p-1.5 sm:px-2 sm:py-1.5 flex items-center gap-1 ${showStrategyInsights ? "bg-purple-600 text-white" : "btn-secondary"}`}
                title="Toggle Strategy Insights"
              >
                <IoFlash size={14} />
                <span className="hidden sm:inline text-xs">Strategy</span>
              </button>
              <button
                onClick={() => setAuctionPaused(!auctionPaused)}
                className={`btn btn-sm p-1.5 sm:px-2 sm:py-1.5 flex items-center gap-1 ${auctionPaused ? "btn-success" : "btn-danger"}`}
              >
                {auctionPaused ? <IoPlay size={14} /> : <IoPause size={14} />}
                <span className="hidden sm:inline text-xs">
                  {auctionPaused ? "Resume" : "Pause"}
                </span>
              </button>
              {unsoldPlayersList.length > 0 && (
                <button
                  onClick={() => setShowUnsoldPanel(true)}
                  className="btn btn-sm btn-secondary p-1.5 sm:px-2 sm:py-1.5 flex items-center gap-1"
                >
                  <IoRefresh size={14} />
                  <span className="text-xs">{unsoldPlayersList.length}</span>
                </button>
              )}
              <button
                onClick={() => undoLastBid(currentGroup?.base_price || 0)}
                className="btn btn-sm btn-secondary p-1.5 sm:px-2 sm:py-1.5 text-xs"
                disabled={isPlayerProcessed || bidHistory.length === 0}
              >
                Undo
              </button>
            </div>
          </div>

          {/* Group Progress Bar */}
          <div className="bg-white/10 rounded-lg p-2 mb-2 sm:mb-3">
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {groupsList.map((group) => {
                const gPlayers = sortedPlayers.filter(
                  (p) => String(p.group_id) === String(group.id),
                );
                // Only count SOLD players for progress (not unsold)
                const gDone = gPlayers.filter((p) => p.soldTo).length;
                const isActive =
                  currentGroup && String(group.id) === String(currentGroup.id);
                const isComplete =
                  gDone === gPlayers.length && gPlayers.length > 0;

                return (
                  <div
                    key={group.id}
                    className={`flex-shrink-0 px-2 sm:px-3 py-1 sm:py-1.5 rounded-md text-[10px] sm:text-xs font-bold ${
                      isActive
                        ? "bg-secondary text-primary"
                        : isComplete
                          ? "bg-green-500/20 text-green-300"
                          : "bg-white/5 text-gray-400"
                    }`}
                  >
                    {normalizeGroupName(group.group_name, groupRules) ||
                      group.group_name}{" "}
                    ({gDone}/{gPlayers.length})
                  </div>
                );
              })}
            </div>
          </div>

          {/* Main Content - Responsive Grid */}
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-2 sm:gap-4 min-h-0">
            {/* Player Card (Left) */}
            <div className="lg:col-span-1 min-h-0 flex flex-col">
              <div className="bg-white rounded-lg shadow-xl overflow-hidden relative flex-1 flex flex-col">
                {/* Sold / Unsold badge */}
                {isPlayerProcessed && (
                  <div
                    className={`absolute top-2 right-2 z-10 px-2 sm:px-3 py-1 rounded-full text-[10px] sm:text-xs font-bold animate-fade-in-up ${
                      currentPlayer.soldTo
                        ? "bg-success text-white"
                        : "bg-danger text-white"
                    }`}
                  >
                    {currentPlayer.soldTo ? "SOLD" : "UNSOLD"}
                  </div>
                )}

                {/* Hero Player Photo - Responsive height */}
                <div className="relative w-full h-40 sm:h-52 lg:h-60 xl:h-72 bg-gradient-to-br from-primary to-accent flex-shrink-0">
                  {/* Initial as background fallback */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-5xl sm:text-6xl lg:text-7xl font-bold text-white/30">
                      {currentPlayer.player_name?.charAt(0)}
                    </span>
                  </div>
                  {/* Photo overlay (if exists) */}
                  {currentPlayer.photo_url && (
                    <img
                      src={getImagePath(
                        "player-photo",
                        currentPlayer.photo_url,
                      )}
                      alt={currentPlayer.player_name}
                      className="absolute inset-0 w-full h-full object-cover"
                      onError={(e) => {
                        e.target.style.display = "none";
                      }}
                    />
                  )}
                  {/* Gradient overlay with name */}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3 sm:p-4">
                    <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-white mb-0.5">
                      {currentPlayer.player_name}
                    </h2>
                    <div className="flex items-center gap-2">
                      <span className="text-white/80 text-xs sm:text-sm">
                        Age: {currentPlayer.age}
                      </span>
                      <span className="bg-secondary text-primary px-1.5 py-0.5 rounded text-[10px] sm:text-xs font-bold">
                        {normalizeGroupName(
                          currentGroup.group_name,
                          groupRules,
                        ) || currentGroup.group_name}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Compact Info Row */}
                <div className="p-2 sm:p-3 flex-shrink-0">
                  <div className="flex items-center justify-between text-xs sm:text-sm">
                    <span className="text-textLight">
                      Base:{" "}
                      <span className="font-bold text-text">
                        ₹{(currentGroup.base_price || 0).toLocaleString()}
                      </span>
                    </span>
                    <span className="text-textLight">
                      Inc:{" "}
                      <span className="font-bold text-text">
                        ₹{currentGroup.increment_value.toLocaleString()}
                      </span>
                    </span>
                    {currentGroup.max_bid_cap && (
                      <span className="text-textLight">
                        Cap:{" "}
                        <span className="font-bold text-danger">
                          ₹{currentGroup.max_bid_cap.toLocaleString()}
                        </span>
                      </span>
                    )}
                  </div>
                  {currentPlayer.soldTo && (
                    <div className="flex justify-between mt-1.5 pt-1.5 border-t border-border text-xs sm:text-sm">
                      <span className="text-textLight">
                        Sold To:{" "}
                        <span className="font-bold text-success">
                          {teamsList.find(
                            (t) =>
                              String(t.id) === String(currentPlayer.soldTo),
                          )?.team_name || "Unknown"}
                        </span>
                      </span>
                      <span className="font-bold text-success">
                        ₹{(currentPlayer.soldPrice || 0).toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Navigation - Hidden on mobile when in bidding mode */}
              <div className="hidden lg:flex gap-2 mt-2">
                <button
                  onClick={() =>
                    setCurrentPlayerIndex(Math.max(0, currentPlayerIndex - 1))
                  }
                  disabled={currentPlayerIndex === 0}
                  className="btn btn-sm flex-1 disabled:opacity-50 text-xs"
                >
                  <IoArrowBack size={12} /> Prev
                </button>
                <button
                  onClick={() => {
                    const nextIdx = findNextUnsold();
                    if (nextIdx !== -1) {
                      setCurrentPlayerIndex(nextIdx);
                    } else {
                      setCurrentPlayerIndex(
                        Math.min(
                          sortedPlayers.length - 1,
                          currentPlayerIndex + 1,
                        ),
                      );
                    }
                  }}
                  disabled={currentPlayerIndex === sortedPlayers.length - 1}
                  className="btn btn-sm flex-1 disabled:opacity-50 text-xs"
                >
                  Next <IoArrowForward size={12} />
                </button>
              </div>
            </div>

            {/* Bidding Panel (Center) */}
            <div className="lg:col-span-1 min-h-0">
              <div className="bg-white rounded-lg shadow-xl p-3 sm:p-4 text-center h-full flex flex-col justify-center">
                {isPlayerProcessed ? (
                  <div>
                    <p className="text-textLight mb-1 text-xs sm:text-sm">
                      {currentPlayer.soldTo ? "Sold For" : "Status"}
                    </p>
                    <div
                      className={`text-2xl sm:text-4xl lg:text-5xl font-bold mb-3 sm:mb-4 animate-fade-in-up ${
                        currentPlayer.soldTo ? "text-success" : "text-danger"
                      }`}
                    >
                      {currentPlayer.soldTo
                        ? `₹${(currentPlayer.soldPrice || 0).toLocaleString()}`
                        : "UNSOLD"}
                    </div>
                    {currentPlayer.soldTo && (
                      <p className="text-sm sm:text-base text-text mb-3 sm:mb-4">
                        {
                          teamsList.find(
                            (t) =>
                              String(t.id) === String(currentPlayer.soldTo),
                          )?.team_name
                        }
                      </p>
                    )}
                    <button
                      onClick={() => {
                        advanceToNextPlayer();
                        // Reset bid for new player
                        const nextPlayer = getNextPlayer();
                        if (nextPlayer) {
                          const playerGroup = groupsList.find(
                            (g) => String(g.id) === String(nextPlayer.group_id),
                          );
                          if (playerGroup) {
                            resetBid(playerGroup.base_price || 0);
                          }
                        }
                      }}
                      disabled={!getNextPlayer()}
                      className="w-full btn btn-primary disabled:opacity-50 text-sm"
                    >
                      Next Player
                    </button>
                  </div>
                ) : (
                  <>
                    <p className="text-textLight mb-1 text-xs sm:text-sm">
                      Current Bid
                    </p>
                    <div className="mb-3 sm:mb-4 animate-pulse-bid">
                      <AnimatedNumber
                        value={currentBid}
                        className="text-3xl sm:text-4xl lg:text-5xl font-bold text-secondary"
                      />
                    </div>

                    {auctionPaused && (
                      <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-2 py-2 rounded-lg mb-3 text-xs sm:text-sm">
                        Auction is PAUSED
                      </div>
                    )}

                    <div className="space-y-2">
                      <button
                        onClick={handleIncrement}
                        disabled={auctionPaused}
                        className="w-full btn btn-primary disabled:opacity-50 text-xs sm:text-sm py-2"
                      >
                        Increment (+₹
                        {currentGroup.increment_value.toLocaleString()})
                      </button>

                      <button
                        onClick={handleDecrement}
                        disabled={
                          auctionPaused ||
                          currentBid <= (currentGroup.base_price || 0)
                        }
                        className="w-full btn btn-secondary disabled:opacity-50 text-xs sm:text-sm py-2"
                      >
                        Decrement (-₹
                        {currentGroup.increment_value.toLocaleString()})
                      </button>

                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => setShowWinnerModal(true)}
                          disabled={auctionPaused}
                          className="btn btn-success disabled:opacity-50 flex items-center justify-center gap-1 text-xs sm:text-sm py-2"
                        >
                          <IoCheckmark size={14} /> Sold
                        </button>
                        <button
                          onClick={handleMarkUnsold}
                          disabled={auctionPaused}
                          className="btn btn-danger disabled:opacity-50 flex items-center justify-center gap-1 text-xs sm:text-sm py-2"
                        >
                          <IoClose size={14} /> Unsold
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Teams Sidebar (Right) */}
            <div className="lg:col-span-1 min-h-0 overflow-auto">
              <div className="bg-white rounded-lg shadow-xl p-2 sm:p-3">
                <h3 className="text-sm sm:text-base font-bold text-primary mb-2">
                  Teams ({teamsList.length})
                </h3>
                <div className="space-y-1">
                  {teamsList.map((team) => {
                    const info = teamEligibility.find(
                      (e) => e.teamId === team.id,
                    );
                    const budgetExceeded =
                      info && !info.canAfford && !isPlayerProcessed;
                    const isIneligible =
                      info && !info.eligible && !isPlayerProcessed;

                    // Get insight for this team if strategy panel is open
                    const insight = showStrategyInsights
                      ? teamInsights.find((i) => i.teamId === team.id)
                      : null;

                    return (
                      <div
                        key={team.id}
                        className={`py-1.5 px-2 rounded-md border-l-4 transition group relative ${
                          budgetExceeded
                            ? "border-l-red-500 bg-red-50"
                            : isIneligible
                              ? "border-l-orange-400 bg-orange-50"
                              : "border-l-green-500 hover:bg-gray-50"
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-xs sm:text-sm text-text truncate flex-1 min-w-0">
                            {team.team_name}
                          </span>
                          <span
                            className={`text-[10px] sm:text-xs font-semibold whitespace-nowrap ${budgetExceeded ? "text-red-600" : "text-textLight"}`}
                          >
                            ₹{(team.budget_remaining || 0).toLocaleString()}
                          </span>
                          <span className="bg-primary/10 text-primary text-[10px] sm:text-xs font-bold px-1 py-0.5 rounded whitespace-nowrap">
                            {team.squad?.length || 0}/
                            {auctionData?.max_players_per_team || "∞"}
                          </span>
                          {isIneligible && (
                            <IoAlertCircle
                              className="text-red-500 flex-shrink-0"
                              size={14}
                              title={info.reasons.join(" | ")}
                            />
                          )}
                          {showStrategyInsights && (
                            <button
                              onClick={() => setSelectedTeamInsight(team.id)}
                              className="text-purple-600 hover:text-purple-800"
                              title="View full insights"
                            >
                              <IoFlash size={12} />
                            </button>
                          )}
                        </div>

                        {/* Strategy insight mini-view */}
                        {showStrategyInsights && insight && (
                          <div className="mt-1 pt-1 border-t border-gray-200 text-[10px] sm:text-xs">
                            <div className="flex items-center gap-1 mb-0.5">
                              <span
                                className={`px-1 py-0.5 rounded font-semibold ${getRiskColorClass(insight.budgetAnalysis.riskLevel)}`}
                              >
                                {insight.budgetAnalysis.riskLevel.icon}{" "}
                                {insight.budgetAnalysis.riskLevel.level}
                              </span>
                              <span className="text-gray-500">
                                ₹
                                {insight.budgetAnalysis.flexibleBudget.toLocaleString()}
                              </span>
                            </div>
                            {insight.bidRecommendation &&
                              insight.bidRecommendation.canBid && (
                                <div className="text-gray-600">
                                  Max:{" "}
                                  <span className="font-semibold text-green-700">
                                    ₹
                                    {insight.bidRecommendation.maxSafeBid.toLocaleString()}
                                  </span>
                                </div>
                              )}
                          </div>
                        )}

                        {/* Tooltip on hover */}
                        {isIneligible &&
                          info.reasons.length > 0 &&
                          !showStrategyInsights && (
                            <div className="absolute bottom-full left-0 mb-1 hidden group-hover:block z-20 bg-gray-900 text-white text-[10px] rounded px-1.5 py-1 whitespace-nowrap shadow-lg">
                              {info.reasons.join(" | ")}
                            </div>
                          )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Unsold Players Panel */}
      <Modal
        isOpen={showUnsoldPanel}
        title={`Unsold Players (${unsoldPlayersList.length})`}
        onClose={() => setShowUnsoldPanel(false)}
      >
        {unsoldPlayersList.length === 0 ? (
          <p className="text-textLight py-4 text-center">No unsold players</p>
        ) : (
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {unsoldPlayersList.map((player) => {
              const group = groupsList.find(
                (g) => String(g.id) === String(player.group_id),
              );
              return (
                <div
                  key={player.id}
                  className="flex justify-between items-center p-3 border-2 border-border rounded-lg"
                >
                  <div>
                    <p className="font-bold text-text">{player.player_name}</p>
                    <p className="text-xs text-textLight">
                      {group?.group_name || "Unknown"} | Base: ₹
                      {(group?.base_price || 0).toLocaleString()}
                    </p>
                  </div>
                  <button
                    onClick={() => handleReauction(player)}
                    className="btn btn-sm btn-primary flex items-center gap-1"
                  >
                    <IoRefresh size={14} /> Re-auction
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </Modal>

      {/* Winner Selection Modal */}
      <Modal
        isOpen={showWinnerModal}
        title={`Who bought ${currentPlayer.player_name}?`}
        onClose={() => setShowWinnerModal(false)}
      >
        <p className="text-sm text-textLight mb-3">
          Current Bid:{" "}
          <span className="font-bold text-secondary">
            ₹{currentBid.toLocaleString()}
          </span>
        </p>
        <div className="space-y-3 max-h-60 overflow-y-auto">
          {teamsList.map((team) => {
            const info = teamEligibility.find((e) => e.teamId === team.id);
            const disabled = info && !info.eligible;

            return (
              <button
                key={team.id}
                onClick={() => handleSoldToTeam(team.id)}
                disabled={disabled}
                className={`w-full p-4 text-left border-2 rounded-lg transition flex items-start gap-3 ${
                  disabled
                    ? "border-gray-200 bg-gray-100 opacity-50 cursor-not-allowed"
                    : "border-border hover:border-primary hover:bg-lightBg"
                }`}
              >
                {team.team_logo && (
                  <img
                    src={getImagePath("team-logo", team.team_logo)}
                    alt={team.team_name}
                    className="w-12 h-12 object-contain rounded border border-border flex-shrink-0"
                    onError={(e) => {
                      e.target.style.display = "none";
                    }}
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div
                    className={`font-bold ${disabled ? "text-gray-400" : "text-primary"}`}
                  >
                    {team.team_name}
                  </div>
                  <div className="text-sm text-textLight">
                    {team.owner_name}
                  </div>
                  <div className="text-sm font-semibold text-text mt-1">
                    Remaining: ₹{(team.budget_remaining || 0).toLocaleString()}
                    {auctionData?.max_players_per_team && (
                      <span className="ml-2">
                        | Squad: {team.squad?.length || 0}/
                        {auctionData.max_players_per_team}
                      </span>
                    )}
                    {currentGroup?.max_per_team && info && (
                      <span className="ml-2">
                        | Group: {info.groupCount}/{currentGroup.max_per_team}
                      </span>
                    )}
                  </div>
                  {disabled && info.reasons.length > 0 && (
                    <div className="text-xs text-red-500 font-semibold mt-1">
                      {info.reasons.join(" | ")}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </Modal>

      {/* Strategy Insights Detail Modal */}
      <Modal
        isOpen={selectedTeamInsight !== null}
        title={`Strategy Insights - ${selectedInsight?.teamName || "Team"}`}
        onClose={() => setSelectedTeamInsight(null)}
      >
        {selectedInsight && (
          <div className="space-y-4 max-h-[70vh] overflow-y-auto">
            {/* Budget Summary */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-bold text-primary mb-2 flex items-center gap-2">
                💰 Budget Analysis
                <span
                  className={`px-2 py-0.5 rounded text-xs font-semibold ${getRiskColorClass(selectedInsight.budgetAnalysis.riskLevel)}`}
                >
                  {selectedInsight.budgetAnalysis.riskLevel.icon}{" "}
                  {selectedInsight.budgetAnalysis.riskLevel.level}
                </span>
              </h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-gray-500">Remaining:</span>
                  <span className="font-semibold ml-1">
                    ₹{selectedInsight.budgetAnalysis.budget.toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Slots Left:</span>
                  <span className="font-semibold ml-1">
                    {selectedInsight.budgetAnalysis.slotsRemaining}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Must Reserve:</span>
                  <span className="font-semibold ml-1 text-orange-600">
                    ₹
                    {selectedInsight.budgetAnalysis.mandatoryReserve.toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Flexible:</span>
                  <span
                    className={`font-semibold ml-1 ${selectedInsight.budgetAnalysis.flexibleBudget < 300 ? "text-red-600" : "text-green-600"}`}
                  >
                    ₹
                    {selectedInsight.budgetAnalysis.flexibleBudget.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Bid Recommendation */}
            {selectedInsight.bidRecommendation && currentPlayer && (
              <div className="bg-purple-50 rounded-lg p-4">
                <h4 className="font-bold text-purple-700 mb-2">
                  🎯 Bid Recommendation
                </h4>
                <p className="text-sm text-gray-700 mb-2">
                  <span className="font-semibold">
                    For {currentPlayer.player_name}:
                  </span>{" "}
                  {selectedInsight.bidRecommendation.reason}
                </p>
                {selectedInsight.bidRecommendation.canBid ? (
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div className="bg-green-100 rounded p-2 text-center">
                      <div className="text-xs text-green-600">Conservative</div>
                      <div className="font-bold text-green-700">
                        ₹
                        {selectedInsight.bidRecommendation.conservativeBid.toLocaleString()}
                      </div>
                    </div>
                    <div className="bg-yellow-100 rounded p-2 text-center">
                      <div className="text-xs text-yellow-600">Balanced</div>
                      <div className="font-bold text-yellow-700">
                        ₹
                        {selectedInsight.bidRecommendation.balancedBid.toLocaleString()}
                      </div>
                    </div>
                    <div className="bg-red-100 rounded p-2 text-center">
                      <div className="text-xs text-red-600">Max Safe</div>
                      <div className="font-bold text-red-700">
                        ₹
                        {selectedInsight.bidRecommendation.maxSafeBid.toLocaleString()}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-red-100 text-red-700 rounded p-2 text-sm">
                    ⚠️ {selectedInsight.bidRecommendation.reason}
                  </div>
                )}
              </div>
            )}

            {/* Group Requirements */}
            <div className="bg-blue-50 rounded-lg p-4">
              <h4 className="font-bold text-blue-700 mb-2">
                📊 Group Requirements
              </h4>
              <div className="space-y-2">
                {selectedInsight.groupOpportunities.map((opp) => (
                  <div
                    key={opp.group}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="font-semibold">{opp.group}</span>
                    <div className="flex items-center gap-2">
                      <span
                        className={
                          opp.fulfilled ? "text-green-600" : "text-orange-600"
                        }
                      >
                        {opp.current}/{opp.min}
                      </span>
                      {opp.fulfilled ? (
                        <span className="text-green-600 text-xs">✅</span>
                      ) : (
                        <span className="text-orange-600 text-xs">
                          Need {opp.needed}
                        </span>
                      )}
                      {opp.urgent && !opp.fulfilled && (
                        <span className="text-red-600 text-xs">
                          ⚠️ Only {opp.available} left!
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Warnings */}
            {selectedInsight.warnings.length > 0 && (
              <div className="bg-red-50 rounded-lg p-4">
                <h4 className="font-bold text-red-700 mb-2">⚠️ Warnings</h4>
                <div className="space-y-2">
                  {selectedInsight.warnings.map((warning, idx) => (
                    <div key={idx} className="text-sm">
                      <span className="font-semibold">
                        {warning.icon} {warning.title}
                      </span>
                      <p className="text-gray-600 text-xs">{warning.message}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Summary */}
            <div className="text-center text-sm text-gray-600 border-t pt-3">
              {selectedInsight.summary}
            </div>
          </div>
        )}
      </Modal>

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  );
};

export default AdminLive;
