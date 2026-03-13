import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useRealtimeData } from "../../hooks/useRealtimeData";
import { useToast } from "../../components/Toast";
import {
  exportToCSV,
  exportToExcel,
  generateAuctionSummary,
} from "../../utils/exportUtils";
import { IoDownload, IoArrowBack } from "react-icons/io5";

export const AdminResults = () => {
  const { auctionId } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const { data: auctionData } = useRealtimeData(`auctions/${auctionId}`);
  const { data: playersData } = useRealtimeData(
    `auctions/${auctionId}/players`,
  );
  const { data: teamsData } = useRealtimeData(`auctions/${auctionId}/teams`);
  const { data: groupsData } = useRealtimeData(`auctions/${auctionId}/groups`);

  const playersList = playersData
    ? Object.entries(playersData).map(([id, player]) => ({ id, ...player }))
    : [];
  const teamsList = teamsData
    ? Object.entries(teamsData).map(([id, team]) => ({ id, ...team }))
    : [];
  const groupsList = groupsData
    ? Object.entries(groupsData).map(([id, group]) => ({ id, ...group }))
    : [];

  // Calculate stats
  const totalPlayers = playersList.length;
  const soldPlayers = playersList.filter((p) => p.soldPrice).length;
  const unsoldPlayers = totalPlayers - soldPlayers;
  const totalSpent = teamsList.reduce(
    (sum, team) => sum + (team.budget_total - team.budget_remaining),
    0,
  );

  // Export functions
  const handleExportCSV = () => {
    try {
      const playersWithGroup = playersList.map((p) => ({
        ...p,
        group_name:
          groupsList.find((g) => g.id === p.group_id)?.group_name || "N/A",
      }));
      exportToCSV(
        teamsList,
        playersWithGroup,
        `${auctionData?.name || "auction"}_results.csv`,
      );
      showToast("CSV exported successfully!", "success");
    } catch (error) {
      showToast("Error exporting CSV: " + error.message, "error");
    }
  };

  const handleExportExcel = () => {
    try {
      const playersWithGroup = playersList.map((p) => ({
        ...p,
        group_name:
          groupsList.find((g) => g.id === p.group_id)?.group_name || "N/A",
      }));
      exportToExcel(
        teamsList,
        playersWithGroup,
        `${auctionData?.name || "auction"}_results.xlsx`,
      );
      showToast("Excel exported successfully!", "success");
    } catch (error) {
      showToast("Error exporting Excel: " + error.message, "error");
    }
  };

  return (
    <div className="min-h-screen bg-lightBg p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-primary">
              {auctionData?.name} - Results
            </h1>
            <p className="text-textLight">Auction Summary & Export</p>
          </div>
          <button
            onClick={() => navigate(-1)}
            className="btn btn-secondary flex items-center gap-2"
          >
            <IoArrowBack size={20} /> Back
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid md:grid-cols-4 gap-4 mb-8">
          <div className="card text-center">
            <p className="text-textLight mb-2">Total Teams</p>
            <p className="text-4xl font-bold text-primary">
              {teamsList.length}
            </p>
          </div>
          <div className="card text-center">
            <p className="text-textLight mb-2">Total Players</p>
            <p className="text-4xl font-bold text-primary">{totalPlayers}</p>
          </div>
          <div className="card text-center">
            <p className="text-textLight mb-2">Sold Players</p>
            <p className="text-4xl font-bold text-secondary">{soldPlayers}</p>
          </div>
          <div className="card text-center">
            <p className="text-textLight mb-2">Unsold Players</p>
            <p className="text-4xl font-bold text-danger">{unsoldPlayers}</p>
          </div>
        </div>

        {/* Total Amount */}
        <div className="card mb-8 bg-gradient-to-r from-primary to-accent p-8">
          <p className="text-white text-lg mb-2">Total Amount Spent</p>
          <p className="text-5xl font-bold text-secondary">
            ₹{totalSpent.toLocaleString()}
          </p>
          <p className="text-white text-sm mt-3">
            Purse: ₹{(auctionData?.purse_size || 0).toLocaleString()}
          </p>
        </div>

        {/* Export Buttons */}
        <div className="card mb-8">
          <h2 className="text-2xl font-bold text-primary mb-6">
            Export Results
          </h2>
          <div className="flex flex-col md:flex-row gap-4">
            <button
              onClick={handleExportCSV}
              className="btn btn-primary flex-1 flex items-center justify-center gap-2 btn-lg"
            >
              <IoDownload size={20} /> Export as CSV
            </button>
            <button
              onClick={handleExportExcel}
              className="btn btn-secondary flex-1 flex items-center justify-center gap-2 btn-lg"
            >
              <IoDownload size={20} /> Export as Excel
            </button>
          </div>
        </div>

        {/* Team-wise Summary */}
        <div className="card mb-8">
          <h2 className="text-2xl font-bold text-primary mb-6">
            Team-wise Summary
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-border">
                  <th className="text-left py-4 px-4 font-bold text-primary">
                    Team
                  </th>
                  <th className="text-left py-4 px-4 font-bold text-primary">
                    Owner
                  </th>
                  <th className="text-right py-4 px-4 font-bold text-primary">
                    Budget
                  </th>
                  <th className="text-right py-4 px-4 font-bold text-primary">
                    Spent
                  </th>
                  <th className="text-right py-4 px-4 font-bold text-primary">
                    Remaining
                  </th>
                  <th className="text-center py-4 px-4 font-bold text-primary">
                    Players
                  </th>
                </tr>
              </thead>
              <tbody>
                {teamsList.map((team) => {
                  const spent = team.budget_total - team.budget_remaining;
                  const spentPercent = (spent / team.budget_total) * 100;
                  return (
                    <tr
                      key={team.id}
                      className="border-b border-border hover:bg-gray-50 transition"
                    >
                      <td className="py-4 px-4 font-bold text-primary">
                        {team.team_name}
                      </td>
                      <td className="py-4 px-4 text-text">{team.owner_name}</td>
                      <td className="py-4 px-4 text-right font-semibold">
                        ₹{(team.budget_total || 0).toLocaleString()}
                      </td>
                      <td className="py-4 px-4">
                        <div className="text-right mb-2">
                          <p className="font-semibold text-text">
                            ₹{spent.toLocaleString()}
                          </p>
                          <p className="text-xs text-textLight">
                            {spentPercent.toFixed(1)}%
                          </p>
                        </div>
                        <div className="w-32 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-secondary h-2 rounded-full"
                            style={{ width: `${spentPercent}%` }}
                          ></div>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <span
                          className={
                            team.budget_remaining > 0
                              ? "text-success font-bold"
                              : "text-danger font-bold"
                          }
                        >
                          ₹{(team.budget_remaining || 0).toLocaleString()}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <span className="bg-primary text-white px-3 py-1 rounded-full font-bold">
                          {team.squad?.length || 0}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Unsold Players */}
        {unsoldPlayers > 0 && (
          <div className="card">
            <h2 className="text-2xl font-bold text-primary mb-6">
              Unsold Players ({unsoldPlayers})
            </h2>
            <div className="grid md:grid-cols-3 gap-4">
              {playersList
                .filter((p) => !p.soldPrice)
                .map((player) => {
                  const group = groupsList.find(
                    (g) => g.id === player.group_id,
                  );
                  return (
                    <div
                      key={player.id}
                      className="p-4 border border-border rounded-lg"
                    >
                      <p className="font-bold text-text">
                        {player.player_name}
                      </p>
                      <p className="text-sm text-textLight mb-2">
                        Age: {player.age}
                      </p>
                      <p className="text-xs mb-2">
                        <span className="bg-secondary text-primary px-2 py-1 rounded">
                          {group?.group_name}
                        </span>
                      </p>
                      <p className="text-sm font-semibold text-primary">
                        Base: ₹{(player.base_price || 0).toLocaleString()}
                      </p>
                    </div>
                  );
                })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminResults;
