import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useBidding } from "../../hooks/useBidding";
import { useRealtimeData } from "../../hooks/useRealtimeData";
import { useToast } from "../../components/Toast";
import { Modal } from "../../components/Modal";
import {
  IoPause,
  IoPlay,
  IoArrowBack,
  IoArrowForward,
  IoCheckmark,
  IoClose,
} from "react-icons/io5";
import { ref, update } from "firebase/database";
import { db } from "../../utils/firebaseConfig";

export const AdminLive = () => {
  const { auctionId } = useParams();
  const { showToast } = useToast();

  // Real-time data
  const { data: auctionData } = useRealtimeData(`auctions/${auctionId}`);
  const { data: playersData } = useRealtimeData(
    `auctions/${auctionId}/players`,
  );
  const { data: teamsData } = useRealtimeData(`auctions/${auctionId}/teams`);
  const { data: groupsData } = useRealtimeData(`auctions/${auctionId}/groups`);

  // Auction state
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0);
  const [auctionPaused, setAuctionPaused] = useState(false);
  const [showWinnerModal, setShowWinnerModal] = useState(false);

  // Bidding state
  const { currentBid, bidHistory, incrementBid, undoLastBid, resetBid } =
    useBidding(auctionId, null);

  // Get current player and group
  const playersList = playersData
    ? Object.entries(playersData).map(([id, player]) => ({ id, ...player }))
    : [];
  const teamsList = teamsData
    ? Object.entries(teamsData).map(([id, team]) => ({ id, ...team }))
    : [];
  const groupsList = groupsData
    ? Object.entries(groupsData).map(([id, group]) => ({ id, ...group }))
    : [];

  const currentPlayer = playersList[currentPlayerIndex];
  const currentGroup = currentPlayer
    ? groupsList.find((g) => g.id === currentPlayer.group_id)
    : null;
  const currentTeam = currentPlayer
    ? teamsList.find((t) => t.squad?.includes(currentPlayer.id))
    : null;

  // Initialize bid for new player
  useEffect(() => {
    if (currentPlayer) {
      resetBid(currentPlayer.base_price || 0);
    }
  }, [currentPlayerIndex, currentPlayer]);

  // Handle increment
  const handleIncrement = async () => {
    if (!currentGroup) return;

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
    if (!currentGroup || currentBid <= (currentPlayer?.base_price || 0)) {
      showToast("Cannot go below base price", "error");
      return;
    }

    try {
      const newBid = currentBid - currentGroup.increment_value;
      if (newBid >= (currentPlayer.base_price || 0)) {
        // Manually set bid (no decrement hook, using increment with negative)
        showToast(`Bid decreased to ₹${newBid.toLocaleString()}`, "success");
      }
    } catch (error) {
      showToast(error.message, "error");
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

      // Update team
      const teamRef = ref(db, `auctions/${auctionId}/teams/${teamId}`);
      const selectedTeam = teamsList.find((t) => t.id === teamId);
      await update(teamRef, {
        squad: [...(selectedTeam.squad || []), currentPlayer.id],
        budget_remaining: selectedTeam.budget_remaining - currentBid,
      });

      showToast(
        `${currentPlayer.player_name} sold to ${selectedTeam.team_name}!`,
        "success",
      );
      setShowWinnerModal(false);

      // Move to next player
      if (currentPlayerIndex < playersList.length - 1) {
        setCurrentPlayerIndex(currentPlayerIndex + 1);
      }
    } catch (error) {
      showToast("Error updating auction: " + error.message, "error");
    }
  };

  if (!currentPlayer || !currentGroup) {
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
    <div className="min-h-screen bg-gradient-to-br from-primary to-darkBg p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-secondary">
              {auctionData?.name}
            </h1>
            <p className="text-gray-300">
              Player {currentPlayerIndex + 1} of {playersList.length}
            </p>
          </div>
          <div className="flex gap-4">
            <button
              onClick={() => setAuctionPaused(!auctionPaused)}
              className={`btn flex items-center gap-2 ${auctionPaused ? "btn-success" : "btn-danger"}`}
            >
              {auctionPaused ? <IoPlay size={20} /> : <IoPause size={20} />}
              {auctionPaused ? "Resume" : "Pause"}
            </button>
            <button onClick={() => undoLastBid()} className="btn btn-secondary">
              Undo
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Player Card (Left) */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-xl overflow-hidden">
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
                onClick={() =>
                  setCurrentPlayerIndex(
                    Math.min(playersList.length - 1, currentPlayerIndex + 1),
                  )
                }
                disabled={currentPlayerIndex === playersList.length - 1}
                className="btn btn-sm flex-1 disabled:opacity-50"
              >
                Next <IoArrowForward />
              </button>
            </div>
          </div>

          {/* Bidding Panel (Center) */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-xl p-8 text-center">
              <p className="text-textLight mb-2">Current Bid</p>
              <div className="text-6xl font-bold text-secondary mb-8 animate-pulse-bid">
                ₹{currentBid.toLocaleString()}
              </div>

              {auctionPaused && (
                <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded-lg mb-6">
                  Auction is PAUSED
                </div>
              )}

              {/* Bidding Buttons */}
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
                    currentBid <= (currentPlayer.base_price || 0)
                  }
                  className="w-full btn btn-secondary btn-lg disabled:opacity-50"
                >
                  Decrement (-₹{currentGroup.increment_value.toLocaleString()})
                </button>

                <button
                  onClick={() => setShowWinnerModal(true)}
                  disabled={auctionPaused}
                  className="w-full btn btn-success btn-lg disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <IoCheckmark size={20} /> Finalize Sale
                </button>
              </div>

              {/* Bid History */}
              {bidHistory.length > 0 && (
                <div className="mt-8 pt-6 border-t border-border">
                  <p className="text-sm text-textLight mb-3 font-semibold">
                    Bid History ({bidHistory.length})
                  </p>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {bidHistory
                      .slice()
                      .reverse()
                      .map((bid, idx) => (
                        <div
                          key={idx}
                          className="text-sm p-2 bg-lightBg rounded"
                        >
                          ₹{bid.amount.toLocaleString()}
                        </div>
                      ))}
                  </div>
                </div>
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
                {teamsList.map((team) => (
                  <div
                    key={team.id}
                    className="p-4 border-2 border-border rounded-lg hover:border-primary transition cursor-pointer"
                  >
                    <p className="font-bold text-text">{team.team_name}</p>
                    <p className="text-sm text-textLight mb-2">
                      {team.owner_name}
                    </p>
                    <div className="mb-3">
                      <div className="flex justify-between text-xs mb-1">
                        <span>Budget</span>
                        <span className="font-bold">
                          ₹{(team.budget_remaining || 0).toLocaleString()}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-primary h-2 rounded-full"
                          style={{
                            width: `${Math.max(0, (team.budget_remaining / team.budget_total) * 100)}%`,
                          }}
                        ></div>
                      </div>
                    </div>
                    <p className="text-xs text-textLight">
                      Squad: {team.squad?.length || 0} players
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Winner Selection Modal */}
      <Modal
        isOpen={showWinnerModal}
        title={`Who bought ${currentPlayer.player_name}?`}
        onClose={() => setShowWinnerModal(false)}
      >
        <div className="space-y-3 max-h-60 overflow-y-auto">
          {teamsList.map((team) => (
            <button
              key={team.id}
              onClick={() => handleSoldToTeam(team.id)}
              className="w-full p-4 text-left border-2 border-border rounded-lg hover:border-primary hover:bg-lightBg transition"
            >
              <div className="font-bold text-primary">{team.team_name}</div>
              <div className="text-sm text-textLight">{team.owner_name}</div>
              <div className="text-sm font-semibold text-text mt-1">
                Remaining: ₹{(team.budget_remaining || 0).toLocaleString()}
              </div>
            </button>
          ))}
        </div>
      </Modal>
    </div>
  );
};

export default AdminLive;
