import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useBidding } from "../../hooks/useBidding";
import { useRealtimeData } from "../../hooks/useRealtimeData";
import { useToast } from "../../components/Toast";
import { ToastContainer } from "../../components/ToastContainer";
import { Modal } from "../../components/Modal";
import { firebaseObjectToArray } from "../../utils/dataTransformUtils";
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
} from "react-icons/io5";
import { ref, update } from "firebase/database";
import { db } from "../../utils/firebaseConfig";

export const AdminLive = () => {
  const { auctionId } = useParams();
  const navigate = useNavigate();
  const { toasts, showToast, removeToast } = useToast();

  // Real-time data
  const { data: auctionData, error: auctionError } = useRealtimeData(`auctions/${auctionId}`);
  const { data: playersData, error: playersError } = useRealtimeData(
    `auctions/${auctionId}/players`,
  );
  const { data: teamsData, error: teamsError } = useRealtimeData(`auctions/${auctionId}/teams`);
  const { data: groupsData, error: groupsError } = useRealtimeData(`auctions/${auctionId}/groups`);

  // Auction state
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0);
  const [auctionPaused, setAuctionPaused] = useState(false);
  const [showWinnerModal, setShowWinnerModal] = useState(false);
  const [showUnsoldPanel, setShowUnsoldPanel] = useState(false);
  const [initialAdvanceDone, setInitialAdvanceDone] = useState(false);

  // Bidding state
  const { currentBid, bidHistory, incrementBid, decrementBid, undoLastBid, resetBid } =
    useBidding(auctionId, null);

  // Get data arrays
  const playersList = firebaseObjectToArray(playersData);
  const teamsList = firebaseObjectToArray(teamsData);
  const groupsList = firebaseObjectToArray(groupsData);

  // Sort players by group order (groups are in Firebase creation order)
  const sortedPlayers = useMemo(() => {
    if (playersList.length === 0 || groupsList.length === 0) return [];
    const groupOrderMap = new Map(groupsList.map((g, idx) => [String(g.id), idx]));
    return [...playersList].sort((a, b) => {
      const aIdx = groupOrderMap.get(String(a.group_id)) ?? 999;
      const bIdx = groupOrderMap.get(String(b.group_id)) ?? 999;
      return aIdx - bIdx;
    });
  }, [playersList, groupsList]);

  const currentPlayer = sortedPlayers[currentPlayerIndex];
  const currentGroup = currentPlayer
    ? groupsList.find((g) => String(g.id) === String(currentPlayer.group_id))
    : null;

  // Compute team eligibility for current bid
  const teamEligibility = useMemo(() => {
    const maxSquadSize = Number(auctionData?.max_players_per_team) || Infinity;
    const groupMaxPerTeam = Number(currentGroup?.max_per_team) || Infinity;
    const currentGroupId = currentGroup ? String(currentGroup.id) : null;

    return teamsList.map((team) => {
      const squadSize = team.squad?.length || 0;
      const budgetRemaining = Number(team.budget_remaining) || 0;
      const bid = Number(currentBid) || 0;
      const canAfford = budgetRemaining >= bid;
      const squadFull = squadSize >= maxSquadSize;

      // Count how many players this team bought from the current group
      let groupCount = 0;
      if (currentGroupId) {
        const teamSquadIds = (team.squad || []).map(String);
        groupCount = sortedPlayers.filter(
          (p) =>
            String(p.group_id) === currentGroupId &&
            p.soldTo &&
            teamSquadIds.includes(String(p.id)),
        ).length;
      }
      const groupFull = groupMaxPerTeam !== Infinity && groupCount >= groupMaxPerTeam;

      const eligible = canAfford && !squadFull && !groupFull;
      const reasons = [];
      if (!canAfford) reasons.push(`Budget ₹${budgetRemaining.toLocaleString()} < Bid ₹${bid.toLocaleString()}`);
      if (squadFull) reasons.push(`Squad full (${maxSquadSize})`);
      if (groupFull) reasons.push(`Group limit (${groupMaxPerTeam})`);

      return {
        teamId: team.id,
        eligible,
        canAfford,
        squadFull,
        groupFull,
        groupCount,
        reasons,
      };
    });
  }, [teamsList, currentBid, currentGroup, sortedPlayers, auctionData?.max_players_per_team]);

  // Derived auction progress
  const isPlayerProcessed = !!(currentPlayer?.soldTo || currentPlayer?.unsold);
  const soldCount = sortedPlayers.filter((p) => p.soldTo).length;
  const unsoldCount = sortedPlayers.filter((p) => p.unsold).length;
  const remainingCount = sortedPlayers.length - soldCount - unsoldCount;
  const isAuctionComplete = remainingCount === 0 && sortedPlayers.length > 0;

  // Group-level progress for the current group
  const currentGroupPlayers = currentGroup
    ? sortedPlayers.filter((p) => String(p.group_id) === String(currentGroup.id))
    : [];
  const currentGroupProcessed = currentGroupPlayers.filter(
    (p) => p.soldTo || p.unsold,
  ).length;

  // Find the next unprocessed player after a given index
  const findNextUnsold = (afterIndex = currentPlayerIndex) => {
    for (let i = afterIndex + 1; i < sortedPlayers.length; i++) {
      if (!sortedPlayers[i].soldTo && !sortedPlayers[i].unsold) return i;
    }
    return -1;
  };

  // Initialize bid when switching to a new unsold player
  useEffect(() => {
    if (currentPlayer && currentGroup && !isPlayerProcessed) {
      resetBid(currentGroup.base_price || 0);
    }
  }, [currentPlayerIndex, currentPlayer?.id, currentGroup?.base_price, isPlayerProcessed, resetBid]);

  // On initial load, advance to the first unsold player
  useEffect(() => {
    if (initialAdvanceDone || sortedPlayers.length === 0) return;
    setInitialAdvanceDone(true);
    const first = sortedPlayers[0];
    if (first && (first.soldTo || first.unsold)) {
      const nextIdx = findNextUnsold(-1);
      if (nextIdx !== -1) setCurrentPlayerIndex(nextIdx);
    }
  }, [sortedPlayers.length, initialAdvanceDone]);

  // Handle increment
  const handleIncrement = async () => {
    if (!currentGroup || isPlayerProcessed) return;
    try {
      const newBid = await incrementBid(
        currentGroup.increment_value,
        currentGroup.max_bid_cap,
        null,
      );
      showToast(`Bid increased to ₹${newBid.toLocaleString()}`, "success");
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
      const newBid = await decrementBid(currentGroup.increment_value);
      if (newBid >= (currentGroup.base_price || 0)) {
        showToast(`Bid decreased to ₹${newBid.toLocaleString()}`, "success");
      }
    } catch (error) {
      showToast(error.message, "error");
    }
  };

  // Mark player as unsold and advance
  const handleMarkUnsold = async () => {
    if (!currentPlayer || isPlayerProcessed) return;
    try {
      const playerRef = ref(db, `auctions/${auctionId}/players/${currentPlayer.id}`);
      await update(playerRef, { unsold: true });
      showToast(`${currentPlayer.player_name} marked as unsold`, "info");
      const nextIdx = findNextUnsold();
      if (nextIdx !== -1) setCurrentPlayerIndex(nextIdx);
    } catch (error) {
      showToast("Error: " + error.message, "error");
    }
  };

  // List of unsold players (for the re-auction panel)
  const unsoldPlayersList = sortedPlayers.filter((p) => p.unsold && !p.soldTo);

  // Bring an unsold player back into the auction
  const handleReauction = async (player) => {
    try {
      const playerRef = ref(db, `auctions/${auctionId}/players/${player.id}`);
      await update(playerRef, { unsold: null });
      showToast(`${player.player_name} added back to auction`, "success");
      // Navigate to this player
      const playerIdx = sortedPlayers.findIndex((p) => p.id === player.id);
      if (playerIdx !== -1) setCurrentPlayerIndex(playerIdx);
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
      });

      const teamRef = ref(db, `auctions/${auctionId}/teams/${teamId}`);
      const selectedTeam = teamsList.find((t) => String(t.id) === String(teamId));
      if (!selectedTeam) {
        throw new Error(`Team with ID ${teamId} not found`);
      }

      await update(teamRef, {
        squad: [...(selectedTeam.squad || []), currentPlayer.id],
        budget_remaining: Number(selectedTeam.budget_remaining || 0) - Number(currentBid),
      });

      showToast(
        `${currentPlayer.player_name} sold to ${selectedTeam.team_name}!`,
        "success",
      );
      setShowWinnerModal(false);

      // Advance to next unsold player
      const nextIdx = findNextUnsold();
      if (nextIdx !== -1) {
        setCurrentPlayerIndex(nextIdx);
      }
    } catch (error) {
      showToast("Error updating auction: " + error.message, "error");
    }
  };

  // --- RENDER ---

  const isLoading = !auctionData || !playersData || !teamsData || !groupsData;
  const hasError = auctionError || playersError || teamsError || groupsError;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-lightBg">
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
      <div className="min-h-screen flex items-center justify-center bg-lightBg">
        <div className="text-center max-w-md">
          <p className="text-xl text-textLight mb-4">No players added to this auction!</p>
          <p className="text-textLight mb-6">Please add players before starting the live auction.</p>
          <a href={`/admin/players/${auctionId}`} className="btn btn-primary">
            Go Back to Add Players
          </a>
        </div>
      </div>
    );
  }

  // --- AUCTION COMPLETE SCREEN ---
  if (isAuctionComplete) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary to-darkBg flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-2xl p-8 max-w-lg w-full text-center">
          <h1 className="text-3xl font-bold text-primary mb-2">Auction Complete!</h1>
          <p className="text-textLight mb-6">All {sortedPlayers.length} players have been processed.</p>

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
              const spent = team.budget_total - (team.budget_remaining || 0);
              return (
                <div
                  key={team.id}
                  className="flex justify-between items-center p-3 bg-lightBg rounded-lg"
                >
                  <div>
                    <p className="font-bold text-primary">{team.team_name}</p>
                    <p className="text-xs text-textLight">{teamPlayerCount} players</p>
                  </div>
                  <p className="font-bold text-text">₹{spent.toLocaleString()}</p>
                </div>
              );
            })}
          </div>

          <div className="flex gap-4 justify-center">
            <a href={ROUTES.ADMIN_RESULTS(auctionId)} className="btn btn-primary">
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
                Unsold Players ({unsoldPlayersList.length}) - Bring back for re-auction?
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
                        <p className="font-semibold text-text text-sm">{player.player_name}</p>
                        <p className="text-xs text-textLight">
                          {group?.group_name} | ₹{(group?.base_price || 0).toLocaleString()}
                        </p>
                      </div>
                      <button
                        onClick={async () => {
                          const playerRef = ref(db, `auctions/${auctionId}/players/${player.id}`);
                          await update(playerRef, { unsold: null });
                          showToast(`${player.player_name} added back to auction`, "success");
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

  // Invalid group fallback
  if (!currentPlayer || !currentGroup) {
    const validPlayers = sortedPlayers.filter((p) =>
      groupsList.find((g) => String(g.id) === String(p.group_id))
    );
    const invalidCount = sortedPlayers.length - validPlayers.length;

    return (
      <div className="min-h-screen flex items-center justify-center bg-lightBg">
        <div className="text-center max-w-lg">
          <p className="text-xl text-textLight mb-4">Player has invalid group assignment</p>
          <p className="text-textLight mb-4">
            Player <strong>"{currentPlayer?.player_name}"</strong> (#{currentPlayerIndex + 1}) has a group_id that doesn't match any group.
          </p>
          <p className="text-sm text-danger mb-6">
            {invalidCount} of {sortedPlayers.length} player(s) have invalid groups. Delete them on the Players page and re-add.
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            {validPlayers.length > 0 && (
              <button
                onClick={() => {
                  const nextValidIdx = sortedPlayers.findIndex(
                    (p, idx) =>
                      idx > currentPlayerIndex &&
                      groupsList.find((g) => String(g.id) === String(p.group_id)),
                  );
                  if (nextValidIdx !== -1) {
                    setCurrentPlayerIndex(nextValidIdx);
                  } else {
                    const firstValidIdx = sortedPlayers.findIndex((p) =>
                      groupsList.find((g) => String(g.id) === String(p.group_id)),
                    );
                    if (firstValidIdx !== -1) setCurrentPlayerIndex(firstValidIdx);
                  }
                }}
                className="btn btn-primary"
              >
                Skip to Next Valid Player ({validPlayers.length} available)
              </button>
            )}
            <a href={`/admin/players/${auctionId}`} className="btn btn-secondary">
              Go to Players Page
            </a>
          </div>
        </div>
      </div>
    );
  }

  // --- MAIN AUCTION UI ---
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary to-darkBg p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-4xl font-bold text-secondary">
              {auctionData?.name}
            </h1>
            <p className="text-gray-300">
              Player {currentPlayerIndex + 1} of {sortedPlayers.length} | {soldCount} sold, {unsoldCount} unsold, {remainingCount} remaining
            </p>
          </div>
          <div className="flex gap-3 flex-wrap">
            <button
              onClick={() => navigate(ROUTES.ADMIN_PLAYERS(auctionId))}
              className="btn btn-secondary flex items-center gap-2"
            >
              <IoPeople size={18} /> Players
            </button>
            <button
              onClick={() => setAuctionPaused(!auctionPaused)}
              className={`btn flex items-center gap-2 ${auctionPaused ? "btn-success" : "btn-danger"}`}
            >
              {auctionPaused ? <IoPlay size={20} /> : <IoPause size={20} />}
              {auctionPaused ? "Resume" : "Pause"}
            </button>
            {unsoldPlayersList.length > 0 && (
              <button
                onClick={() => setShowUnsoldPanel(true)}
                className="btn btn-secondary flex items-center gap-2"
              >
                <IoRefresh size={18} /> Unsold ({unsoldPlayersList.length})
              </button>
            )}
            <button
              onClick={() => undoLastBid(currentGroup?.base_price || 0)}
              className="btn btn-secondary"
              disabled={isPlayerProcessed || bidHistory.length === 0}
            >
              Undo
            </button>
          </div>
        </div>

        {/* Group Progress Bar */}
        <div className="bg-white/10 rounded-lg p-3 mb-6">
          <div className="flex items-center gap-3 overflow-x-auto">
            {groupsList.map((group) => {
              const gPlayers = sortedPlayers.filter(
                (p) => String(p.group_id) === String(group.id),
              );
              const gDone = gPlayers.filter((p) => p.soldTo || p.unsold).length;
              const isActive = currentGroup && String(group.id) === String(currentGroup.id);
              const isComplete = gDone === gPlayers.length && gPlayers.length > 0;

              return (
                <div
                  key={group.id}
                  className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-bold ${
                    isActive
                      ? "bg-secondary text-primary"
                      : isComplete
                        ? "bg-green-500/20 text-green-300"
                        : "bg-white/5 text-gray-400"
                  }`}
                >
                  {group.group_name} ({gDone}/{gPlayers.length})
                </div>
              );
            })}
          </div>
        </div>

        {/* Main Content */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Player Card (Left) */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-xl overflow-hidden relative">
              {/* Sold / Unsold badge */}
              {isPlayerProcessed && (
                <div
                  className={`absolute top-4 right-4 z-10 px-3 py-1 rounded-full text-sm font-bold ${
                    currentPlayer.soldTo
                      ? "bg-success text-white"
                      : "bg-danger text-white"
                  }`}
                >
                  {currentPlayer.soldTo ? "SOLD" : "UNSOLD"}
                </div>
              )}

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

              {/* Player Info */}
              <div className="p-6">
                <h2 className="text-2xl font-bold text-primary mb-4">
                  {currentPlayer.player_name}
                </h2>

                <div className="space-y-3 mb-6">
                  <div className="flex justify-between">
                    <span className="text-textLight">Age:</span>
                    <span className="font-bold text-text">{currentPlayer.age}</span>
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
                      ₹{(currentGroup.base_price || 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-textLight">Increment:</span>
                    <span className="font-bold text-text">
                      ₹{currentGroup.increment_value.toLocaleString()}
                    </span>
                  </div>
                  {currentGroup.max_bid_cap && (
                    <div className="flex justify-between pt-3 border-t border-border">
                      <span className="text-textLight">Max Cap:</span>
                      <span className="font-bold text-danger">
                        ₹{currentGroup.max_bid_cap.toLocaleString()}
                      </span>
                    </div>
                  )}
                  {currentPlayer.soldTo && (
                    <div className="flex justify-between pt-3 border-t border-border">
                      <span className="text-textLight">Sold To:</span>
                      <span className="font-bold text-success">
                        {teamsList.find((t) => String(t.id) === String(currentPlayer.soldTo))?.team_name || "Unknown"}
                      </span>
                    </div>
                  )}
                  {currentPlayer.soldPrice && (
                    <div className="flex justify-between">
                      <span className="text-textLight">Sold Price:</span>
                      <span className="font-bold text-success">
                        ₹{currentPlayer.soldPrice.toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Navigation */}
            <div className="flex gap-4 mt-4">
              <button
                onClick={() =>
                  setCurrentPlayerIndex(Math.max(0, currentPlayerIndex - 1))
                }
                disabled={currentPlayerIndex === 0}
                className="btn btn-sm flex-1 disabled:opacity-50"
              >
                <IoArrowBack /> Prev
              </button>
              <button
                onClick={() => {
                  const nextIdx = findNextUnsold();
                  if (nextIdx !== -1) {
                    setCurrentPlayerIndex(nextIdx);
                  } else {
                    setCurrentPlayerIndex(
                      Math.min(sortedPlayers.length - 1, currentPlayerIndex + 1),
                    );
                  }
                }}
                disabled={currentPlayerIndex === sortedPlayers.length - 1}
                className="btn btn-sm flex-1 disabled:opacity-50"
              >
                Next <IoArrowForward />
              </button>
            </div>
          </div>

          {/* Bidding Panel (Center) */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-xl p-8 text-center">
              {isPlayerProcessed ? (
                <div>
                  <p className="text-textLight mb-2">
                    {currentPlayer.soldTo ? "Sold For" : "Status"}
                  </p>
                  <div
                    className={`text-5xl font-bold mb-6 ${
                      currentPlayer.soldTo ? "text-success" : "text-danger"
                    }`}
                  >
                    {currentPlayer.soldTo
                      ? `₹${(currentPlayer.soldPrice || 0).toLocaleString()}`
                      : "UNSOLD"}
                  </div>
                  {currentPlayer.soldTo && (
                    <p className="text-lg text-text mb-6">
                      {teamsList.find((t) => String(t.id) === String(currentPlayer.soldTo))?.team_name}
                    </p>
                  )}
                  <button
                    onClick={() => {
                      const nextIdx = findNextUnsold();
                      if (nextIdx !== -1) setCurrentPlayerIndex(nextIdx);
                    }}
                    disabled={findNextUnsold() === -1}
                    className="w-full btn btn-primary btn-lg disabled:opacity-50"
                  >
                    Next Unsold Player
                  </button>
                </div>
              ) : (
                <>
                  <p className="text-textLight mb-2">Current Bid</p>
                  <div className="text-6xl font-bold text-secondary mb-8 animate-pulse-bid">
                    ₹{currentBid.toLocaleString()}
                  </div>

                  {auctionPaused && (
                    <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded-lg mb-6">
                      Auction is PAUSED
                    </div>
                  )}

                  <div className="space-y-4">
                    <button
                      onClick={handleIncrement}
                      disabled={auctionPaused}
                      className="w-full btn btn-primary btn-lg disabled:opacity-50"
                    >
                      Increment (+₹{currentGroup.increment_value.toLocaleString()})
                    </button>

                    <button
                      onClick={handleDecrement}
                      disabled={
                        auctionPaused ||
                        currentBid <= (currentGroup.base_price || 0)
                      }
                      className="w-full btn btn-secondary btn-lg disabled:opacity-50"
                    >
                      Decrement (-₹{currentGroup.increment_value.toLocaleString()})
                    </button>

                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => setShowWinnerModal(true)}
                        disabled={auctionPaused}
                        className="btn btn-success btn-lg disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        <IoCheckmark size={20} /> Sold
                      </button>
                      <button
                        onClick={handleMarkUnsold}
                        disabled={auctionPaused}
                        className="btn btn-danger btn-lg disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        <IoClose size={20} /> Unsold
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Teams Sidebar (Right) */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-xl p-6">
              <h3 className="text-xl font-bold text-primary mb-4">
                Teams ({teamsList.length})
              </h3>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {teamsList.map((team) => {
                  const info = teamEligibility.find((e) => e.teamId === team.id);
                  const budgetExceeded = info && !info.canAfford && !isPlayerProcessed;
                  const isIneligible = info && !info.eligible && !isPlayerProcessed;

                  return (
                  <div
                    key={team.id}
                    className={`p-4 border-2 rounded-lg transition ${
                      budgetExceeded
                        ? "border-red-400 bg-red-50"
                        : isIneligible
                          ? "border-orange-300 bg-orange-50"
                          : "border-border hover:border-primary"
                    }`}
                  >
                    <p className="font-bold text-text">{team.team_name}</p>
                    <p className="text-sm text-textLight mb-2">
                      {team.owner_name}
                    </p>
                    <div className="mb-3">
                      <div className="flex justify-between text-xs mb-1">
                        <span>Budget</span>
                        <span className={`font-bold ${budgetExceeded ? "text-red-600" : ""}`}>
                          ₹{(team.budget_remaining || 0).toLocaleString()}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${budgetExceeded ? "bg-red-500" : "bg-primary"}`}
                          style={{
                            width: `${Math.max(0, (team.budget_remaining / team.budget_total) * 100)}%`,
                          }}
                        ></div>
                      </div>
                    </div>
                    <div className="flex justify-between text-xs text-textLight">
                      <span>Squad: {team.squad?.length || 0}{auctionData?.max_players_per_team ? `/${auctionData.max_players_per_team}` : ""}</span>
                      {currentGroup?.max_per_team && info && (
                        <span>Group: {info.groupCount}/{currentGroup.max_per_team}</span>
                      )}
                    </div>
                    {isIneligible && info.reasons.length > 0 && (
                      <p className="text-xs text-red-500 mt-1 font-semibold">
                        {info.reasons.join(" | ")}
                      </p>
                    )}
                  </div>
                  );
                })}
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
                      {group?.group_name || "Unknown"} | Base: ₹{(group?.base_price || 0).toLocaleString()}
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
          Current Bid: <span className="font-bold text-secondary">₹{currentBid.toLocaleString()}</span>
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
                className={`w-full p-4 text-left border-2 rounded-lg transition ${
                  disabled
                    ? "border-gray-200 bg-gray-100 opacity-50 cursor-not-allowed"
                    : "border-border hover:border-primary hover:bg-lightBg"
                }`}
              >
                <div className={`font-bold ${disabled ? "text-gray-400" : "text-primary"}`}>
                  {team.team_name}
                </div>
                <div className="text-sm text-textLight">{team.owner_name}</div>
                <div className="text-sm font-semibold text-text mt-1">
                  Remaining: ₹{(team.budget_remaining || 0).toLocaleString()}
                  {auctionData?.max_players_per_team && (
                    <span className="ml-2">| Squad: {team.squad?.length || 0}/{auctionData.max_players_per_team}</span>
                  )}
                  {currentGroup?.max_per_team && info && (
                    <span className="ml-2">| Group: {info.groupCount}/{currentGroup.max_per_team}</span>
                  )}
                </div>
                {disabled && info.reasons.length > 0 && (
                  <div className="text-xs text-red-500 font-semibold mt-1">
                    {info.reasons.join(" | ")}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </Modal>

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  );
};

export default AdminLive;
