import Papa from "papaparse";
import * as XLSX from "xlsx";

/**
 * Export teams and players to CSV
 */
export const exportToCSV = (
  teams,
  players,
  filename = "auction_results.csv",
) => {
  try {
    const data = [];

    // Header
    data.push(["Team Results"]);
    data.push([]);
    data.push([
      "Team Name",
      "Owner",
      "Total Budget",
      "Spent",
      "Remaining",
      "Players Count",
    ]);

    // Team data
    teams.forEach((team) => {
      data.push([
        team.team_name,
        team.owner_name,
        team.budget_total,
        team.budget_total - team.budget_remaining,
        team.budget_remaining,
        team.squad?.length || 0,
      ]);
    });

    data.push([]);
    data.push(["Player Results"]);
    data.push([]);
    data.push([
      "Player Name",
      "Age",
      "Group",
      "Base Price",
      "Sold Price",
      "Sold To",
    ]);

    // Player data
    players.forEach((player) => {
      data.push([
        player.player_name,
        player.age,
        player.group_name,
        player.base_price,
        player.soldPrice || "Unsold",
        player.soldTo || "-",
      ]);
    });

    const csv = Papa.unparse(data);
    downloadFile(csv, filename, "text/csv");
  } catch (error) {
    console.error("Error exporting to CSV:", error);
    throw error;
  }
};

/**
 * Export to Excel with multiple sheets
 */
export const exportToExcel = (
  teams,
  players,
  filename = "auction_results.xlsx",
) => {
  try {
    const workbook = XLSX.utils.book_new();

    // Teams sheet
    const teamsData = teams.map((team) => ({
      "Team Name": team.team_name,
      Owner: team.owner_name,
      "Total Budget": team.budget_total,
      Spent: team.budget_total - team.budget_remaining,
      Remaining: team.budget_remaining,
      Players: team.squad?.length || 0,
    }));

    const teamsSheet = XLSX.utils.json_to_sheet(teamsData);
    XLSX.utils.book_append_sheet(workbook, teamsSheet, "Teams");

    // Players sheet
    const playersData = players.map((player) => ({
      "Player Name": player.player_name,
      Age: player.age,
      Group: player.group_name,
      "Base Price": player.base_price,
      "Sold Price": player.soldPrice || "Unsold",
      "Sold To": player.soldTo || "-",
    }));

    const playersSheet = XLSX.utils.json_to_sheet(playersData);
    XLSX.utils.book_append_sheet(workbook, playersSheet, "Players");

    // Summary sheet
    const summaryData = [
      {
        Metric: "Total Teams",
        Value: teams.length,
      },
      {
        Metric: "Total Players",
        Value: players.length,
      },
      {
        Metric: "Sold Players",
        Value: players.filter((p) => p.soldPrice).length,
      },
      {
        Metric: "Unsold Players",
        Value: players.filter((p) => !p.soldPrice).length,
      },
      {
        Metric: "Total Amount Spent",
        Value: teams.reduce(
          (sum, team) => sum + (team.budget_total - team.budget_remaining),
          0,
        ),
      },
    ];

    const summarySheet = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(workbook, summarySheet, "Summary");

    XLSX.writeFile(workbook, filename);
  } catch (error) {
    console.error("Error exporting to Excel:", error);
    throw error;
  }
};

/**
 * Export team squad in detailed format
 */
export const exportTeamSquads = (
  teams,
  players,
  filename = "team_squads.xlsx",
) => {
  try {
    const workbook = XLSX.utils.book_new();

    teams.forEach((team) => {
      const teamPlayers = players.filter((p) => p.soldTo === team.id);

      const squadData = teamPlayers.map((player) => ({
        "Player Name": player.player_name,
        Age: player.age,
        Role: player.role || "-",
        Group: player.group_name,
        "Sold Price": player.soldPrice,
        Nationality: player.nationality || "-",
      }));

      const sheet = XLSX.utils.json_to_sheet(squadData);
      XLSX.utils.book_append_sheet(
        workbook,
        sheet,
        team.team_name.slice(0, 31),
      );
    });

    XLSX.writeFile(workbook, filename);
  } catch (error) {
    console.error("Error exporting team squads:", error);
    throw error;
  }
};

/**
 * Generate auction summary report
 */
export const generateAuctionSummary = (auctionData, teams, players) => {
  return {
    auctionName: auctionData.name,
    auctionDate: new Date().toLocaleDateString(),
    purseSize: auctionData.purseSize,
    totalTeams: teams.length,
    totalPlayers: players.length,
    soldPlayers: players.filter((p) => p.soldPrice).length,
    unsoldPlayers: players.filter((p) => !p.soldPrice).length,
    totalSpent: teams.reduce(
      (sum, team) => sum + (team.budget_total - team.budget_remaining),
      0,
    ),
    teamsData: teams.map((team) => ({
      teamName: team.team_name,
      owner: team.owner_name,
      totalBudget: team.budget_total,
      spent: team.budget_total - team.budget_remaining,
      remaining: team.budget_remaining,
      squadSize: team.squad?.length || 0,
      squadPlayers:
        team.squad?.map((pid) => {
          const player = players.find((p) => p.id === pid);
          return player?.player_name;
        }) || [],
    })),
  };
};

/**
 * Download file utility
 */
const downloadFile = (content, filename, mimeType) => {
  const element = document.createElement("a");
  element.setAttribute(
    "href",
    `data:${mimeType};charset=utf-8,${encodeURIComponent(content)}`,
  );
  element.setAttribute("download", filename);
  element.style.display = "none";

  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
};

/**
 * Parse CSV for bulk player upload
 */
export const parsePlayersCSV = (file) => {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      complete: (results) => {
        resolve(results.data);
      },
      error: (error) => {
        reject(error);
      },
      header: true, // Use first row as header
    });
  });
};
