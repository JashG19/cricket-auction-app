import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuction } from "../../hooks/useAuction";
import { useToast } from "../../components/Toast";
import { Modal } from "../../components/Modal";
import {
  validateAuctionSetup,
  validateTeam,
  validateGroup,
} from "../../utils/validationUtils";
import { IoAdd, IoTrash, IoArrowForward } from "react-icons/io5";

export const AdminSetup = () => {
  const navigate = useNavigate();
  const { createAuction, addTeam, addGroup } = useAuction();
  const { showToast } = useToast();

  // Auction state
  const [auctionData, setAuctionData] = useState({
    name: "",
    purseSize: 1000000,
    maxPlayers: 25,
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
  });
  const [groupForm, setGroupForm] = useState({
    group_name: "",
    increment_value: "",
    max_bid_cap: "",
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
        date: auctionData.date,
      });

      // Add teams
      for (const team of teams) {
        await addTeam(auctionId, team);
      }

      // Add groups
      for (const group of groups) {
        await addGroup(auctionId, group);
      }

      showToast("Auction created successfully!", "success");
      navigate("/admin/players", { state: { auctionId } });
    } catch (error) {
      showToast("Failed to create auction: " + error.message, "error");
    }
  };

  // Add team
  const handleAddTeam = () => {
    const errors = validateTeam(teamForm);
    if (errors) {
      showToast("Please fill team details correctly", "error");
      return;
    }

    setTeams([...teams, { ...teamForm, id: Date.now() }]);
    setTeamForm({ team_name: "", owner_name: "", budget_total: "" });
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

    setGroups([...groups, { ...groupForm, id: Date.now() }]);
    setGroupForm({ group_name: "", increment_value: "", max_bid_cap: "" });
    setShowGroupModal(false);
    showToast("Group added", "success");
  };

  // Remove team
  const removeTeam = (id) => {
    setTeams(teams.filter((t) => t.id !== id));
    showToast("Team removed", "success");
  };

  // Remove group
  const removeGroup = (id) => {
    setGroups(groups.filter((g) => g.id !== id));
    showToast("Group removed", "success");
  };

  return (
    <div className="min-h-screen bg-lightBg p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <h1 className="text-4xl font-bold text-primary mb-2">Create Auction</h1>
        <p className="text-textLight mb-8">
          Set up your cricket auction with teams and player groups
        </p>

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
                  className="flex justify-between items-center p-4 bg-lightBg border border-border rounded-lg"
                >
                  <div>
                    <p className="font-semibold text-text">
                      {group.group_name}
                    </p>
                    <p className="text-sm text-textLight">
                      Increment: ₹{group.increment_value.toLocaleString()} | Max
                      Price: ₹
                      {group.max_bid_cap
                        ? group.max_bid_cap.toLocaleString()
                        : "Unlimited"}
                    </p>
                  </div>
                  <button
                    onClick={() => removeGroup(group.id)}
                    className="btn btn-danger btn-sm"
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
            onClick={() => navigate("/")}
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
        </div>
      </Modal>
    </div>
  );
};

export default AdminSetup;
