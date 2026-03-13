import { useState } from "react";
import { useParams } from "react-router-dom";
import { useAuction } from "../../hooks/useAuction";
import { useRealtimeData } from "../../hooks/useRealtimeData";
import { useToast } from "../../components/Toast";
import { Modal } from "../../components/Modal";
import { parsePlayersCSV } from "../../utils/exportUtils";
import { validatePlayer } from "../../utils/validationUtils";
import { IoAdd, IoTrash, IoDownload } from "react-icons/io5";

export const AdminPlayers = () => {
  const { auctionId } = useParams();
  const { addPlayer } = useAuction();
  const { data: playersData } = useRealtimeData(
    `auctions/${auctionId}/players`,
  );
  const { data: groupsData } = useRealtimeData(`auctions/${auctionId}/groups`);
  const { showToast } = useToast();

  const [showModal, setShowModal] = useState(false);
  const [playerForm, setPlayerForm] = useState({
    player_name: "",
    age: "",
    group_id: "",
    base_price: "",
    photo_url: "",
    role: "Batsman",
    nationality: "India",
  });

  const playersList = playersData
    ? Object.entries(playersData).map(([id, player]) => ({ id, ...player }))
    : [];
  const groupsList = groupsData
    ? Object.entries(groupsData).map(([id, group]) => ({ id, ...group }))
    : [];

  // Add single player
  const handleAddPlayer = async () => {
    const errors = validatePlayer(playerForm);
    if (errors) {
      showToast("Please fill player details correctly", "error");
      return;
    }

    try {
      await addPlayer(auctionId, playerForm);
      showToast("Player added successfully!", "success");
      setPlayerForm({
        player_name: "",
        age: "",
        group_id: "",
        base_price: "",
        photo_url: "",
        role: "Batsman",
        nationality: "India",
      });
      setShowModal(false);
    } catch (error) {
      showToast("Error adding player: " + error.message, "error");
    }
  };

  // Bulk upload CSV
  const handleBulkUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const playersList = await parsePlayersCSV(file);

      let addedCount = 0;
      for (const player of playersList) {
        if (!player.player_name) continue;

        const playerData = {
          player_name: player.player_name,
          age: Number(player.age),
          group_id: player.group_id,
          base_price: Number(player.base_price),
          photo_url: player.photo_url || "",
          role: player.role || "Batsman",
          nationality: player.nationality || "India",
        };

        const errors = validatePlayer(playerData);
        if (!errors) {
          await addPlayer(auctionId, playerData);
          addedCount++;
        }
      }

      showToast(`${addedCount} players added successfully!`, "success");
      e.target.value = ""; // Reset file input
    } catch (error) {
      showToast("Error uploading CSV: " + error.message, "error");
    }
  };

  // Download CSV template
  const downloadTemplate = () => {
    const template = `player_name,age,group_id,base_price,photo_url,role,nationality
Virat Kohli,35,group_a_plus,1000000,https://example.com/virat.jpg,Batsman,India
Rohit Sharma,36,group_a_plus,900000,https://example.com/rohit.jpg,Batsman,India
Jasprit Bumrah,30,group_a,800000,https://example.com/bumrah.jpg,Bowler,India`;

    const element = document.createElement("a");
    element.setAttribute(
      "href",
      `data:text/csv;charset=utf-8,${encodeURIComponent(template)}`,
    );
    element.setAttribute("download", "players_template.csv");
    element.click();
    showToast("Template downloaded!", "success");
  };

  return (
    <div className="min-h-screen bg-lightBg p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-primary">Manage Players</h1>
            <p className="text-textLight">
              Total Players: {playersList.length}
            </p>
          </div>
          <div className="flex gap-4">
            <button
              onClick={downloadTemplate}
              className="btn btn-secondary flex items-center gap-2"
            >
              <IoDownload size={20} /> Download Template
            </button>
            <label className="btn btn-secondary cursor-pointer flex items-center gap-2">
              <IoDownload size={20} /> Bulk Upload CSV
              <input
                type="file"
                accept=".csv"
                onChange={handleBulkUpload}
                hidden
              />
            </label>
            <button
              onClick={() => setShowModal(true)}
              className="btn btn-primary flex items-center gap-2"
            >
              <IoAdd size={20} /> Add Player
            </button>
          </div>
        </div>

        {/* Players Table */}
        <div className="card">
          {playersList.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-lg text-textLight mb-4">
                No players added yet
              </p>
              <button
                onClick={() => setShowModal(true)}
                className="btn btn-primary"
              >
                Add First Player
              </button>
            </div>
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
                    <th className="text-left py-4 px-4 font-bold text-primary">
                      Base Price
                    </th>
                    <th className="text-left py-4 px-4 font-bold text-primary">
                      Role
                    </th>
                    <th className="text-left py-4 px-4 font-bold text-primary">
                      Nationality
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {playersList.map((player, idx) => {
                    const group = groupsList.find(
                      (g) => g.id === player.group_id,
                    );
                    return (
                      <tr
                        key={player.id}
                        className="border-b border-border hover:bg-gray-50 transition"
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
                        </td>
                        <td className="py-4 px-4 text-text font-semibold">
                          ₹{(player.base_price || 0).toLocaleString()}
                        </td>
                        <td className="py-4 px-4 text-textLight">
                          {player.role || "N/A"}
                        </td>
                        <td className="py-4 px-4 text-textLight">
                          {player.nationality || "N/A"}
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

      {/* Add Player Modal */}
      <Modal
        isOpen={showModal}
        title="Add Player"
        onClose={() => setShowModal(false)}
        onConfirm={handleAddPlayer}
        confirmText="Add Player"
      >
        <div className="space-y-4 max-h-96 overflow-y-auto">
          <div>
            <label className="block font-semibold text-text mb-2">
              Player Name
            </label>
            <input
              type="text"
              value={playerForm.player_name}
              onChange={(e) =>
                setPlayerForm({ ...playerForm, player_name: e.target.value })
              }
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
                onChange={(e) =>
                  setPlayerForm({ ...playerForm, age: Number(e.target.value) })
                }
                placeholder="e.g., 35"
                className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="block font-semibold text-text mb-2">
                Group
              </label>
              <select
                value={playerForm.group_id}
                onChange={(e) =>
                  setPlayerForm({ ...playerForm, group_id: e.target.value })
                }
                className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:border-primary"
              >
                <option value="">Select Group</option>
                {groupsList.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.group_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-text mb-2">
              Base Price (₹)
            </label>
            <input
              type="number"
              value={playerForm.base_price}
              onChange={(e) =>
                setPlayerForm({
                  ...playerForm,
                  base_price: Number(e.target.value),
                })
              }
              placeholder="e.g., 1000000"
              className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="block font-semibold text-text mb-2">
              Photo URL (Optional)
            </label>
            <input
              type="url"
              value={playerForm.photo_url}
              onChange={(e) =>
                setPlayerForm({ ...playerForm, photo_url: e.target.value })
              }
              placeholder="https://example.com/photo.jpg"
              className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:border-primary"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-text mb-2">Role</label>
              <select
                value={playerForm.role}
                onChange={(e) =>
                  setPlayerForm({ ...playerForm, role: e.target.value })
                }
                className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:border-primary"
              >
                <option>Batsman</option>
                <option>Bowler</option>
                <option>All-rounder</option>
                <option>Wicket-keeper</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-text mb-2">
                Nationality
              </label>
              <input
                type="text"
                value={playerForm.nationality}
                onChange={(e) =>
                  setPlayerForm({ ...playerForm, nationality: e.target.value })
                }
                placeholder="e.g., India"
                className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:border-primary"
              />
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default AdminPlayers;
