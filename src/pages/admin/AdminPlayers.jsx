import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuction } from "../../hooks/useAuction";
import { useRealtimeData } from "../../hooks/useRealtimeData";
import { useToast } from "../../components/Toast";
import { ToastContainer } from "../../components/ToastContainer";
import { Modal } from "../../components/Modal";
import { parsePlayersCSV } from "../../utils/exportUtils";
import { validatePlayer } from "../../utils/validationUtils";
import { ROUTES } from "../../constants/routes";
import { firebaseObjectToArray } from "../../utils/dataTransformUtils";
import { IoAdd, IoTrash, IoDownload, IoArrowForward, IoArrowBack, IoPencil, IoSwapHorizontal } from "react-icons/io5";
import { ref, update } from "firebase/database";
import { db } from "../../utils/firebaseConfig";

const EMPTY_FORM = {
  player_name: "",
  age: "",
  group_id: "",
  photo_url: "",
};

export const AdminPlayers = () => {
  const { auctionId } = useParams();
  const navigate = useNavigate();
  const { addPlayer, deletePlayer, updatePlayer } = useAuction();
  const { data: playersData } = useRealtimeData(
    `auctions/${auctionId}/players`,
  );
  const { data: groupsData } = useRealtimeData(`auctions/${auctionId}/groups`);
  const { data: teamsData } = useRealtimeData(`auctions/${auctionId}/teams`);
  const { toasts, showToast, removeToast } = useToast();

  const [showModal, setShowModal] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState(null);
  const [playerForm, setPlayerForm] = useState({ ...EMPTY_FORM });
  const [selectedGroup, setSelectedGroup] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [showSaleModal, setShowSaleModal] = useState(false);
  const [salePlayer, setSalePlayer] = useState(null);
  const [saleForm, setSaleForm] = useState({ soldTo: "", soldPrice: "" });

  const playersList = firebaseObjectToArray(playersData);
  const groupsList = firebaseObjectToArray(groupsData);
  const teamsList = firebaseObjectToArray(teamsData);

  // Filter players by selected group and status
  const filteredPlayers = useMemo(() => {
    let filtered = playersList;
    if (selectedGroup !== "all") {
      filtered = filtered.filter((p) => String(p.group_id) === selectedGroup);
    }
    if (selectedStatus === "sold") {
      filtered = filtered.filter((p) => p.soldTo);
    } else if (selectedStatus === "unsold") {
      filtered = filtered.filter((p) => p.unsold && !p.soldTo);
    } else if (selectedStatus === "pending") {
      filtered = filtered.filter((p) => !p.soldTo && !p.unsold);
    }
    return filtered;
  }, [playersList, selectedGroup, selectedStatus]);

  // Status counts
  const statusCounts = useMemo(() => {
    const sold = playersList.filter((p) => p.soldTo).length;
    const unsold = playersList.filter((p) => p.unsold && !p.soldTo).length;
    return { sold, unsold, pending: playersList.length - sold - unsold };
  }, [playersList]);

  // Group counts for the filter bar
  const groupCounts = useMemo(() => {
    const counts = new Map();
    playersList.forEach((p) => {
      const gid = String(p.group_id);
      counts.set(gid, (counts.get(gid) || 0) + 1);
    });
    return counts;
  }, [playersList]);

  // Open add modal
  const openAddModal = () => {
    setEditingPlayer(null);
    setPlayerForm({ ...EMPTY_FORM });
    setShowModal(true);
  };

  // Open edit modal
  const openEditModal = (player) => {
    setEditingPlayer(player);
    setPlayerForm({
      player_name: player.player_name || "",
      age: player.age || "",
      group_id: player.group_id || "",
      photo_url: player.photo_url || "",
    });
    setShowModal(true);
  };

  // Save (add or update)
  const handleSavePlayer = async () => {
    const errors = validatePlayer(playerForm);
    if (errors) {
      showToast("Please fill player details correctly", "error");
      return;
    }

    try {
      if (editingPlayer) {
        await updatePlayer(auctionId, editingPlayer.id, playerForm);
        showToast(`${playerForm.player_name} updated`, "success");
      } else {
        await addPlayer(auctionId, playerForm);
        showToast("Player added successfully!", "success");
      }
      setPlayerForm({ ...EMPTY_FORM });
      setEditingPlayer(null);
      setShowModal(false);
    } catch (error) {
      showToast("Error: " + error.message, "error");
    }
  };

  // Delete player
  const handleDeletePlayer = async (playerId, playerName) => {
    try {
      await deletePlayer(auctionId, playerId);
      showToast(`${playerName} removed`, "success");
    } catch (error) {
      showToast("Error deleting player: " + error.message, "error");
    }
  };

  // Open edit sale modal
  const openSaleModal = (player) => {
    setSalePlayer(player);
    setSaleForm({
      soldTo: player.soldTo || "",
      soldPrice: player.soldPrice || "",
    });
    setShowSaleModal(true);
  };

  // Save edited sale data
  const handleSaveSale = async () => {
    if (!salePlayer) return;

    try {
      const playerRef = ref(db, `auctions/${auctionId}/players/${salePlayer.id}`);

      if (!saleForm.soldTo) {
        // Unsell: remove soldTo/soldPrice, and revert team budget+squad
        const prevTeam = teamsList.find((t) => String(t.id) === String(salePlayer.soldTo));
        if (prevTeam) {
          const teamRef = ref(db, `auctions/${auctionId}/teams/${prevTeam.id}`);
          await update(teamRef, {
            squad: (prevTeam.squad || []).filter((pid) => String(pid) !== String(salePlayer.id)),
            budget_remaining: Number(prevTeam.budget_remaining || 0) + Number(salePlayer.soldPrice || 0),
          });
        }
        await update(playerRef, { soldTo: null, soldPrice: null, unsold: null });
        showToast(`${salePlayer.player_name} moved back to pending`, "success");
      } else {
        const newPrice = Number(saleForm.soldPrice) || 0;
        const oldTeamId = salePlayer.soldTo;
        const newTeamId = saleForm.soldTo;
        const oldPrice = Number(salePlayer.soldPrice) || 0;

        // If team changed, update old team (remove player, refund) and new team (add player, deduct)
        if (String(oldTeamId) !== String(newTeamId) && oldTeamId) {
          const oldTeam = teamsList.find((t) => String(t.id) === String(oldTeamId));
          if (oldTeam) {
            const oldTeamRef = ref(db, `auctions/${auctionId}/teams/${oldTeam.id}`);
            await update(oldTeamRef, {
              squad: (oldTeam.squad || []).filter((pid) => String(pid) !== String(salePlayer.id)),
              budget_remaining: Number(oldTeam.budget_remaining || 0) + oldPrice,
            });
          }

          const newTeam = teamsList.find((t) => String(t.id) === String(newTeamId));
          if (newTeam) {
            const newTeamRef = ref(db, `auctions/${auctionId}/teams/${newTeam.id}`);
            await update(newTeamRef, {
              squad: [...(newTeam.squad || []), salePlayer.id],
              budget_remaining: Number(newTeam.budget_remaining || 0) - newPrice,
            });
          }
        } else if (oldPrice !== newPrice && oldTeamId) {
          // Same team, price changed — adjust budget difference
          const team = teamsList.find((t) => String(t.id) === String(oldTeamId));
          if (team) {
            const teamRef = ref(db, `auctions/${auctionId}/teams/${team.id}`);
            await update(teamRef, {
              budget_remaining: Number(team.budget_remaining || 0) + oldPrice - newPrice,
            });
          }
        } else if (!oldTeamId) {
          // Selling a previously unsold/pending player
          const newTeam = teamsList.find((t) => String(t.id) === String(newTeamId));
          if (newTeam) {
            const newTeamRef = ref(db, `auctions/${auctionId}/teams/${newTeam.id}`);
            await update(newTeamRef, {
              squad: [...(newTeam.squad || []), salePlayer.id],
              budget_remaining: Number(newTeam.budget_remaining || 0) - newPrice,
            });
          }
        }

        await update(playerRef, { soldTo: newTeamId, soldPrice: newPrice, unsold: null });
        const teamName = teamsList.find((t) => String(t.id) === String(newTeamId))?.team_name || "Unknown";
        showToast(`${salePlayer.player_name} → ${teamName} at ₹${newPrice.toLocaleString()}`, "success");
      }

      setShowSaleModal(false);
      setSalePlayer(null);
    } catch (error) {
      showToast("Error: " + error.message, "error");
    }
  };

  // Helper: get player status badge
  const getStatusBadge = (player) => {
    if (player.soldTo) {
      const team = teamsList.find((t) => String(t.id) === String(player.soldTo));
      return (
        <div>
          <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs font-bold">
            SOLD
          </span>
          <p className="text-xs text-textLight mt-1">
            {team?.team_name || "Unknown"} - ₹{(player.soldPrice || 0).toLocaleString()}
          </p>
        </div>
      );
    }
    if (player.unsold) {
      return (
        <span className="bg-red-100 text-red-700 px-2 py-1 rounded-full text-xs font-bold">
          UNSOLD
        </span>
      );
    }
    return (
      <span className="bg-gray-100 text-gray-500 px-2 py-1 rounded-full text-xs font-bold">
        PENDING
      </span>
    );
  };

  // Resolve group name to Firebase group ID
  const resolveGroupId = (csvGroupValue) => {
    const directMatch = groupsList.find((g) => g.id === csvGroupValue);
    if (directMatch) return directMatch.id;
    const nameMatch = groupsList.find(
      (g) => g.group_name.toLowerCase() === csvGroupValue?.toLowerCase(),
    );
    if (nameMatch) return nameMatch.id;
    return null;
  };

  // Bulk upload CSV
  const handleBulkUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const csvPlayers = await parsePlayersCSV(file);

      let addedCount = 0;
      let skippedCount = 0;
      for (const player of csvPlayers) {
        if (!player.player_name) continue;

        const groupId = resolveGroupId(player.group_id || player.group_name || player.group);
        if (!groupId) {
          skippedCount++;
          continue;
        }

        const playerData = {
          player_name: player.player_name,
          age: Number(player.age),
          group_id: groupId,
          photo_url: player.photo_url || "",
        };

        const errors = validatePlayer(playerData);
        if (!errors) {
          await addPlayer(auctionId, playerData);
          addedCount++;
        } else {
          skippedCount++;
        }
      }

      const msg = skippedCount > 0
        ? `${addedCount} players added, ${skippedCount} skipped (invalid data or unmatched group)`
        : `${addedCount} players added successfully!`;
      showToast(msg, addedCount > 0 ? "success" : "error");
      e.target.value = "";
    } catch (error) {
      showToast("Error uploading CSV: " + error.message, "error");
    }
  };

  // Download CSV template
  const downloadTemplate = () => {
    const groupNames = groupsList.map((g) => g.group_name).join(", ");
    const exampleGroup = groupsList[0]?.group_name || "Group A+";
    const template = `player_name,age,group_name,photo_url
Virat Kohli,35,${exampleGroup},
Rohit Sharma,36,${exampleGroup},
Jasprit Bumrah,30,${exampleGroup},

# Available groups: ${groupNames}
# Base price is set per group, not per player`;

    const element = document.createElement("a");
    element.setAttribute(
      "href",
      `data:text/csv;charset=utf-8,${encodeURIComponent(template)}`,
    );
    element.setAttribute("download", "players_template.csv");
    element.click();
    showToast("Template downloaded!", "success");
  };

  // Player form fields (shared between add and edit)
  const renderPlayerForm = () => (
    <div className="space-y-4 max-h-96 overflow-y-auto">
      <div>
        <label className="block font-semibold text-text mb-2">Player Name</label>
        <input
          type="text"
          value={playerForm.player_name}
          onChange={(e) => setPlayerForm({ ...playerForm, player_name: e.target.value })}
          placeholder="e.g., Virat Kohli"
          className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:border-primary"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block font-semibold text-text mb-2">Age</label>
          <input
            type="number"
            value={playerForm.age}
            onChange={(e) => setPlayerForm({ ...playerForm, age: Number(e.target.value) })}
            placeholder="e.g., 35"
            className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:border-primary"
          />
        </div>
        <div>
          <label className="block font-semibold text-text mb-2">Group</label>
          <select
            value={playerForm.group_id}
            onChange={(e) => setPlayerForm({ ...playerForm, group_id: e.target.value })}
            className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:border-primary"
          >
            <option value="">Select Group</option>
            {groupsList.map((group) => (
              <option key={group.id} value={group.id}>
                {group.group_name} (Base: ₹{(group.base_price || 0).toLocaleString()})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block font-semibold text-text mb-2">Photo URL (Optional)</label>
        <input
          type="url"
          value={playerForm.photo_url}
          onChange={(e) => setPlayerForm({ ...playerForm, photo_url: e.target.value })}
          placeholder="https://example.com/photo.jpg"
          className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:border-primary"
        />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-lightBg p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-4xl font-bold text-primary">Manage Players</h1>
            <p className="text-textLight">
              {selectedGroup === "all"
                ? `Total Players: ${playersList.length}`
                : `Showing ${filteredPlayers.length} of ${playersList.length} players`}
            </p>
          </div>
          <div className="flex gap-3 flex-wrap">
            <button
              onClick={() => navigate(ROUTES.ADMIN_SETUP)}
              className="btn btn-secondary flex items-center gap-2"
            >
              <IoArrowBack size={18} /> Dashboard
            </button>
            <button
              onClick={downloadTemplate}
              className="btn btn-secondary flex items-center gap-2"
            >
              <IoDownload size={18} /> Template
            </button>
            <label className="btn btn-secondary cursor-pointer flex items-center gap-2">
              <IoDownload size={18} /> CSV Upload
              <input
                type="file"
                accept=".csv"
                onChange={handleBulkUpload}
                hidden
              />
            </label>
            <button
              onClick={openAddModal}
              className="btn btn-primary flex items-center gap-2"
            >
              <IoAdd size={20} /> Add Player
            </button>
            {playersList.length > 0 && (
              <button
                onClick={() => navigate(ROUTES.ADMIN_LIVE(auctionId))}
                className="btn flex items-center gap-2 bg-success hover:bg-green-700 text-white"
              >
                Live Auction <IoArrowForward size={18} />
              </button>
            )}
          </div>
        </div>

        {/* Group Filter Bar */}
        {groupsList.length > 0 && playersList.length > 0 && (
          <div className="flex items-center gap-2 mb-3 overflow-x-auto pb-2">
            <span className="text-sm font-semibold text-textLight mr-1">Group:</span>
            <button
              onClick={() => setSelectedGroup("all")}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition ${
                selectedGroup === "all"
                  ? "bg-primary text-white"
                  : "bg-white border border-border text-textLight hover:border-primary"
              }`}
            >
              All ({playersList.length})
            </button>
            {groupsList.map((group) => {
              const count = groupCounts.get(String(group.id)) || 0;
              return (
                <button
                  key={group.id}
                  onClick={() => setSelectedGroup(String(group.id))}
                  className={`px-4 py-2 rounded-lg text-sm font-bold transition flex-shrink-0 ${
                    selectedGroup === String(group.id)
                      ? "bg-primary text-white"
                      : "bg-white border border-border text-textLight hover:border-primary"
                  }`}
                >
                  {group.group_name} ({count})
                </button>
              );
            })}
          </div>
        )}

        {/* Status Filter Bar */}
        {playersList.length > 0 && (statusCounts.sold > 0 || statusCounts.unsold > 0) && (
          <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
            <span className="text-sm font-semibold text-textLight mr-1">Status:</span>
            {[
              { key: "all", label: "All", count: playersList.length },
              { key: "sold", label: "Sold", count: statusCounts.sold, color: "green" },
              { key: "unsold", label: "Unsold", count: statusCounts.unsold, color: "red" },
              { key: "pending", label: "Pending", count: statusCounts.pending, color: "gray" },
            ].map((s) => (
              <button
                key={s.key}
                onClick={() => setSelectedStatus(s.key)}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition flex-shrink-0 ${
                  selectedStatus === s.key
                    ? "bg-primary text-white"
                    : "bg-white border border-border text-textLight hover:border-primary"
                }`}
              >
                {s.label} ({s.count})
              </button>
            ))}
          </div>
        )}

        {/* Players Table */}
        <div className="card">
          {playersList.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-lg text-textLight mb-4">No players added yet</p>
              <button onClick={openAddModal} className="btn btn-primary">
                Add First Player
              </button>
            </div>
          ) : filteredPlayers.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-lg text-textLight">No players in this group</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-border">
                    <th className="text-left py-4 px-4 font-bold text-primary">#</th>
                    <th className="text-left py-4 px-4 font-bold text-primary">Player Name</th>
                    <th className="text-left py-4 px-4 font-bold text-primary">Age</th>
                    <th className="text-left py-4 px-4 font-bold text-primary">Group</th>
                    <th className="text-left py-4 px-4 font-bold text-primary">Base Price</th>
                    <th className="text-left py-4 px-4 font-bold text-primary">Status</th>
                    <th className="text-center py-4 px-4 font-bold text-primary">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPlayers.map((player, idx) => {
                    const group = groupsList.find(
                      (g) => String(g.id) === String(player.group_id),
                    );
                    return (
                      <tr
                        key={player.id}
                        className={`border-b border-border hover:bg-gray-50 transition ${
                          player.soldTo ? "bg-green-50/50" : player.unsold ? "bg-red-50/50" : ""
                        }`}
                      >
                        <td className="py-4 px-4 text-textLight">{idx + 1}</td>
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
                        <td className="py-4 px-4 text-text">{player.age}</td>
                        <td className="py-4 px-4">
                          <span className="bg-secondary text-primary px-3 py-1 rounded-full text-sm font-bold">
                            {group?.group_name || "N/A"}
                          </span>
                          {!group && (
                            <span className="block text-xs text-danger mt-1">
                              Bad ID: {player.group_id}
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-4 text-text font-semibold">
                          ₹{(group?.base_price || 0).toLocaleString()}
                        </td>
                        <td className="py-4 px-4">{getStatusBadge(player)}</td>
                        <td className="py-4 px-4">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => openEditModal(player)}
                              className="btn btn-sm btn-secondary"
                              title="Edit player"
                            >
                              <IoPencil size={16} />
                            </button>
                            <button
                              onClick={() => openSaleModal(player)}
                              className="btn btn-sm btn-primary"
                              title="Edit sale"
                            >
                              <IoSwapHorizontal size={16} />
                            </button>
                            <button
                              onClick={() => handleDeletePlayer(player.id, player.player_name)}
                              className="btn btn-danger btn-sm"
                              title="Delete player"
                            >
                              <IoTrash size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Add / Edit Player Modal */}
      <Modal
        isOpen={showModal}
        title={editingPlayer ? `Edit ${editingPlayer.player_name}` : "Add Player"}
        onClose={() => {
          setShowModal(false);
          setEditingPlayer(null);
          setPlayerForm({ ...EMPTY_FORM });
        }}
        onConfirm={handleSavePlayer}
        confirmText={editingPlayer ? "Save Changes" : "Add Player"}
      >
        {renderPlayerForm()}
      </Modal>

      {/* Edit Sale Modal */}
      <Modal
        isOpen={showSaleModal}
        title={salePlayer ? `Edit Sale: ${salePlayer.player_name}` : "Edit Sale"}
        onClose={() => {
          setShowSaleModal(false);
          setSalePlayer(null);
        }}
        onConfirm={handleSaveSale}
        confirmText="Save"
      >
        {salePlayer && (
          <div className="space-y-4">
            <div className="bg-lightBg p-3 rounded-lg">
              <p className="font-bold text-text">{salePlayer.player_name}</p>
              <p className="text-xs text-textLight">
                {groupsList.find((g) => String(g.id) === String(salePlayer.group_id))?.group_name || "Unknown Group"}
                {salePlayer.soldTo && (
                  <span> | Currently: {teamsList.find((t) => String(t.id) === String(salePlayer.soldTo))?.team_name} at ₹{(salePlayer.soldPrice || 0).toLocaleString()}</span>
                )}
              </p>
            </div>

            <div>
              <label className="block font-semibold text-text mb-2">Sold To Team</label>
              <select
                value={saleForm.soldTo}
                onChange={(e) => setSaleForm({ ...saleForm, soldTo: e.target.value })}
                className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:border-primary"
              >
                <option value="">Not Sold (move to pending)</option>
                {teamsList.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.team_name} (Budget: ₹{(team.budget_remaining || 0).toLocaleString()})
                  </option>
                ))}
              </select>
            </div>

            {saleForm.soldTo && (
              <div>
                <label className="block font-semibold text-text mb-2">Sold Price (₹)</label>
                <input
                  type="number"
                  value={saleForm.soldPrice}
                  onChange={(e) => setSaleForm({ ...saleForm, soldPrice: Number(e.target.value) })}
                  placeholder="e.g., 50000"
                  className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:border-primary"
                />
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  );
};

export default AdminPlayers;
