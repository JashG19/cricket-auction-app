import { useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useRealtimeData } from "../../hooks/useRealtimeData";
import { useToast } from "../../components/Toast";
import { ToastContainer } from "../../components/ToastContainer";
import { Header } from "../../components/Header";
import {
  exportToCSV,
  exportToExcel,
  exportToPDF,
  warmExportDeps,
} from "../../utils/exportUtils";
import {
  firebaseObjectToArray,
  createLookupMap,
  calculateSpentBudget,
} from "../../utils/dataTransformUtils";
import { IoDownload, IoArrowBack, IoDocument } from "react-icons/io5";

export const AdminResults = () => {
  const { auctionId } = useParams();
  const navigate = useNavigate();
  const { toasts, showToast, removeToast } = useToast();
  const [exportingType, setExportingType] = useState(null);

  const { data: auctionData } = useRealtimeData(`auctions/${auctionId}`);
  const { data: playersData } = useRealtimeData(
    `auctions/${auctionId}/players`,
  );
  const { data: teamsData } = useRealtimeData(`auctions/${auctionId}/teams`);
  const { data: groupsData } = useRealtimeData(`auctions/${auctionId}/groups`);

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
  const groupsById = useMemo(() => createLookupMap(groupsList), [groupsList]);

  // Calculate stats
  const totalPlayers = playersList.length;
  const soldPlayers = playersList.filter((p) => p.soldTo).length;
  const unsoldPlayers = playersList.filter((p) => p.unsold && !p.soldTo).length;
  const pendingPlayers = totalPlayers - soldPlayers - unsoldPlayers;
  const totalSpent = teamsList.reduce(
    (sum, team) => sum + calculateSpentBudget(team),
    0,
  );

  const teamsById = useMemo(() => createLookupMap(teamsList), [teamsList]);

  // Shared: enrich players with group name, base_price, and team name for export
  const playersWithGroup = useMemo(
    () =>
      playersList.map((p) => {
        const group = groupsById.get(String(p.group_id));
        const team = p.soldTo ? teamsById.get(String(p.soldTo)) : null;
        return {
          ...p,
          group_name: group?.group_name || "N/A",
          base_price: group?.base_price || 0,
          team_name: team?.team_name || (p.soldTo ? "Unknown" : "-"),
        };
      }),
    [playersList, groupsById, teamsById],
  );

  // Export functions
  const handleExportCSV = async () => {
    setExportingType("csv");
    try {
      exportToCSV(
        teamsList,
        playersWithGroup,
        `${auctionData?.name || "auction"}_results.csv`,
      );
      showToast("CSV exported successfully!", "success");
    } catch (error) {
      showToast(`Error exporting CSV: ${error.message}`, "error");
    } finally {
      setExportingType(null);
    }
  };

  const handleExportExcel = async () => {
    setExportingType("excel");
    try {
      await exportToExcel(
        teamsList,
        playersWithGroup,
        `${auctionData?.name || "auction"}_results.xlsx`,
      );
      showToast("Excel exported successfully!", "success");
    } catch (error) {
      showToast(`Error exporting Excel: ${error.message}`, "error");
    } finally {
      setExportingType(null);
    }
  };

  const handleExportPDF = async () => {
    setExportingType("pdf");
    try {
      await exportToPDF(
        auctionData,
        teamsList,
        playersWithGroup,
        `${auctionData?.name || "auction"}_results.pdf`,
      );
      showToast("PDF exported successfully!", "success");
    } catch (error) {
      showToast(`Error exporting PDF: ${error.message}`, "error");
    } finally {
      setExportingType(null);
    }
  };

  return (
    <div className="min-h-screen bg-lightBg transition-colors duration-300">
      {/* Header */}
      <Header showBranding={true} />

      <div className="p-3 sm:p-6">
        <div className="max-w-6xl mx-auto">
          {/* Page Title */}
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-6 sm:mb-8">
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-4xl font-bold text-primary truncate">
                {auctionData?.name} - Results
              </h1>
              <p className="text-textLight text-sm">Auction Summary & Export</p>
            </div>
            <button
              onClick={() => navigate(-1)}
              className="btn btn-sm btn-secondary flex items-center gap-2 self-start sm:self-auto"
            >
              <IoArrowBack size={18} /> Back
            </button>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
            <div className="card card-hover text-center p-4">
              <p className="text-textLight text-xs sm:text-base mb-1 sm:mb-2">
                Total Teams
              </p>
              <p className="text-2xl sm:text-4xl font-bold text-primary">
                {teamsList.length}
              </p>
            </div>
            <div className="card card-hover text-center p-4">
              <p className="text-textLight text-xs sm:text-base mb-1 sm:mb-2">
                Total Players
              </p>
              <p className="text-2xl sm:text-4xl font-bold text-primary">
                {totalPlayers}
              </p>
            </div>
            <div className="card card-hover text-center p-4">
              <p className="text-textLight text-xs sm:text-base mb-1 sm:mb-2">
                Sold Players
              </p>
              <p className="text-2xl sm:text-4xl font-bold text-secondary">
                {soldPlayers}
              </p>
            </div>
            <div className="card card-hover text-center p-4">
              <p className="text-textLight text-xs sm:text-base mb-1 sm:mb-2">
                Unsold Players
              </p>
              <p className="text-2xl sm:text-4xl font-bold text-danger">
                {unsoldPlayers}
              </p>
            </div>
          </div>

          {/* Total Amount */}
          <div className="card mb-6 sm:mb-8 bg-gradient-to-r from-primary to-accent p-4 sm:p-8">
            <p className="text-white text-base sm:text-lg mb-2">
              Total Amount Spent
            </p>
            <p className="text-3xl sm:text-5xl font-bold text-secondary">
              ₹{totalSpent.toLocaleString()}
            </p>
            <p className="text-white text-sm mt-2 sm:mt-3">
              Purse: ₹{(auctionData?.purse_size || 0).toLocaleString()}
            </p>
          </div>

          {/* Export Buttons */}
          <div className="card mb-6 sm:mb-8 p-4 sm:p-6">
            <h2 className="text-xl sm:text-2xl font-bold text-primary mb-4 sm:mb-6">
              Export Results
            </h2>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <button
                onClick={handleExportCSV}
                disabled={exportingType !== null}
                className="btn btn-primary flex-1 flex items-center justify-center gap-2 btn-lg"
              >
                <IoDownload size={20} />
                {exportingType === "csv" ? "Exporting CSV..." : "Export as CSV"}
              </button>
              <button
                onClick={handleExportExcel}
                onMouseEnter={() => {
                  void warmExportDeps("xlsx");
                }}
                disabled={exportingType !== null}
                className="btn btn-secondary flex-1 flex items-center justify-center gap-2 btn-lg"
              >
                <IoDownload size={20} />
                {exportingType === "excel"
                  ? "Loading Excel tools..."
                  : "Export as Excel"}
              </button>
              <button
                onClick={handleExportPDF}
                onMouseEnter={() => {
                  void warmExportDeps("pdf");
                }}
                disabled={exportingType !== null}
                className="btn btn-danger flex-1 flex items-center justify-center gap-2 btn-lg"
              >
                <IoDocument size={20} />
                {exportingType === "pdf" ? "Loading PDF tools..." : "Export as PDF"}
              </button>
            </div>
          </div>

          {/* Team-wise Summary */}
          <div className="card mb-6 sm:mb-8 p-4 sm:p-6">
            <h2 className="text-xl sm:text-2xl font-bold text-primary mb-4 sm:mb-6">
              Team-wise Summary
            </h2>
            <div className="overflow-x-auto -mx-4 sm:-mx-6 px-4 sm:px-6 pb-2">
              <table className="w-full min-w-[700px] table-improved">
                <thead>
                  <tr className="border-b-2 border-border">
                    <th className="text-left py-4 px-4 font-bold text-primary whitespace-nowrap">
                      Team
                    </th>
                    <th className="text-left py-4 px-4 font-bold text-primary whitespace-nowrap">
                      Owner
                    </th>
                    <th className="text-right py-4 px-4 font-bold text-primary whitespace-nowrap">
                      Budget
                    </th>
                    <th className="text-right py-4 px-4 font-bold text-primary whitespace-nowrap">
                      Spent
                    </th>
                    <th className="text-right py-4 px-4 font-bold text-primary whitespace-nowrap">
                      Remaining
                    </th>
                    <th className="text-center py-4 px-4 font-bold text-primary whitespace-nowrap">
                      Players
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {teamsList.map((team) => {
                    const spent = calculateSpentBudget(team);
                    const spentPercent =
                      Number(team.budget_total) > 0
                        ? (spent / Number(team.budget_total)) * 100
                        : 0;
                    return (
                      <tr
                        key={team.id}
                        className="border-b border-border hover:bg-gray-50 transition"
                      >
                        <td className="py-4 px-4 font-bold text-primary">
                          {team.team_name}
                        </td>
                        <td className="py-4 px-4 text-text">
                          {team.owner_name}
                        </td>
                        <td className="py-4 px-4 text-right font-semibold text-text">
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
                              style={{
                                width: `${Math.min(100, spentPercent)}%`,
                              }}
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
          {(unsoldPlayers > 0 || pendingPlayers > 0) && (
            <div className="card">
              <h2 className="text-2xl font-bold text-primary mb-6">
                Unsold / Pending Players ({unsoldPlayers + pendingPlayers})
              </h2>
              <div className="grid md:grid-cols-3 gap-4">
                {playersList
                  .filter((p) => !p.soldTo)
                  .map((player) => {
                    const group = groupsById.get(String(player.group_id));
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
                          Base: ₹{(group?.base_price || 0).toLocaleString()}
                        </p>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>

        {/* Toast Notifications */}
        <ToastContainer toasts={toasts} removeToast={removeToast} />
      </div>
    </div>
  );
};

export default AdminResults;
