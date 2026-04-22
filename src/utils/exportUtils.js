import Papa from "papaparse";

let xlsxModulePromise = null;
let pdfModulesPromise = null;

const loadXlsxModule = async () => {
  if (!xlsxModulePromise) {
    xlsxModulePromise = import("xlsx").then((module) => module.default || module);
  }
  return xlsxModulePromise;
};

const loadPdfModules = async () => {
  if (!pdfModulesPromise) {
    pdfModulesPromise = Promise.all([
      import("jspdf"),
      import("jspdf-autotable"),
    ]).then(([jspdfModule, autoTableModule]) => ({
      jsPDF:
        jspdfModule.jsPDF || jspdfModule.default || jspdfModule,
      autoTable:
        autoTableModule.default || autoTableModule.autoTable || autoTableModule,
    }));
  }
  return pdfModulesPromise;
};

/**
 * Optional preloader for export-heavy dependencies.
 */
export const warmExportDeps = async (target = "all") => {
  if (target === "xlsx") {
    await loadXlsxModule();
    return;
  }
  if (target === "pdf") {
    await loadPdfModules();
    return;
  }
  await Promise.all([loadXlsxModule(), loadPdfModules()]);
};

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
        player.base_price || 0,
        player.soldPrice || "Unsold",
        player.team_name || "-",
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
export const exportToExcel = async (
  teams,
  players,
  filename = "auction_results.xlsx",
) => {
  try {
    const XLSX = await loadXlsxModule();
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
      "Base Price": player.base_price || 0,
      "Sold Price": player.soldPrice || "Unsold",
      "Sold To": player.team_name || "-",
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
        Value: players.filter((p) => p.soldTo).length,
      },
      {
        Metric: "Unsold Players",
        Value: players.filter((p) => !p.soldTo).length,
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
export const exportTeamSquads = async (
  teams,
  players,
  filename = "team_squads.xlsx",
) => {
  try {
    const XLSX = await loadXlsxModule();
    const workbook = XLSX.utils.book_new();

    teams.forEach((team) => {
      const teamPlayers = players.filter((p) => String(p.soldTo) === String(team.id));

      const squadData = teamPlayers.map((player) => ({
        "Player Name": player.player_name,
        Age: player.age,
        Group: player.group_name,
        "Sold Price": player.soldPrice,
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
    soldPlayers: players.filter((p) => p.soldTo).length,
    unsoldPlayers: players.filter((p) => !p.soldTo).length,
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
          const player = players.find((p) => String(p.id) === String(pid));
          return player?.player_name;
        }) || [],
    })),
  };
};

/**
 * Export auction results to PDF
 */
export const exportToPDF = async (
  auctionData,
  teams,
  players,
  filename = "auction_results.pdf",
) => {
  try {
    const { jsPDF, autoTable } = await loadPdfModules();
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // Title Page
    doc.setFontSize(24);
    doc.setTextColor(26, 58, 82);
    doc.text(auctionData?.name || "Cricket Auction", pageWidth / 2, 60, { align: "center" });

    doc.setFontSize(14);
    doc.setTextColor(100);
    doc.text("Auction Results", pageWidth / 2, 75, { align: "center" });

    doc.setFontSize(12);
    const dateStr = auctionData?.date
      ? new Date(auctionData.date).toLocaleDateString()
      : new Date().toLocaleDateString();
    doc.text(`Date: ${dateStr}`, pageWidth / 2, 90, { align: "center" });

    const soldCount = players.filter((p) => p.soldTo).length;
    const unsoldCount = players.filter((p) => !p.soldTo).length;
    const totalSpent = teams.reduce(
      (sum, t) => sum + (Number(t.budget_total || 0) - Number(t.budget_remaining || 0)),
      0,
    );

    doc.setFontSize(11);
    doc.text(
      `Teams: ${teams.length}  |  Players: ${players.length}  |  Sold: ${soldCount}  |  Unsold: ${unsoldCount}`,
      pageWidth / 2, 110, { align: "center" },
    );
    doc.text(
      `Total Amount Spent: Rs. ${totalSpent.toLocaleString()}`,
      pageWidth / 2, 120, { align: "center" },
    );

    // Team Results Table
    doc.addPage();
    doc.setFontSize(16);
    doc.setTextColor(26, 58, 82);
    doc.text("Team Results", 14, 20);

    autoTable(doc, {
      startY: 30,
      head: [["Team", "Owner", "Budget", "Spent", "Remaining", "Players"]],
      body: teams.map((team) => {
        const spent = Number(team.budget_total || 0) - Number(team.budget_remaining || 0);
        return [
          team.team_name,
          team.owner_name,
          `Rs. ${(team.budget_total || 0).toLocaleString()}`,
          `Rs. ${spent.toLocaleString()}`,
          `Rs. ${(team.budget_remaining || 0).toLocaleString()}`,
          team.squad?.length || 0,
        ];
      }),
      headStyles: { fillColor: [26, 58, 82] },
      alternateRowStyles: { fillColor: [248, 249, 250] },
      styles: { fontSize: 10 },
    });

    // Sold Players Table
    const soldPlayers = players.filter((p) => p.soldTo);
    if (soldPlayers.length > 0) {
      doc.addPage();
      doc.setFontSize(16);
      doc.setTextColor(26, 58, 82);
      doc.text("Sold Players", 14, 20);

      autoTable(doc, {
        startY: 30,
        head: [["Player", "Age", "Group", "Base Price", "Sold Price", "Team"]],
        body: soldPlayers.map((p) => [
          p.player_name,
          p.age,
          p.group_name || "N/A",
          `Rs. ${(p.base_price || 0).toLocaleString()}`,
          `Rs. ${(p.soldPrice || 0).toLocaleString()}`,
          p.team_name || "-",
        ]),
        headStyles: { fillColor: [26, 58, 82] },
        alternateRowStyles: { fillColor: [248, 249, 250] },
        styles: { fontSize: 9 },
      });
    }

    // Unsold Players Section
    const unsoldPlayers = players.filter((p) => !p.soldTo);
    if (unsoldPlayers.length > 0) {
      doc.addPage();
      doc.setFontSize(16);
      doc.setTextColor(26, 58, 82);
      doc.text(`Unsold Players (${unsoldPlayers.length})`, 14, 20);

      autoTable(doc, {
        startY: 30,
        head: [["Player", "Age", "Group", "Base Price"]],
        body: unsoldPlayers.map((p) => [
          p.player_name,
          p.age,
          p.group_name || "N/A",
          `Rs. ${(p.base_price || 0).toLocaleString()}`,
        ]),
        headStyles: { fillColor: [239, 68, 68] },
        alternateRowStyles: { fillColor: [248, 249, 250] },
        styles: { fontSize: 9 },
      });
    }

    doc.save(filename);
  } catch (error) {
    console.error("Error exporting to PDF:", error);
    throw error;
  }
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

/**
 * Parse career stats CSV for player stats sync
 */
export const parseCareerStatsCSV = (file) => {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      complete: (results) => {
        resolve(results.data);
      },
      error: (error) => {
        reject(error);
      },
      header: true,
      skipEmptyLines: true,
    });
  });
};
