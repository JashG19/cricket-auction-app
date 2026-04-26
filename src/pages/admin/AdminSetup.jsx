import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuction } from "../../hooks/useAuction";
import { useRealtimeData } from "../../hooks/useRealtimeData";
import { useToast } from "../../components/Toast";
import { ToastContainer } from "../../components/ToastContainer";
import { Modal } from "../../components/Modal";
import { Header } from "../../components/Header";
import {
  validateAuctionSetup,
  validateTeam,
  validateGroup,
} from "../../utils/validationUtils";
import {
  firebaseObjectToArray,
  getImagePath,
} from "../../utils/dataTransformUtils";
import { ROUTES } from "../../constants/routes";
import { QRCodeSVG } from "qrcode.react";
import { useAuctionTemplate } from "../../hooks/useAuctionTemplate";
import {
  IoAdd,
  IoTrash,
  IoArrowForward,
  IoPeople,
  IoPlay,
  IoStatsChart,
  IoPencil,
  IoLayers,
  IoShareSocial,
  IoCopy,
  IoSettings,
  IoEye,
  IoEyeOff,
  IoSave,
  IoDocumentText,
  IoDownload,
} from "react-icons/io5";

export const AdminSetup = () => {
  const navigate = useNavigate();
  const {
    createAuction,
    addTeam,
    addGroup,
    deleteAuction,
    updateGroup,
    deleteGroup,
    updateTeam,
    deleteTeam,
    updateAuction,
    saveAuctionConfig,
    updateAuctionConfigOrder,
    duplicateAuction,
  } = useAuction();
  const { toasts, showToast, removeToast } = useToast();
  const [showCreateNew, setShowCreateNew] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [managingGroupsAuctionId, setManagingGroupsAuctionId] = useState(null);
  const [managingTeamsAuctionId, setManagingTeamsAuctionId] = useState(null);
  const [managingSettingsAuctionId, setManagingSettingsAuctionId] =
    useState(null);
  const [showExistingGroupModal, setShowExistingGroupModal] = useState(false);
  const [showExistingTeamModal, setShowExistingTeamModal] = useState(false);
  const [editingExistingGroup, setEditingExistingGroup] = useState(null);
  const [editingExistingTeam, setEditingExistingTeam] = useState(null);
  const [shareAuctionId, setShareAuctionId] = useState(null);
  const [existingGroupForm, setExistingGroupForm] = useState({
    group_name: "",
    base_price: "",
    increment_value: "",
    max_bid_cap: "",
    min_per_team: "1",
    max_per_team: "",
  });
  const [existingTeamForm, setExistingTeamForm] = useState({
    team_name: "",
    owner_name: "",
    budget_total: "",
    pin: "",
    team_logo: "",
  });

  // Fetch existing auctions
  const { data: auctionsData } = useRealtimeData("auctions");
  const existingAuctions = useMemo(
    () =>
      firebaseObjectToArray(auctionsData).sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
      ),
    [auctionsData],
  );

  // Template functionality
  const {
    saveTemplate,
    loadTemplate,
    listTemplates,
    deleteTemplate,
    applyTemplate,
    loading: templateLoading,
  } = useAuctionTemplate();
  const [templates, setTemplates] = useState([]);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  // Auction state
  const [auctionData, setAuctionData] = useState({
    name: "",
    purseSize: 1000000,
    maxPlayers: 25,
    maxPlayersPerTeam: 11,
    date: new Date().toISOString().split("T")[0],
    auctionMode: "open_after_aplus", // "open_after_aplus" or "sequential"
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
    team_logo: "",
  });
  const [groupForm, setGroupForm] = useState({
    group_name: "",
    base_price: "",
    increment_value: "",
    max_bid_cap: "",
    min_per_team: "1",
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
        auction_mode: auctionData.auctionMode,
      });

      // Add teams and groups in parallel
      await Promise.all([
        Promise.all(
          teams.map(({ id, ...teamDataWithoutId }) =>
            addTeam(auctionId, teamDataWithoutId),
          ),
        ),
        Promise.all(
          groups.map(({ id, ...groupDataWithoutId }, index) =>
            addGroup(auctionId, {
              ...groupDataWithoutId,
              order: groupDataWithoutId.order || index + 1,
            }),
          ),
        ),
      ]);

      // Save auction configuration (group rules, totals)
      await saveAuctionConfig(auctionId, groups);

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
      (t) =>
        t.team_name.toLowerCase().trim() ===
        teamForm.team_name.toLowerCase().trim(),
    );
    if (duplicate) {
      showToast(`Team "${teamForm.team_name}" already exists`, "error");
      return;
    }

    setTeams([
      ...teams,
      {
        ...teamForm,
        id: `local_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      },
    ]);
    setTeamForm({
      team_name: "",
      owner_name: "",
      budget_total: "",
      pin: "",
      team_logo: "",
    });
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

    // Auto-assign order based on current groups count
    const order = groups.length + 1;

    setGroups([
      ...groups,
      {
        ...groupForm,
        min_per_team: parseInt(groupForm.min_per_team) || 1,
        max_per_team: parseInt(groupForm.max_per_team) || 1,
        order,
        id: `local_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      },
    ]);
    setGroupForm({
      group_name: "",
      base_price: "",
      increment_value: "",
      max_bid_cap: "",
      min_per_team: "1",
      max_per_team: "",
    });
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

  // Load available templates
  const handleLoadTemplates = async () => {
    try {
      setLoadingTemplates(true);
      const templateList = await listTemplates();
      setTemplates(templateList);
      setShowTemplateModal(true);
    } catch (error) {
      showToast("Failed to load templates: " + error.message, "error");
    } finally {
      setLoadingTemplates(false);
    }
  };

  // Apply a template to the form
  const handleApplyTemplate = async (templateId) => {
    try {
      const template = await loadTemplate(templateId);
      const {
        auctionData: newAuctionData,
        teams: newTeams,
        groups: newGroups,
      } = applyTemplate(template);

      // Keep the current name and date, apply other settings
      setAuctionData({
        ...auctionData,
        purseSize: newAuctionData.purseSize,
        maxPlayers: newAuctionData.maxPlayers,
        maxPlayersPerTeam: newAuctionData.maxPlayersPerTeam,
        auctionMode: newAuctionData.auctionMode,
      });
      setTeams(newTeams);
      setGroups(newGroups);
      setShowTemplateModal(false);
      showToast(`Template "${template.template_name}" applied!`, "success");
    } catch (error) {
      showToast("Failed to apply template: " + error.message, "error");
    }
  };

  // Save current configuration as a template
  const handleSaveAsTemplate = async () => {
    if (!templateName.trim()) {
      showToast("Please enter a template name", "error");
      return;
    }
    if (teams.length === 0 && groups.length === 0) {
      showToast("Add at least one team or group to save as template", "error");
      return;
    }

    try {
      await saveTemplate(
        templateName.trim(),
        templateDescription.trim(),
        {
          purse_size: auctionData.purseSize,
          total_players: auctionData.maxPlayers,
          max_players_per_team: auctionData.maxPlayersPerTeam,
          auction_mode: auctionData.auctionMode,
        },
        teams,
        groups,
      );
      setShowSaveTemplateModal(false);
      setTemplateName("");
      setTemplateDescription("");
      showToast("Template saved successfully!", "success");
    } catch (error) {
      showToast("Failed to save template: " + error.message, "error");
    }
  };

  // Delete a template
  const handleDeleteTemplate = async (templateId) => {
    try {
      await deleteTemplate(templateId);
      setTemplates(templates.filter((t) => t.id !== templateId));
      showToast("Template deleted", "success");
    } catch (error) {
      showToast("Failed to delete template: " + error.message, "error");
    }
  };

  // Local group order state for existing auction sequential reordering
  const [localGroupOrder, setLocalGroupOrder] = useState({});
  const [draggedGroup, setDraggedGroup] = useState(null);

  // Fetch groups for the auction being managed
  const { data: managedGroupsData } = useRealtimeData(
    managingGroupsAuctionId
      ? `auctions/${managingGroupsAuctionId}/groups`
      : null,
  );

  // Fetch groups for the auction in the settings panel
  const { data: settingsGroupsData } = useRealtimeData(
    managingSettingsAuctionId
      ? `auctions/${managingSettingsAuctionId}/groups`
      : null,
  );
  const settingsGroupsList = useMemo(
    () =>
      firebaseObjectToArray(settingsGroupsData).sort(
        (a, b) => (a.order || 0) - (b.order || 0),
      ),
    [settingsGroupsData],
  );
  const managedGroupsList = firebaseObjectToArray(managedGroupsData);

  // Fetch players for the auction being managed (needed to check group assignments before delete)
  const { data: managedPlayersData } = useRealtimeData(
    managingGroupsAuctionId
      ? `auctions/${managingGroupsAuctionId}/players`
      : null,
  );
  const managedPlayersList = firebaseObjectToArray(managedPlayersData);

  // Fetch teams for the auction being managed
  const { data: managedTeamsData } = useRealtimeData(
    managingTeamsAuctionId ? `auctions/${managingTeamsAuctionId}/teams` : null,
  );
  const managedTeamsList = firebaseObjectToArray(managedTeamsData);

  // Delete an existing auction (blocked if currently live)
  const handleDeleteAuction = async (auctionId) => {
    // Check if auction has an active live_state
    const auctionObj = existingAuctions.find(
      (a) => String(a.id) === String(auctionId),
    );
    if (auctionObj?.live_state && !auctionObj.live_state.isComplete) {
      showToast(
        "Cannot delete — this auction is currently live. Complete or stop it first.",
        "error",
      );
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
    setExistingGroupForm(
      group
        ? {
            group_name: group.group_name || "",
            base_price: group.base_price || "",
            increment_value: group.increment_value || "",
            max_bid_cap: group.max_bid_cap || "",
            min_per_team: group.min_per_team || "1",
            max_per_team: group.max_per_team || "",
          }
        : {
            group_name: "",
            base_price: "",
            increment_value: "",
            max_bid_cap: "",
            min_per_team: "1",
            max_per_team: "",
          },
    );
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
        await updateGroup(
          managingGroupsAuctionId,
          editingExistingGroup.id,
          existingGroupForm,
        );
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

  // Open add/edit team modal for existing auctions
  const openExistingTeamModal = (team = null) => {
    setEditingExistingTeam(team);
    setExistingTeamForm(
      team
        ? {
            team_name: team.team_name || "",
            owner_name: team.owner_name || "",
            budget_total: team.budget_total || "",
            pin: team.pin || "",
            team_logo: team.team_logo || "",
          }
        : {
            team_name: "",
            owner_name: "",
            budget_total: "",
            pin: "",
            team_logo: "",
          },
    );
    setShowExistingTeamModal(true);
  };

  // Save (add or update) team for existing auction
  const handleSaveExistingTeam = async () => {
    const errors = validateTeam(existingTeamForm);
    if (errors) {
      showToast("Please fill team details correctly", "error");
      return;
    }

    try {
      if (editingExistingTeam) {
        await updateTeam(
          managingTeamsAuctionId,
          editingExistingTeam.id,
          existingTeamForm,
        );
        showToast(`${existingTeamForm.team_name} updated`, "success");
      } else {
        await addTeam(managingTeamsAuctionId, existingTeamForm);
        showToast("Team added!", "success");
      }
      setShowExistingTeamModal(false);
      setEditingExistingTeam(null);
    } catch (error) {
      showToast("Error: " + error.message, "error");
    }
  };

  // Delete team from existing auction
  const handleDeleteExistingTeam = async (teamId, teamName) => {
    try {
      await deleteTeam(managingTeamsAuctionId, teamId);
      showToast(`${teamName} deleted`, "success");
    } catch (error) {
      showToast("Error deleting team: " + error.message, "error");
    }
  };

  // Update auction mode for existing auction
  const handleUpdateAuctionMode = async (auctionId, newMode) => {
    try {
      await updateAuction(auctionId, { auction_mode: newMode });
      showToast(
        `Auction mode updated to ${newMode === "open_after_aplus" ? "Open After A+" : "Sequential Groups"}`,
        "success",
      );
    } catch (error) {
      showToast("Error updating auction mode: " + error.message, "error");
    }
  };

  // Reorder groups for new auction via drag-and-drop (fromId dropped onto toId)
  const handleReorderNewGroup = (fromId, toId) => {
    if (fromId === toId) return;
    const sorted = [...groups].sort((a, b) => a.order - b.order);
    const fromIdx = sorted.findIndex((g) => g.id === fromId);
    const toIdx = sorted.findIndex((g) => g.id === toId);
    if (fromIdx === -1 || toIdx === -1) return;
    const reordered = [...sorted];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    setGroups(reordered.map((g, i) => ({ ...g, order: i + 1 })));
  };

  // Get the current group order for an existing auction.
  // Always includes ALL groups from settingsGroupsList — config order takes
  // precedence for known groups, unknowns are appended at the end.
  const getExistingGroupOrder = (auction) => {
    if (localGroupOrder[auction.id]) return localGroupOrder[auction.id];
    const allNames = settingsGroupsList.map((g) => g.group_name);
    if (auction.config?.groupOrder) {
      const missing = allNames.filter(
        (n) => !auction.config.groupOrder.includes(n),
      );
      return [...auction.config.groupOrder, ...missing];
    }
    return allNames;
  };

  // Reorder groups for existing auction via drag-and-drop
  const handleDragDropReorder = (auctionId, fromName, toName) => {
    const auction = existingAuctions.find((a) => a.id === auctionId);
    const currentOrder = getExistingGroupOrder(auction);
    const fromIdx = currentOrder.indexOf(fromName);
    const toIdx = currentOrder.indexOf(toName);
    if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return;
    const newOrder = [...currentOrder];
    newOrder.splice(fromIdx, 1);
    newOrder.splice(toIdx, 0, fromName);
    setLocalGroupOrder((prev) => ({ ...prev, [auctionId]: newOrder }));
  };

  // Save group order for existing auction to Firebase
  const handleSaveGroupOrder = async (auctionId) => {
    const auction = existingAuctions.find((a) => a.id === auctionId);
    const order = getExistingGroupOrder(auction);
    try {
      await updateAuctionConfigOrder(auctionId, order);
      showToast("Group sequence saved!", "success");
    } catch (error) {
      showToast("Error saving group sequence: " + error.message, "error");
    }
  };

  // Hide/show auction from Home "Live Auctions" section
  const handleToggleLiveVisibility = async (auctionId, isHidden) => {
    try {
      await updateAuction(auctionId, { hidden_from_live: !isHidden });
      showToast(
        !isHidden
          ? "Auction hidden from Live Auctions section"
          : "Auction is visible in Live Auctions section",
        "success",
      );
    } catch (error) {
      showToast("Error updating visibility: " + error.message, "error");
    }
  };

  return (
    <div className="min-h-screen bg-lightBg transition-colors duration-300">
      {/* Header */}
      <Header showBranding={true} />

      <div className="p-3 sm:p-6">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <h1 className="text-2xl sm:text-4xl font-bold text-primary mb-2">
            Admin Dashboard
          </h1>
          <p className="text-textLight mb-8">Manage your cricket auctions</p>

          {/* Template Manager Section */}
          <div className="mb-8">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4">
              <h2 className="text-2xl font-bold text-primary">
                Saved Templates
              </h2>
              <button
                onClick={handleLoadTemplates}
                disabled={loadingTemplates}
                className="btn btn-secondary flex items-center gap-2 justify-center w-full sm:w-auto"
              >
                <IoDocumentText size={18} />
                {loadingTemplates ? "Loading..." : "Manage Templates"}
              </button>
            </div>
            <div className="card p-4 text-center text-textLight">
              <p className="text-sm">
                Save your auction configurations as reusable templates to
                quickly set up new auctions with the same teams and groups
                structure.
              </p>
            </div>
          </div>

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
                          {auction.date
                            ? new Date(auction.date).toLocaleDateString()
                            : "No date"}{" "}
                          | Purse: ₹{(auction.purse_size || 0).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span
                          className={`text-xs px-2 py-1 rounded-full font-bold ${
                            auction.status === "live"
                              ? "bg-success text-white"
                              : auction.status === "completed"
                                ? "bg-secondary text-primary"
                                : "bg-gray-200 text-textLight"
                          }`}
                        >
                          {auction.status || "setup"}
                        </span>
                        {auction.hidden_from_live && (
                          <span className="text-xs px-2 py-1 rounded-full font-bold bg-gray-300 text-gray-800">
                            Hidden from Live
                          </span>
                        )}
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
                        onClick={() =>
                          navigate(ROUTES.ADMIN_PLAYERS(auction.id))
                        }
                        className="btn btn-sm btn-primary flex items-center gap-1"
                      >
                        <IoPeople size={16} /> Players
                      </button>
                      <button
                        onClick={() =>
                          setManagingTeamsAuctionId(
                            managingTeamsAuctionId === auction.id
                              ? null
                              : auction.id,
                          )
                        }
                        className={`btn btn-sm flex items-center gap-1 ${
                          managingTeamsAuctionId === auction.id
                            ? "bg-primary text-white"
                            : "btn-secondary"
                        }`}
                      >
                        <IoPeople size={16} /> Teams
                      </button>
                      <button
                        onClick={() =>
                          setManagingGroupsAuctionId(
                            managingGroupsAuctionId === auction.id
                              ? null
                              : auction.id,
                          )
                        }
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
                        onClick={() =>
                          handleToggleLiveVisibility(
                            auction.id,
                            !!auction.hidden_from_live,
                          )
                        }
                        className={`btn btn-sm flex items-center gap-1 ${
                          auction.hidden_from_live
                            ? "bg-gray-500 text-white hover:bg-gray-600"
                            : "btn-secondary"
                        }`}
                        title={
                          auction.hidden_from_live
                            ? "Show in Live Auctions"
                            : "Hide from Live Auctions"
                        }
                      >
                        {auction.hidden_from_live ? (
                          <>
                            <IoEye size={16} /> Show Live
                          </>
                        ) : (
                          <>
                            <IoEyeOff size={16} /> Hide Live
                          </>
                        )}
                      </button>
                      <button
                        onClick={() =>
                          navigate(ROUTES.ADMIN_RESULTS(auction.id))
                        }
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
                      <button
                        onClick={() =>
                          setManagingSettingsAuctionId(
                            managingSettingsAuctionId === auction.id
                              ? null
                              : auction.id,
                          )
                        }
                        className={`btn btn-sm flex items-center gap-1 ${
                          managingSettingsAuctionId === auction.id
                            ? "bg-primary text-white"
                            : "btn-secondary"
                        }`}
                        title="Auction settings"
                      >
                        <IoSettings size={16} /> Settings
                      </button>
                      <button
                        onClick={async () => {
                          try {
                            await duplicateAuction(auction.id);
                            showToast(
                              `"Copy of ${auction.name}" created!`,
                              "success",
                            );
                          } catch (error) {
                            showToast(
                              "Failed to duplicate: " + error.message,
                              "error",
                            );
                          }
                        }}
                        className="btn btn-sm btn-secondary flex items-center gap-1"
                        title="Duplicate auction"
                      >
                        <IoCopy size={16} /> Duplicate
                      </button>
                    </div>

                    {/* Inline Settings Panel */}
                    {managingSettingsAuctionId === auction.id && (
                      <div className="mt-4 pt-4 border-t border-border">
                        <h4 className="font-bold text-text mb-3">
                          Auction Settings
                        </h4>
                        <div className="space-y-3">
                          <div>
                            <label className="block font-semibold text-text text-sm mb-2">
                              Auction Mode
                            </label>
                            <div className="flex flex-col sm:flex-row gap-3">
                              <label
                                className={`flex-1 cursor-pointer p-3 rounded-lg border-2 transition-all ${
                                  (auction.auction_mode ||
                                    "open_after_aplus") === "open_after_aplus"
                                    ? "border-primary bg-primary/10"
                                    : "border-border hover:border-primary/50"
                                }`}
                              >
                                <input
                                  type="radio"
                                  name={`auctionMode-${auction.id}`}
                                  value="open_after_aplus"
                                  checked={
                                    (auction.auction_mode ||
                                      "open_after_aplus") === "open_after_aplus"
                                  }
                                  onChange={() =>
                                    handleUpdateAuctionMode(
                                      auction.id,
                                      "open_after_aplus",
                                    )
                                  }
                                  className="sr-only"
                                />
                                <div className="flex items-center gap-2">
                                  <div
                                    className={`w-3 h-3 rounded-full border-2 flex items-center justify-center ${
                                      (auction.auction_mode ||
                                        "open_after_aplus") ===
                                      "open_after_aplus"
                                        ? "border-primary"
                                        : "border-textLight"
                                    }`}
                                  >
                                    {(auction.auction_mode ||
                                      "open_after_aplus") ===
                                      "open_after_aplus" && (
                                      <div className="w-1.5 h-1.5 rounded-full bg-primary"></div>
                                    )}
                                  </div>
                                  <span className="font-semibold text-text text-sm">
                                    Open After A+
                                  </span>
                                </div>
                                <p className="text-xs text-textLight ml-5 mt-1">
                                  A+ sequential → then random from remaining
                                  groups
                                </p>
                              </label>

                              <label
                                className={`flex-1 cursor-pointer p-3 rounded-lg border-2 transition-all ${
                                  auction.auction_mode === "sequential"
                                    ? "border-primary bg-primary/10"
                                    : "border-border hover:border-primary/50"
                                }`}
                              >
                                <input
                                  type="radio"
                                  name={`auctionMode-${auction.id}`}
                                  value="sequential"
                                  checked={
                                    auction.auction_mode === "sequential"
                                  }
                                  onChange={() =>
                                    handleUpdateAuctionMode(
                                      auction.id,
                                      "sequential",
                                    )
                                  }
                                  className="sr-only"
                                />
                                <div className="flex items-center gap-2">
                                  <div
                                    className={`w-3 h-3 rounded-full border-2 flex items-center justify-center ${
                                      auction.auction_mode === "sequential"
                                        ? "border-primary"
                                        : "border-textLight"
                                    }`}
                                  >
                                    {auction.auction_mode === "sequential" && (
                                      <div className="w-1.5 h-1.5 rounded-full bg-primary"></div>
                                    )}
                                  </div>
                                  <span className="font-semibold text-text text-sm">
                                    Sequential Groups
                                  </span>
                                </div>
                                <p className="text-xs text-textLight ml-5 mt-1">
                                  Groups one after another (A+ → A → B+ → B → C
                                  → D → X)
                                </p>
                              </label>
                            </div>

                            {/* Group sequence reorder — shown only in sequential mode */}
                            {auction.auction_mode === "sequential" &&
                              settingsGroupsList.length > 0 && (
                                <div className="mt-4 pt-3 border-t border-border">
                                  <p className="text-sm font-semibold text-text mb-1">
                                    Auction Sequence
                                  </p>
                                  <p className="text-xs text-textLight mb-2">
                                    Drag groups to reorder, then save.
                                  </p>
                                  <div className="space-y-1.5 mb-3">
                                    {getExistingGroupOrder(auction).map(
                                      (groupName, idx) => (
                                        <div
                                          key={groupName}
                                          draggable
                                          onDragStart={() =>
                                            setDraggedGroup(groupName)
                                          }
                                          onDragOver={(e) => e.preventDefault()}
                                          onDrop={() => {
                                            handleDragDropReorder(
                                              auction.id,
                                              draggedGroup,
                                              groupName,
                                            );
                                            setDraggedGroup(null);
                                          }}
                                          className={`flex items-center gap-2 p-2 border rounded-lg cursor-grab active:cursor-grabbing transition-colors ${
                                            draggedGroup === groupName
                                              ? "opacity-40 border-primary bg-primary/5"
                                              : "bg-lightBg border-border hover:border-primary/50"
                                          }`}
                                        >
                                          <span className="text-textLight text-sm select-none">
                                            ☰
                                          </span>
                                          <span className="text-xs text-textLight w-4 text-center">
                                            {idx + 1}.
                                          </span>
                                          <span className="text-sm font-medium text-text">
                                            {groupName}
                                          </span>
                                        </div>
                                      ),
                                    )}
                                  </div>
                                  <button
                                    onClick={() =>
                                      handleSaveGroupOrder(auction.id)
                                    }
                                    className="btn btn-primary btn-sm flex items-center gap-1"
                                  >
                                    <IoSave size={14} /> Save Sequence
                                  </button>
                                </div>
                              )}
                          </div>
                        </div>
                      </div>
                    )}
                    {managingTeamsAuctionId === auction.id && (
                      <div className="mt-4 pt-4 border-t border-border">
                        <div className="flex justify-between items-center mb-3">
                          <h4 className="font-bold text-text">
                            Teams ({managedTeamsList.length})
                          </h4>
                          <button
                            onClick={() => openExistingTeamModal()}
                            className="btn btn-primary btn-sm flex items-center gap-1"
                          >
                            <IoAdd size={16} /> Add Team
                          </button>
                        </div>

                        {managedTeamsList.length === 0 ? (
                          <p className="text-textLight text-sm py-2">
                            No teams yet
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {managedTeamsList.map((team) => (
                              <div
                                key={team.id}
                                className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 p-3 bg-lightBg border border-border rounded-lg"
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  {team.team_logo && (
                                    <img
                                      src={getImagePath(
                                        "team-logo",
                                        team.team_logo,
                                      )}
                                      alt={team.team_name}
                                      className="w-10 h-10 object-contain rounded border border-border flex-shrink-0"
                                      onError={(e) => {
                                        e.target.style.display = "none";
                                      }}
                                    />
                                  )}
                                  <div className="min-w-0">
                                    <p className="font-semibold text-text text-sm">
                                      {team.team_name}
                                    </p>
                                    <p className="text-xs text-textLight break-words">
                                      Owner: {team.owner_name} | Budget: ₹
                                      {(
                                        team.budget_total || 0
                                      ).toLocaleString()}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1 flex-shrink-0">
                                  <button
                                    onClick={() => openExistingTeamModal(team)}
                                    className="btn btn-sm btn-secondary"
                                    title="Edit team"
                                  >
                                    <IoPencil size={14} />
                                  </button>
                                  <button
                                    onClick={() =>
                                      handleDeleteExistingTeam(
                                        team.id,
                                        team.team_name,
                                      )
                                    }
                                    className="btn btn-danger btn-sm"
                                    title="Delete team"
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
                          <p className="text-textLight text-sm py-2">
                            No groups yet
                          </p>
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
                                    Base: ₹
                                    {(group.base_price || 0).toLocaleString()} |
                                    Inc: ₹
                                    {(
                                      group.increment_value || 0
                                    ).toLocaleString()}{" "}
                                    | Max: ₹
                                    {group.max_bid_cap
                                      ? group.max_bid_cap.toLocaleString()
                                      : "∞"}
                                    {group.max_per_team
                                      ? ` | ${group.max_per_team}/team`
                                      : ""}
                                  </p>
                                </div>
                                <div className="flex items-center gap-1 flex-shrink-0">
                                  <button
                                    onClick={() =>
                                      openExistingGroupModal(group)
                                    }
                                    className="btn btn-sm btn-secondary"
                                    title="Edit group"
                                  >
                                    <IoPencil size={14} />
                                  </button>
                                  <button
                                    onClick={() =>
                                      handleDeleteExistingGroup(
                                        group.id,
                                        group.group_name,
                                      )
                                    }
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
                <h2 className="text-2xl font-bold text-primary">
                  Create New Auction
                </h2>
                {existingAuctions.length > 0 && (
                  <button
                    onClick={() => setShowCreateNew(false)}
                    className="text-textLight hover:text-primary text-sm font-semibold"
                  >
                    Cancel
                  </button>
                )}
              </div>

              {/* Template Quick Start */}
              <div className="card mb-8 bg-gradient-to-r from-primary/10 to-accent/10 border-2 border-primary/20">
                <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-primary mb-1">
                      Quick Start with Templates
                    </h3>
                    <p className="text-sm text-textLight">
                      Load a saved template to auto-fill groups & teams
                      configuration
                    </p>
                  </div>
                  <button
                    onClick={handleLoadTemplates}
                    disabled={loadingTemplates}
                    className="btn btn-secondary flex items-center gap-2 whitespace-nowrap"
                  >
                    <IoDownload size={18} />
                    {loadingTemplates ? "Loading..." : "Use Template"}
                  </button>
                </div>
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

                  <div className="md:col-span-2">
                    <label className="block font-semibold text-text mb-3">
                      Auction Mode
                    </label>
                    <div className="flex flex-col sm:flex-row gap-4">
                      <label
                        className={`flex-1 cursor-pointer p-4 rounded-lg border-2 transition-all ${
                          auctionData.auctionMode === "open_after_aplus"
                            ? "border-primary bg-primary/10"
                            : "border-border hover:border-primary/50"
                        }`}
                      >
                        <input
                          type="radio"
                          name="auctionMode"
                          value="open_after_aplus"
                          checked={
                            auctionData.auctionMode === "open_after_aplus"
                          }
                          onChange={(e) =>
                            setAuctionData({
                              ...auctionData,
                              auctionMode: e.target.value,
                            })
                          }
                          className="sr-only"
                        />
                        <div className="flex items-center gap-2 mb-1">
                          <div
                            className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                              auctionData.auctionMode === "open_after_aplus"
                                ? "border-primary"
                                : "border-textLight"
                            }`}
                          >
                            {auctionData.auctionMode === "open_after_aplus" && (
                              <div className="w-2 h-2 rounded-full bg-primary"></div>
                            )}
                          </div>
                          <span className="font-semibold text-text">
                            Open After A+
                          </span>
                        </div>
                        <p className="text-sm text-textLight ml-6">
                          A+ players are auctioned first sequentially. After all
                          A+ are sold, players from remaining groups are
                          selected randomly.
                        </p>
                      </label>

                      <label
                        className={`flex-1 cursor-pointer p-4 rounded-lg border-2 transition-all ${
                          auctionData.auctionMode === "sequential"
                            ? "border-primary bg-primary/10"
                            : "border-border hover:border-primary/50"
                        }`}
                      >
                        <input
                          type="radio"
                          name="auctionMode"
                          value="sequential"
                          checked={auctionData.auctionMode === "sequential"}
                          onChange={(e) =>
                            setAuctionData({
                              ...auctionData,
                              auctionMode: e.target.value,
                            })
                          }
                          className="sr-only"
                        />
                        <div className="flex items-center gap-2 mb-1">
                          <div
                            className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                              auctionData.auctionMode === "sequential"
                                ? "border-primary"
                                : "border-textLight"
                            }`}
                          >
                            {auctionData.auctionMode === "sequential" && (
                              <div className="w-2 h-2 rounded-full bg-primary"></div>
                            )}
                          </div>
                          <span className="font-semibold text-text">
                            Sequential Groups
                          </span>
                        </div>
                        <p className="text-sm text-textLight ml-6">
                          Groups are auctioned one after another in order. (A+ →
                          A → B+ → B → C → D → X)
                        </p>
                      </label>
                    </div>

                    {/* Group sequence reorder — shown only in sequential mode */}
                    {auctionData.auctionMode === "sequential" &&
                      groups.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-border">
                          <p className="text-sm font-semibold text-text mb-2">
                            Auction Sequence
                          </p>
                          <p className="text-xs text-textLight mb-3">
                            Drag groups to set the auction order (top to
                            bottom).
                          </p>
                          <div className="space-y-2">
                            {[...groups]
                              .sort((a, b) => a.order - b.order)
                              .map((group, idx) => (
                                <div
                                  key={group.id}
                                  draggable
                                  onDragStart={() =>
                                    setDraggedGroup(group.id)
                                  }
                                  onDragOver={(e) => e.preventDefault()}
                                  onDrop={() => {
                                    handleReorderNewGroup(
                                      draggedGroup,
                                      group.id,
                                    );
                                    setDraggedGroup(null);
                                  }}
                                  className={`flex items-center gap-2 p-2 border rounded-lg cursor-grab active:cursor-grabbing transition-colors ${
                                    draggedGroup === group.id
                                      ? "opacity-40 border-primary bg-primary/5"
                                      : "bg-lightBg border-border hover:border-primary/50"
                                  }`}
                                >
                                  <span className="text-textLight text-sm select-none">
                                    ☰
                                  </span>
                                  <span className="text-xs text-textLight w-5 text-center">
                                    {idx + 1}.
                                  </span>
                                  <span className="text-sm font-medium text-text">
                                    {group.group_name}
                                  </span>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}
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
                        <div className="flex items-center gap-4 min-w-0">
                          {team.team_logo && (
                            <img
                              src={getImagePath("team-logo", team.team_logo)}
                              alt={team.team_name}
                              className="h-12 w-12 object-contain rounded border border-border flex-shrink-0"
                              onError={(e) => {
                                e.target.style.display = "none";
                              }}
                            />
                          )}
                          <div className="min-w-0">
                            <p className="font-semibold text-text">
                              {team.team_name}
                            </p>
                            <p className="text-sm text-textLight">
                              Owner: {team.owner_name} | Budget: ₹
                              {team.budget_total.toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => removeTeam(team.id)}
                          className="btn btn-danger btn-sm flex-shrink-0"
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
                            Base: ₹{group.base_price.toLocaleString()} | Inc: ₹
                            {group.increment_value.toLocaleString()} | Max: ₹
                            {group.max_bid_cap
                              ? group.max_bid_cap.toLocaleString()
                              : "∞"}
                            {group.max_per_team
                              ? ` | ${group.max_per_team}/team`
                              : ""}
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
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                <button
                  onClick={() =>
                    existingAuctions.length > 0
                      ? setShowCreateNew(false)
                      : navigate(ROUTES.HOME)
                  }
                  className="btn btn-sm border border-primary text-primary hover:bg-lightBg"
                >
                  Back
                </button>
                <button
                  onClick={() => setShowSaveTemplateModal(true)}
                  className="btn btn-secondary flex items-center gap-2 justify-center"
                >
                  <IoSave size={18} /> Save as Template
                </button>
                <button
                  onClick={handleCreateAuction}
                  className="btn btn-primary flex items-center gap-2 justify-center btn-lg"
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
            <div>
              <label className="block font-semibold text-text mb-2">
                Team Logo Filename (Optional)
              </label>
              <input
                type="text"
                value={teamForm.team_logo}
                onChange={(e) =>
                  setTeamForm({ ...teamForm, team_logo: e.target.value })
                }
                placeholder="e.g., warriors.png"
                className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:border-primary"
              />
              <p className="text-xs text-textLight mt-1">
                Place logo in public/images/team-logos/ folder
              </p>
              {teamForm.team_logo && (
                <div className="mt-3 flex justify-center">
                  <img
                    src={getImagePath("team-logo", teamForm.team_logo)}
                    alt="Team logo preview"
                    className="h-16 w-16 object-contain rounded border border-border"
                    onError={(e) => {
                      e.target.style.display = "none";
                    }}
                  />
                </div>
              )}
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
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-text mb-2">
                  Min Players Per Team
                </label>
                <input
                  type="number"
                  value={groupForm.min_per_team}
                  onChange={(e) =>
                    setGroupForm({
                      ...groupForm,
                      min_per_team: Number(e.target.value) || "1",
                    })
                  }
                  placeholder="Required minimum"
                  min="0"
                  className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:border-primary"
                />
                <p className="text-xs text-textLight mt-1">
                  Required for reserve budget calc
                </p>
              </div>
              <div>
                <label className="block font-semibold text-text mb-2">
                  Max Players Per Team
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
                  placeholder="Optional limit"
                  className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:border-primary"
                />
                <p className="text-xs text-textLight mt-1">
                  Leave empty for no limit
                </p>
              </div>
            </div>
          </div>
        </Modal>

        {/* Existing Auction Group Modal */}
        <Modal
          isOpen={showExistingGroupModal}
          title={
            editingExistingGroup
              ? `Edit ${editingExistingGroup.group_name}`
              : "Add Group"
          }
          onClose={() => {
            setShowExistingGroupModal(false);
            setEditingExistingGroup(null);
          }}
          onConfirm={handleSaveExistingGroup}
          confirmText={editingExistingGroup ? "Save Changes" : "Add Group"}
        >
          <div className="space-y-4">
            <div>
              <label className="block font-semibold text-text mb-2">
                Group Name
              </label>
              <input
                type="text"
                value={existingGroupForm.group_name}
                onChange={(e) =>
                  setExistingGroupForm({
                    ...existingGroupForm,
                    group_name: e.target.value,
                  })
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
                value={existingGroupForm.base_price}
                onChange={(e) =>
                  setExistingGroupForm({
                    ...existingGroupForm,
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
                value={existingGroupForm.increment_value}
                onChange={(e) =>
                  setExistingGroupForm({
                    ...existingGroupForm,
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
                value={existingGroupForm.max_bid_cap}
                onChange={(e) =>
                  setExistingGroupForm({
                    ...existingGroupForm,
                    max_bid_cap: Number(e.target.value) || "",
                  })
                }
                placeholder="Leave empty for no cap"
                className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:border-primary"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-text mb-2">
                  Min Players Per Team
                </label>
                <input
                  type="number"
                  value={existingGroupForm.min_per_team}
                  onChange={(e) =>
                    setExistingGroupForm({
                      ...existingGroupForm,
                      min_per_team: Number(e.target.value) || "1",
                    })
                  }
                  placeholder="Required minimum"
                  min="0"
                  className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:border-primary"
                />
                <p className="text-xs text-textLight mt-1">
                  Required for reserve budget calc
                </p>
              </div>
              <div>
                <label className="block font-semibold text-text mb-2">
                  Max Players Per Team
                </label>
                <input
                  type="number"
                  value={existingGroupForm.max_per_team}
                  onChange={(e) =>
                    setExistingGroupForm({
                      ...existingGroupForm,
                      max_per_team: Number(e.target.value) || "",
                    })
                  }
                  placeholder="Optional limit"
                  className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:border-primary"
                />
                <p className="text-xs text-textLight mt-1">
                  Leave empty for no limit
                </p>
              </div>
            </div>
          </div>
        </Modal>

        {/* Existing Auction Team Modal */}
        <Modal
          isOpen={showExistingTeamModal}
          title={
            editingExistingTeam
              ? `Edit ${editingExistingTeam.team_name}`
              : "Add Team"
          }
          onClose={() => {
            setShowExistingTeamModal(false);
            setEditingExistingTeam(null);
          }}
          onConfirm={handleSaveExistingTeam}
          confirmText={editingExistingTeam ? "Save Changes" : "Add Team"}
        >
          <div className="space-y-4">
            <div>
              <label className="block font-semibold text-text mb-2">
                Team Name
              </label>
              <input
                type="text"
                value={existingTeamForm.team_name}
                onChange={(e) =>
                  setExistingTeamForm({
                    ...existingTeamForm,
                    team_name: e.target.value,
                  })
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
                value={existingTeamForm.owner_name}
                onChange={(e) =>
                  setExistingTeamForm({
                    ...existingTeamForm,
                    owner_name: e.target.value,
                  })
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
                value={existingTeamForm.budget_total}
                onChange={(e) =>
                  setExistingTeamForm({
                    ...existingTeamForm,
                    budget_total: Number(e.target.value),
                  })
                }
                placeholder="e.g., 100000000"
                className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block font-semibold text-text mb-2">
                Team PIN
              </label>
              <input
                type="text"
                value={existingTeamForm.pin}
                onChange={(e) =>
                  setExistingTeamForm({
                    ...existingTeamForm,
                    pin: e.target.value,
                  })
                }
                placeholder="e.g., 1234"
                maxLength={6}
                className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:border-primary"
              />
              <p className="text-xs text-textLight mt-1">
                Team owners use this PIN to access their team view
              </p>
            </div>
            <div>
              <label className="block font-semibold text-text mb-2">
                Team Logo Filename (Optional)
              </label>
              <input
                type="text"
                value={existingTeamForm.team_logo}
                onChange={(e) =>
                  setExistingTeamForm({
                    ...existingTeamForm,
                    team_logo: e.target.value,
                  })
                }
                placeholder="e.g., warriors.png"
                className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:border-primary"
              />
              <p className="text-xs text-textLight mt-1">
                Place logo in public/images/team-logos/ folder
              </p>
              {existingTeamForm.team_logo && (
                <div className="mt-3 flex justify-center">
                  <img
                    src={getImagePath("team-logo", existingTeamForm.team_logo)}
                    alt="Team logo preview"
                    className="h-16 w-16 object-contain rounded border border-border"
                    onError={(e) => {
                      e.target.style.display = "none";
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        </Modal>

        {/* QR Code Share Modal */}
        <Modal
          isOpen={!!shareAuctionId}
          title="Share Auction Link"
          onClose={() => setShareAuctionId(null)}
        >
          {shareAuctionId &&
            (() => {
              const shareUrl = `${window.location.origin}/auction/${shareAuctionId}`;
              const auction = existingAuctions.find(
                (a) => String(a.id) === String(shareAuctionId),
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

        {/* Load Template Modal */}
        <Modal
          isOpen={showTemplateModal}
          title="Load Template"
          onClose={() => setShowTemplateModal(false)}
          size="large"
        >
          <div className="space-y-4">
            {loadingTemplates ? (
              <div className="py-8 text-center text-textLight">
                Loading templates...
              </div>
            ) : templates.length === 0 ? (
              <div className="py-8 text-center text-textLight">
                No templates saved yet. Create an auction configuration and save
                it as a template to reuse later.
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {templates.map((template) => (
                  <div
                    key={template.id}
                    className="p-4 border border-border rounded-lg hover:bg-gray-50 transition"
                  >
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
                      <div className="min-w-0">
                        <h3 className="font-bold text-text mb-1">
                          {template.template_name}
                        </h3>
                        <p className="text-sm text-textLight mb-2">
                          {template.description}
                        </p>
                        <p className="text-xs text-textLight">
                          Teams: {template.team_template?.length || 0} | Groups:{" "}
                          {template.group_template?.length || 0} | Mode:{" "}
                          {template.auction_settings?.auction_mode || "N/A"}
                        </p>
                      </div>
                      <div className="flex gap-2 self-end sm:self-auto">
                        <button
                          onClick={() => handleApplyTemplate(template.id)}
                          className="btn btn-primary btn-sm"
                        >
                          Use
                        </button>
                        <button
                          onClick={() => handleDeleteTemplate(template.id)}
                          className="btn btn-danger btn-sm"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Modal>

        {/* Save as Template Modal */}
        <Modal
          isOpen={showSaveTemplateModal}
          title="Save as Template"
          onClose={() => {
            setShowSaveTemplateModal(false);
            setTemplateName("");
            setTemplateDescription("");
          }}
          onConfirm={handleSaveAsTemplate}
          confirmText="Save Template"
        >
          <div className="space-y-4">
            <div>
              <label className="block font-semibold text-text mb-2">
                Template Name *
              </label>
              <input
                type="text"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="e.g., IPL Standard 10-Team"
                className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block font-semibold text-text mb-2">
                Description (Optional)
              </label>
              <textarea
                value={templateDescription}
                onChange={(e) => setTemplateDescription(e.target.value)}
                placeholder="Describe this template configuration..."
                rows="3"
                className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:border-primary"
              />
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-blue-700">
                <strong>Saved:</strong> {teams.length} teams, {groups.length}{" "}
                groups
                <br />
                <strong>Settings:</strong> ₹
                {auctionData.purseSize.toLocaleString()} purse,{" "}
                {auctionData.maxPlayers} players
              </p>
            </div>
          </div>
        </Modal>

        {/* Toast Notifications */}
        <ToastContainer toasts={toasts} removeToast={removeToast} />
      </div>
    </div>
  );
};

export default AdminSetup;
