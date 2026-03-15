import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuction } from "../../hooks/useAuction";
import { useRealtimeData } from "../../hooks/useRealtimeData";
import { useToast } from "../../components/Toast";
import { ToastContainer } from "../../components/ToastContainer";
import { Modal } from "../../components/Modal";
import {
  validateAuctionSetup,
  validateTeam,
  validateGroup,
} from "../../utils/validationUtils";
import { firebaseObjectToArray } from "../../utils/dataTransformUtils";
import { ROUTES } from "../../constants/routes";
import { QRCodeSVG } from "qrcode.react";
import { IoAdd, IoTrash, IoArrowForward, IoPeople, IoPlay, IoStatsChart, IoPencil, IoLayers, IoShareSocial, IoCopy } from "react-icons/io5";

export const AdminSetup = () => {
  const navigate = useNavigate();
  const { createAuction, addTeam, addGroup, deleteAuction, updateGroup, deleteGroup } = useAuction();
  const { toasts, showToast, removeToast } = useToast();
  const [showCreateNew, setShowCreateNew] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [managingGroupsAuctionId, setManagingGroupsAuctionId] = useState(null);
  const [showExistingGroupModal, setShowExistingGroupModal] = useState(false);
  const [editingExistingGroup, setEditingExistingGroup] = useState(null);
  const [shareAuctionId, setShareAuctionId] = useState(null);
  const [existingGroupForm, setExistingGroupForm] = useState({
    group_name: "",
    base_price: "",
    increment_value: "",
    max_bid_cap: "",
  });

  // Fetch existing auctions
  const { data: auctionsData } = useRealtimeData("auctions");
  const existingAuctions = useMemo(
    () => firebaseObjectToArray(auctionsData).sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    ),
    [auctionsData],
  );

  // Auction state
  const [auctionData, setAuctionData] = useState({
    name: "",
    purseSize: 1000000,
    maxPlayers: 25,
    maxPlayersPerTeam: 11,
    date: new Date().toISOString().split("T")[0],
  });

  // Teams & Groups
  const [teams, setTeams] = useState([]);
  const [groups, setGroups] = useState([]);

  // Modal states
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);

  // Form states
  const [teamForm, setTeamForm] = useState({
    team_name: "",
    owner_name: "",
    budget_total: "",
    pin: "",
  });
  const [groupForm, setGroupForm] = useState({
    group_name: "",
    base_price: "",
    increment_value: "",
    max_bid_cap: "",
    max_per_team: "",
  });

  // Handle auction creation
  const handleCreateAuction = async () => {
    const errors = validateAuctionSetup(auctionData);
    if (errors) {
      showToast("Please fill all required fields correctly", "error");
      return;
    }

    if (teams.length === 0 || groups.length === 0) {
      showToast("Please add at least one team and one group", "error");
      return;
    }

    try {
      const auctionId = await createAuction({
        name: auctionData.name,
        purse_size: auctionData.purseSize,
        total_players: auctionData.maxPlayers,
        max_players_per_team: auctionData.maxPlayersPerTeam,
        date: auctionData.date,
      });

      // Add teams and groups in parallel
      await Promise.all([
        Promise.all(
          teams.map(({ id, ...teamDataWithoutId }) =>
            addTeam(auctionId, teamDataWithoutId)
          )
        ),
        Promise.all(
          groups.map(({ id, ...groupDataWithoutId }) =>
            addGroup(auctionId, groupDataWithoutId)
          )
        ),
      ]);

      showToast("Auction created successfully!", "success");
      navigate(ROUTES.ADMIN_PLAYERS(auctionId));
    } catch (error) {
      showToast(`Failed to create auction: ${error.message}`, "error");
    }
  };

  // Add team
  const handleAddTeam = () => {
    const errors = validateTeam(teamForm);
    if (errors) {
      showToast("Please fill team details correctly", "error");
      return;
    }

    const duplicate = teams.find(
      (t) => t.team_name.toLowerCase().trim() === teamForm.team_name.toLowerCase().trim(),
    );
    if (duplicate) {
      showToast(`Team "${teamForm.team_name}" already exists`, "error");
      return;
    }

    setTeams([...teams, { ...teamForm, id: `local_${Date.now()}_${Math.random().toString(36).slice(2, 7)}` }]);
    setTeamForm({ team_name: "", owner_name: "", budget_total: "", pin: "" });
    setShowTeamModal(false);
    showToast("Team added", "success");
  };

  // Add group
  const handleAddGroup = () => {
    const errors = validateGroup(groupForm);
    if (errors) {
      showToast("Please fill group details correctly", "error");
      return;
    }

    setGroups([...groups, { ...groupForm, id: `local_${Date.now()}_${Math.random().toString(36).slice(2, 7)}` }]);
    setGroupForm({ group_name: "", base_price: "", increment_value: "", max_bid_cap: "", max_per_team: "" });
    setShowGroupModal(false);
    showToast("Group added", "success");
  };

  // Remove team
  const removeTeam = (id) => {
    setTeams(teams.filter((t) => t.id !== id));
    showToast("Team removed", "success");
  };

  // Remove group (local, during creation)
  const removeGroup = (id) => {
    setGroups(groups.filter((g) => g.id !== id));
    showToast("Group removed", "success");
  };

  // Fetch groups for the auction being managed
  const { data: managedGroupsData } = useRealtimeData(
    managingGroupsAuctionId ? `auctions/${managingGroupsAuctionId}/groups` : null,
  );
  const managedGroupsList = firebaseObjectToArray(managedGroupsData);

  // Fetch players for the auction being managed (needed to check group assignments before delete)
  const { data: managedPlayersData } = useRealtimeData(
    managingGroupsAuctionId ? `auctions/${managingGroupsAuctionId}/players` : null,
  );
  const managedPlayersList = firebaseObjectToArray(managedPlayersData);

  // Delete an existing auction (blocked if currently live)
  const handleDeleteAuction = async (auctionId) => {
    // Check if auction has an active live_state
    const auctionObj = existingAuctions.find((a) => String(a.id) === String(auctionId));
    if (auctionObj?.live_state && !auctionObj.live_state.isComplete) {
      showToast("Cannot delete — this auction is currently live. Complete or stop it first.", "error");
      setDeleteConfirmId(null);
      return;
    }
    try {
      await deleteAuction(auctionId);
      setDeleteConfirmId(null);
      showToast("Auction deleted", "success");
    } catch (error) {
      showToast("Error deleting auction: " + error.message, "error");
    }
  };

  // Open add/edit group modal for existing auctions
  const openExistingGroupModal = (group = null) => {
    setEditingExistingGroup(group);
    setExistingGroupForm(group ? {
      group_name: group.group_name || "",
      base_price: group.base_price || "",
      increment_value: group.increment_value || "",
      max_bid_cap: group.max_bid_cap || "",
      max_per_team: group.max_per_team || "",
    } : {
      group_name: "",
      base_price: "",
      increment_value: "",
      max_bid_cap: "",
      max_per_team: "",
    });
    setShowExistingGroupModal(true);
  };

  // Save (add or update) group for existing auction
  const handleSaveExistingGroup = async () => {
    const errors = validateGroup(existingGroupForm);
    if (errors) {
      showToast("Please fill group details correctly", "error");
      return;
    }

    try {
      if (editingExistingGroup) {
        await updateGroup(managingGroupsAuctionId, editingExistingGroup.id, existingGroupForm);
        showToast(`${existingGroupForm.group_name} updated`, "success");
      } else {
        await addGroup(managingGroupsAuctionId, existingGroupForm);
        showToast("Group added!", "success");
      }
      setShowExistingGroupModal(false);
      setEditingExistingGroup(null);
    } catch (error) {
      showToast("Error: " + error.message, "error");
    }
  };

  // Delete group from existing auction (blocked if players are assigned)
  const handleDeleteExistingGroup = async (groupId, groupName) => {
    const assignedPlayers = managedPlayersList.filter(
      (p) => String(p.group_id) === String(groupId),
    );
    if (assignedPlayers.length > 0) {
      showToast(
        `Cannot delete "${groupName}" — ${assignedPlayers.length} player(s) are assigned to it. Remove or reassign them first.`,
        "error",
      );
      return;
    }
    try {
      await deleteGroup(managingGroupsAuctionId, groupId);
      showToast(`${groupName} deleted`, "success");
    } catch (error) {
      showToast("Error deleting group: " + error.message, "error");
    }
  };

  return (
    <div className="min-h-screen bg-lightBg p-3 sm:p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <h1 className="text-2xl sm:text-4xl font-bold text-primary mb-2">Admin Dashboard</h1>
        <p className="text-textLight mb-8">
          Manage your cricket auctions
        </p>

        {/* Existing Auctions */}
        {existingAuctions.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-primary mb-4">
              Your Auctions ({existingAuctions.length})
            </h2>
            <div className="grid md:grid-cols-2 gap-4">
              {existingAuctions.map((auction) => (
                <div
                  key={auction.id}
                  className="card card-hover border-2 border-border hover:border-primary transition"
                >
                  <div className="flex justify-between items-start gap-2 mb-4">
                    <div className="min-w-0">
                      <h3 className="text-lg sm:text-xl font-bold text-primary truncate">
                        {auction.name}
                      </h3>
                      <p className="text-sm text-textLight">
                        {auction.date ? new Date(auction.date).toLocaleDateString() : "No date"} | Purse: ₹{(auction.purse_size || 0).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`text-xs px-2 py-1 rounded-full font-bold ${
                        auction.status === "live" ? "bg-success text-white" :
                        auction.status === "completed" ? "bg-secondary text-primary" :
                        "bg-gray-200 text-textLight"
                      }`}>
                        {auction.status || "setup"}
                      </span>
                      {deleteConfirmId === auction.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleDeleteAuction(auction.id)}
                            className="btn btn-danger btn-sm text-xs"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(null)}
                            className="btn btn-secondary btn-sm text-xs"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirmId(auction.id)}
                          className="btn btn-danger btn-sm"
                          title="Delete auction"
                        >
                          <IoTrash size={14} />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => navigate(ROUTES.ADMIN_PLAYERS(auction.id))}
                      className="btn btn-sm btn-primary flex items-center gap-1"
                    >
                      <IoPeople size={16} /> Players
                    </button>
                    <button
                      onClick={() => setManagingGroupsAuctionId(
                        managingGroupsAuctionId === auction.id ? null : auction.id
                      )}
                      className={`btn btn-sm flex items-center gap-1 ${
                        managingGroupsAuctionId === auction.id
                          ? "bg-primary text-white"
                          : "btn-secondary"
                      }`}
                    >
                      <IoLayers size={16} /> Groups
                    </button>
                    <button
                      onClick={() => navigate(ROUTES.ADMIN_LIVE(auction.id))}
                      className="btn btn-sm btn-success flex items-center gap-1"
                    >
                      <IoPlay size={16} /> Live Auction
                    </button>
                    <button
                      onClick={() => navigate(ROUTES.ADMIN_RESULTS(auction.id))}
                      className="btn btn-sm btn-secondary flex items-center gap-1"
                    >
                      <IoStatsChart size={16} /> Results
                    </button>
                    <button
                      onClick={() => setShareAuctionId(auction.id)}
                      className="btn btn-sm btn-secondary flex items-center gap-1"
                      title="Share viewer link"
                    >
                      <IoShareSocial size={16} /> Share
                    </button>
                  </div>

                  {/* Inline Groups Management */}
                  {managingGroupsAuctionId === auction.id && (
                    <div className="mt-4 pt-4 border-t border-border">
                      <div className="flex justify-between items-center mb-3">
                        <h4 className="font-bold text-text">
                          Player Groups ({managedGroupsList.length})
                        </h4>
                        <button
                          onClick={() => openExistingGroupModal()}
                          className="btn btn-primary btn-sm flex items-center gap-1"
                        >
                          <IoAdd size={16} /> Add Group
                        </button>
                      </div>

                      {managedGroupsList.length === 0 ? (
                        <p className="text-textLight text-sm py-2">No groups yet</p>
                      ) : (
                        <div className="space-y-2">
                          {managedGroupsList.map((group) => (
                            <div
                              key={group.id}
                              className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 p-3 bg-lightBg border border-border rounded-lg"
                            >
                              <div className="min-w-0">
                                <p className="font-semibold text-text text-sm">
                                  {group.group_name}
                                </p>
                                <p className="text-xs text-textLight break-words">
                                  Base: ₹{(group.base_price || 0).toLocaleString()} | Inc: ₹{(group.increment_value || 0).toLocaleString()} | Max: ₹{group.max_bid_cap ? group.max_bid_cap.toLocaleString() : "∞"}{group.max_per_team ? ` | ${group.max_per_team}/team` : ""}
                                </p>
                              </div>
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <button
                                  onClick={() => openExistingGroupModal(group)}
                                  className="btn btn-sm btn-secondary"
                                  title="Edit group"
                                >
                                  <IoPencil size={14} />
                                </button>
                                <button
                                  onClick={() => handleDeleteExistingGroup(group.id, group.group_name)}
                                  className="btn btn-danger btn-sm"
                                  title="Delete group"
                                >
                                  <IoTrash size={14} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Create New Auction Toggle */}
        {!showCreateNew ? (
          <button
            onClick={() => setShowCreateNew(true)}
            className="btn btn-primary flex items-center gap-2 btn-lg"
          >
            <IoAdd size={20} /> Create New Auction
          </button>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-primary">Create New Auction</h2>
              {existingAuctions.length > 0 && (
                <button
                  onClick={() => setShowCreateNew(false)}
                  className="text-textLight hover:text-primary text-sm font-semibold"
                >
                  Cancel
                </button>
              )}
            </div>

        {/* Auction Details */}
        <div className="card mb-8">
          <h2 className="text-2xl font-bold text-primary mb-6">
            Auction Details
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block font-semibold text-text mb-2">
                Auction Name
              </label>
              <input
                type="text"
                value={auctionData.name}
                onChange={(e) =>
                  setAuctionData({ ...auctionData, name: e.target.value })
                }
                placeholder="e.g., IPL 2026"
                className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="block font-semibold text-text mb-2">
                Auction Date
              </label>
              <input
                type="date"
                value={auctionData.date}
                onChange={(e) =>
                  setAuctionData({ ...auctionData, date: e.target.value })
                }
                className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="block font-semibold text-text mb-2">
                Total Purse Size (₹)
              </label>
              <input
                type="number"
                value={auctionData.purseSize}
                onChange={(e) =>
                  setAuctionData({
                    ...auctionData,
                    purseSize: Number(e.target.value),
                  })
                }
                className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="block font-semibold text-text mb-2">
                Max Players
              </label>
              <input
                type="number"
                value={auctionData.maxPlayers}
                onChange={(e) =>
                  setAuctionData({
                    ...auctionData,
                    maxPlayers: Number(e.target.value),
                  })
                }
                className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="block font-semibold text-text mb-2">
                Max Players Per Team
              </label>
              <input
                type="number"
                value={auctionData.maxPlayersPerTeam}
                onChange={(e) =>
                  setAuctionData({
                    ...auctionData,
                    maxPlayersPerTeam: Number(e.target.value),
                  })
                }
                placeholder="e.g., 11"
                className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:border-primary"
              />
            </div>
          </div>
        </div>

        {/* Teams Section */}
        <div className="card mb-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-primary">
              Teams ({teams.length})
            </h2>
            <button
              onClick={() => setShowTeamModal(true)}
              className="btn btn-primary btn-sm flex items-center gap-2"
            >
              <IoAdd size={20} /> Add Team
            </button>
          </div>

          {teams.length === 0 ? (
            <p className="text-textLight py-4">No teams added yet</p>
          ) : (
            <div className="space-y-3">
              {teams.map((team) => (
                <div
                  key={team.id}
                  className="flex justify-between items-center p-4 bg-lightBg border border-border rounded-lg"
                >
                  <div>
                    <p className="font-semibold text-text">{team.team_name}</p>
                    <p className="text-sm text-textLight">
                      Owner: {team.owner_name} | Budget: ₹
                      {team.budget_total.toLocaleString()}
                    </p>
                  </div>
                  <button
                    onClick={() => removeTeam(team.id)}
                    className="btn btn-danger btn-sm"
                  >
                    <IoTrash size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Groups Section */}
        <div className="card mb-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-primary">
              Player Groups ({groups.length})
            </h2>
            <button
              onClick={() => setShowGroupModal(true)}
              className="btn btn-primary btn-sm flex items-center gap-2"
            >
              <IoAdd size={20} /> Add Group
            </button>
          </div>

          {groups.length === 0 ? (
            <p className="text-textLight py-4">No groups added yet</p>
          ) : (
            <div className="space-y-3">
              {groups.map((group) => (
                <div
                  key={group.id}
                  className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 p-3 sm:p-4 bg-lightBg border border-border rounded-lg"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-text">
                      {group.group_name}
                    </p>
                    <p className="text-xs sm:text-sm text-textLight break-words">
                      Base: ₹{group.base_price.toLocaleString()} | Inc: ₹{group.increment_value.toLocaleString()} | Max: ₹
                      {group.max_bid_cap
                        ? group.max_bid_cap.toLocaleString()
                        : "∞"}
                      {group.max_per_team ? ` | ${group.max_per_team}/team` : ""}
                    </p>
                  </div>
                  <button
                    onClick={() => removeGroup(group.id)}
                    className="btn btn-danger btn-sm self-end sm:self-auto flex-shrink-0"
                  >
                    <IoTrash size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4">
          <button
            onClick={() => existingAuctions.length > 0 ? setShowCreateNew(false) : navigate(ROUTES.HOME)}
            className="btn btn-sm border border-primary text-primary hover:bg-lightBg"
          >
            Back
          </button>
          <button
            onClick={handleCreateAuction}
            className="btn btn-primary flex items-center gap-2 btn-lg"
          >
            Create & Add Players
            <IoArrowForward size={20} />
          </button>
        </div>
          </>
        )}
      </div>

      {/* Team Modal */}
      <Modal
        isOpen={showTeamModal}
        title="Add Team"
        onClose={() => setShowTeamModal(false)}
        onConfirm={handleAddTeam}
        confirmText="Add"
      >
        <div className="space-y-4">
          <div>
            <label className="block font-semibold text-text mb-2">
              Team Name
            </label>
            <input
              type="text"
              value={teamForm.team_name}
              onChange={(e) =>
                setTeamForm({ ...teamForm, team_name: e.target.value })
              }
              placeholder="e.g., Mumbai Indians"
              className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="block font-semibold text-text mb-2">
              Owner Name
            </label>
            <input
              type="text"
              value={teamForm.owner_name}
              onChange={(e) =>
                setTeamForm({ ...teamForm, owner_name: e.target.value })
              }
              placeholder="e.g., Mukesh Ambani"
              className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="block font-semibold text-text mb-2">
              Budget (₹)
            </label>
            <input
              type="number"
              value={teamForm.budget_total}
              onChange={(e) =>
                setTeamForm({
                  ...teamForm,
                  budget_total: Number(e.target.value),
                })
              }
              placeholder="e.g., 100000000"
              className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="block font-semibold text-text mb-2">
              Team PIN (for owner access)
            </label>
            <input
              type="text"
              value={teamForm.pin}
              onChange={(e) =>
                setTeamForm({ ...teamForm, pin: e.target.value })
              }
              placeholder="e.g., 1234"
              maxLength={6}
              className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:border-primary"
            />
            <p className="text-xs text-textLight mt-1">
              Team owners use this PIN to access their team view
            </p>
          </div>
        </div>
      </Modal>

      {/* Group Modal */}
      <Modal
        isOpen={showGroupModal}
        title="Add Player Group"
        onClose={() => setShowGroupModal(false)}
        onConfirm={handleAddGroup}
        confirmText="Add"
      >
        <div className="space-y-4">
          <div>
            <label className="block font-semibold text-text mb-2">
              Group Name
            </label>
            <input
              type="text"
              value={groupForm.group_name}
              onChange={(e) =>
                setGroupForm({ ...groupForm, group_name: e.target.value })
              }
              placeholder="e.g., Group A+"
              className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="block font-semibold text-text mb-2">
              Base Price (₹)
            </label>
            <input
              type="number"
              value={groupForm.base_price}
              onChange={(e) =>
                setGroupForm({
                  ...groupForm,
                  base_price: Number(e.target.value),
                })
              }
              placeholder="e.g., 800000"
              className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="block font-semibold text-text mb-2">
              Bid Increment (₹)
            </label>
            <input
              type="number"
              value={groupForm.increment_value}
              onChange={(e) =>
                setGroupForm({
                  ...groupForm,
                  increment_value: Number(e.target.value),
                })
              }
              placeholder="e.g., 500000"
              className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="block font-semibold text-text mb-2">
              Max Price Cap (₹) - Optional
            </label>
            <input
              type="number"
              value={groupForm.max_bid_cap}
              onChange={(e) =>
                setGroupForm({
                  ...groupForm,
                  max_bid_cap: Number(e.target.value) || "",
                })
              }
              placeholder="Leave empty for no cap"
              className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="block font-semibold text-text mb-2">
              Max Players Per Team From This Group - Optional
            </label>
            <input
              type="number"
              value={groupForm.max_per_team}
              onChange={(e) =>
                setGroupForm({
                  ...groupForm,
                  max_per_team: Number(e.target.value) || "",
                })
              }
              placeholder="Leave empty for no limit"
              className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:border-primary"
            />
          </div>
        </div>
      </Modal>

      {/* Existing Auction Group Modal */}
      <Modal
        isOpen={showExistingGroupModal}
        title={editingExistingGroup ? `Edit ${editingExistingGroup.group_name}` : "Add Group"}
        onClose={() => {
          setShowExistingGroupModal(false);
          setEditingExistingGroup(null);
        }}
        onConfirm={handleSaveExistingGroup}
        confirmText={editingExistingGroup ? "Save Changes" : "Add Group"}
      >
        <div className="space-y-4">
          <div>
            <label className="block font-semibold text-text mb-2">Group Name</label>
            <input
              type="text"
              value={existingGroupForm.group_name}
              onChange={(e) => setExistingGroupForm({ ...existingGroupForm, group_name: e.target.value })}
              placeholder="e.g., Group A+"
              className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="block font-semibold text-text mb-2">Base Price (₹)</label>
            <input
              type="number"
              value={existingGroupForm.base_price}
              onChange={(e) => setExistingGroupForm({ ...existingGroupForm, base_price: Number(e.target.value) })}
              placeholder="e.g., 800000"
              className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="block font-semibold text-text mb-2">Bid Increment (₹)</label>
            <input
              type="number"
              value={existingGroupForm.increment_value}
              onChange={(e) => setExistingGroupForm({ ...existingGroupForm, increment_value: Number(e.target.value) })}
              placeholder="e.g., 500000"
              className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="block font-semibold text-text mb-2">Max Price Cap (₹) - Optional</label>
            <input
              type="number"
              value={existingGroupForm.max_bid_cap}
              onChange={(e) => setExistingGroupForm({ ...existingGroupForm, max_bid_cap: Number(e.target.value) || "" })}
              placeholder="Leave empty for no cap"
              className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="block font-semibold text-text mb-2">Max Players Per Team From This Group - Optional</label>
            <input
              type="number"
              value={existingGroupForm.max_per_team}
              onChange={(e) => setExistingGroupForm({ ...existingGroupForm, max_per_team: Number(e.target.value) || "" })}
              placeholder="Leave empty for no limit"
              className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:border-primary"
            />
          </div>
        </div>
      </Modal>

      {/* QR Code Share Modal */}
      <Modal
        isOpen={!!shareAuctionId}
        title="Share Auction Link"
        onClose={() => setShareAuctionId(null)}
      >
        {shareAuctionId && (() => {
          const shareUrl = `${window.location.origin}/auction/${shareAuctionId}`;
          const auction = existingAuctions.find(
            (a) => String(a.id) === String(shareAuctionId)
          );
          return (
            <div className="text-center">
              <p className="text-text font-bold mb-4">{auction?.name}</p>
              <div className="flex justify-center mb-4">
                <QRCodeSVG
                  value={shareUrl}
                  size={200}
                  bgColor="#ffffff"
                  fgColor="#1a3a52"
                  level="M"
                />
              </div>
              <p className="text-sm text-textLight mb-3">
                Scan this QR code to open the viewer dashboard
              </p>
              <div className="flex items-center gap-2 bg-lightBg border border-border rounded-lg p-3">
                <input
                  type="text"
                  readOnly
                  value={shareUrl}
                  className="flex-1 bg-transparent text-sm text-text outline-none truncate"
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(shareUrl);
                    showToast("Link copied to clipboard!", "success");
                  }}
                  className="btn btn-sm btn-primary flex items-center gap-1"
                >
                  <IoCopy size={14} /> Copy
                </button>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  );
};

export default AdminSetup;
