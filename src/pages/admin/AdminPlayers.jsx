import { useState, useMemo, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuction } from "../../hooks/useAuction";
import { useRealtimeData } from "../../hooks/useRealtimeData";
import { useToast } from "../../components/Toast";
import { ToastContainer } from "../../components/ToastContainer";
import { Modal } from "../../components/Modal";
import { Header } from "../../components/Header";
import { parsePlayersCSV, parseCareerStatsCSV } from "../../utils/exportUtils";
import { validatePlayer } from "../../utils/validationUtils";
import { ROUTES } from "../../constants/routes";
import {
  firebaseObjectToArray,
  getImagePath,
} from "../../utils/dataTransformUtils";
import {
  IoAdd,
  IoTrash,
  IoDownload,
  IoArrowForward,
  IoArrowBack,
  IoPencil,
  IoSwapHorizontal,
  IoLayers,
} from "react-icons/io5";
import { ref, update } from "firebase/database";
import { db } from "../../utils/firebaseConfig";

const UNASSIGNED_GROUP_ID = "__unassigned__";

const EMPTY_FORM = {
  player_name: "",
  age: "",
  group_id: "",
  photo_url: "",
};

const normalizeName = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/\bcricket profile\b/g, " ")
    .replace(/\bprofile\b/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const getNameTokens = (value) => {
  const normalized = normalizeName(value);
  return normalized ? normalized.split(" ") : [];
};

const toNumberOrNull = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const toNumberOrZero = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const buildPlayerStatsPayload = (row) => ({
  source: {
    provider: "cricheroes",
    player_id: row.player_id || null,
    player_url: row.player_url || null,
    stats_url: row.stats_url || null,
    player_name_clean: row.player_name_clean || null,
  },
  batting: {
    matches: toNumberOrNull(row.bat_matches),
    innings: toNumberOrNull(row.bat_innings),
    notOut: toNumberOrNull(row.bat_not_out),
    runs: toNumberOrNull(row.bat_runs),
    highest: row.bat_highest_runs || null,
    average: toNumberOrNull(row.bat_avg),
    strikeRate: toNumberOrNull(row.bat_sr),
    thirties: toNumberOrNull(row.bat_30s),
    fifties: toNumberOrNull(row.bat_50s),
    hundreds: toNumberOrNull(row.bat_100s),
    fours: toNumberOrNull(row.bat_4s),
    sixes: toNumberOrNull(row.bat_6s),
  },
  bowling: {
    matches: toNumberOrNull(row.bowl_matches),
    innings: toNumberOrNull(row.bowl_innings),
    overs: row.bowl_overs || null,
    maidens: toNumberOrNull(row.bowl_maidens),
    wickets: toNumberOrNull(row.bowl_wickets),
    runsConceded: toNumberOrNull(row.bowl_runs_conceded),
    best: row.bowl_best_bowling || null,
    threeWickets: toNumberOrNull(row.bowl_3w),
    fiveWickets: toNumberOrNull(row.bowl_5w),
    economy: toNumberOrNull(row.bowl_economy),
    average: toNumberOrNull(row.bowl_avg),
    strikeRate: toNumberOrNull(row.bowl_sr),
    wides: toNumberOrNull(row.bowl_wides),
    noBalls: toNumberOrNull(row.bowl_noballs),
    dotBalls: toNumberOrNull(row.bowl_dot_balls),
    foursConceded: toNumberOrNull(row.bowl_4s),
    sixesConceded: toNumberOrNull(row.bowl_6s),
  },
  fielding: {
    matches: toNumberOrNull(row.field_matches),
    catches: toNumberOrNull(row.field_catches),
    stumpings: toNumberOrNull(row.field_stumpings),
    runOuts: toNumberOrNull(row.field_run_outs),
    assistedRunOuts: toNumberOrNull(row.field_assisted_run_outs),
    caughtBehind: toNumberOrNull(row.field_caught_behind),
  },
  highlights: {
    battingStrikeRate: toNumberOrZero(row.bat_sr),
    battingRuns: toNumberOrZero(row.bat_runs),
    battingAverage: toNumberOrZero(row.bat_avg),
    bowlingWickets: toNumberOrZero(row.bowl_wickets),
    bowlingEconomy: toNumberOrZero(row.bowl_economy),
    bowlingAverage: toNumberOrZero(row.bowl_avg),
  },
  updated_at: new Date().toISOString(),
});

export const AdminPlayers = () => {
  const { auctionId } = useParams();
  const navigate = useNavigate();
  const { addPlayer, deletePlayer, updatePlayer } = useAuction();
  const { data: auctionData } = useRealtimeData(`auctions/${auctionId}`);
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
  const [showSegregationModal, setShowSegregationModal] = useState(false);
  const [segregationForm, setSegregationForm] = useState({
    sourceGroup: UNASSIGNED_GROUP_ID,
    targetGroup: "",
  });
  const [segregationSelectedIds, setSegregationSelectedIds] = useState([]);
  const [segregationSearch, setSegregationSearch] = useState("");
  const [showSaleModal, setShowSaleModal] = useState(false);
  const [salePlayer, setSalePlayer] = useState(null);
  const [saleForm, setSaleForm] = useState({ soldTo: "", soldPrice: "" });

  const playersList = firebaseObjectToArray(playersData);
  const groupsList = firebaseObjectToArray(groupsData);
  const teamsList = firebaseObjectToArray(teamsData);
  const groupsById = useMemo(
    () => new Map(groupsList.map((group) => [String(group.id), group])),
    [groupsList],
  );

  // Filter players by selected group and status
  const filteredPlayers = useMemo(() => {
    let filtered = playersList;
    if (selectedGroup !== "all") {
      filtered =
        selectedGroup === UNASSIGNED_GROUP_ID
          ? filtered.filter((p) => !p.group_id)
          : filtered.filter((p) => String(p.group_id) === selectedGroup);
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
    const counts = new Map([[UNASSIGNED_GROUP_ID, 0]]);
    playersList.forEach((p) => {
      const gid = p.group_id ? String(p.group_id) : UNASSIGNED_GROUP_ID;
      counts.set(gid, (counts.get(gid) || 0) + 1);
    });
    return counts;
  }, [playersList]);
  const unassignedPlayersCount = groupCounts.get(UNASSIGNED_GROUP_ID) || 0;

  const segregationCandidates = useMemo(() => {
    const sourceCandidates =
      segregationForm.sourceGroup === "all"
        ? playersList
        : segregationForm.sourceGroup === UNASSIGNED_GROUP_ID
          ? playersList.filter((p) => !p.group_id)
          : playersList.filter(
              (p) => String(p.group_id) === String(segregationForm.sourceGroup),
            );

    // Sold players are locked after auctioning and cannot be re-grouped.
    return sourceCandidates.filter((p) => !p.soldTo);
  }, [playersList, segregationForm.sourceGroup]);
  const segregationFilteredCandidates = useMemo(() => {
    const query = segregationSearch.trim().toLowerCase();
    if (!query) return segregationCandidates;
    return segregationCandidates.filter((player) =>
      String(player.player_name || "").toLowerCase().includes(query),
    );
  }, [segregationCandidates, segregationSearch]);
  const segregationSelectedIdSet = useMemo(
    () => new Set(segregationSelectedIds.map((id) => String(id))),
    [segregationSelectedIds],
  );
  const selectedSegregationPlayers = useMemo(
    () =>
      segregationCandidates.filter((player) =>
        segregationSelectedIdSet.has(String(player.id)),
      ),
    [segregationCandidates, segregationSelectedIdSet],
  );
  const allFilteredSelected = useMemo(
    () =>
      segregationFilteredCandidates.length > 0 &&
      segregationFilteredCandidates.every((player) =>
        segregationSelectedIdSet.has(String(player.id)),
      ),
    [segregationFilteredCandidates, segregationSelectedIdSet],
  );

  useEffect(() => {
    const candidateIds = new Set(
      segregationCandidates.map((player) => String(player.id)),
    );
    setSegregationSelectedIds((prev) => {
      const filtered = prev.filter((id) => candidateIds.has(String(id)));
      return filtered.length === prev.length ? prev : filtered;
    });
  }, [segregationCandidates]);

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

  // Delete player (with refund if sold)
  const handleDeletePlayer = async (player) => {
    try {
      // If player was sold, refund the team's budget and remove from squad
      if (player.soldTo) {
        const team = teamsList.find(
          (t) => String(t.id) === String(player.soldTo),
        );
        if (team) {
          const teamRef = ref(db, `auctions/${auctionId}/teams/${team.id}`);
          await update(teamRef, {
            squad: (team.squad || []).filter(
              (pid) => String(pid) !== String(player.id),
            ),
            budget_remaining:
              Number(team.budget_remaining || 0) +
              Number(player.soldPrice || 0),
          });
        }
      }
      await deletePlayer(auctionId, player.id);
      showToast(`${player.player_name} removed`, "success");
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
      const playerRef = ref(
        db,
        `auctions/${auctionId}/players/${salePlayer.id}`,
      );

      if (!saleForm.soldTo) {
        // Unsell: remove soldTo/soldPrice, and revert team budget+squad
        const prevTeam = teamsList.find(
          (t) => String(t.id) === String(salePlayer.soldTo),
        );
        if (prevTeam) {
          const teamRef = ref(db, `auctions/${auctionId}/teams/${prevTeam.id}`);
          await update(teamRef, {
            squad: (prevTeam.squad || []).filter(
              (pid) => String(pid) !== String(salePlayer.id),
            ),
            budget_remaining:
              Number(prevTeam.budget_remaining || 0) +
              Number(salePlayer.soldPrice || 0),
          });
        }
        await update(playerRef, {
          soldTo: null,
          soldPrice: null,
          unsold: null,
        });
        showToast(`${salePlayer.player_name} moved back to pending`, "success");
      } else {
        const newPrice = Number(saleForm.soldPrice) || 0;
        const oldTeamId = salePlayer.soldTo;
        const newTeamId = saleForm.soldTo;
        const oldPrice = Number(salePlayer.soldPrice) || 0;

        // --- Eligibility checks when assigning to a (possibly new) team ---
        const isTeamChange = String(oldTeamId) !== String(newTeamId);
        if (isTeamChange || !oldTeamId) {
          const newTeam = teamsList.find(
            (t) => String(t.id) === String(newTeamId),
          );
          if (newTeam) {
            // Budget check
            const effectiveBudget = Number(newTeam.budget_remaining || 0);
            if (newPrice > effectiveBudget) {
              showToast(
                `${newTeam.team_name} can't afford ₹${newPrice.toLocaleString()} (budget: ₹${effectiveBudget.toLocaleString()})`,
                "error",
              );
              return;
            }
            // Max squad size check
            const maxSquad =
              Number(auctionData?.max_players_per_team) || Infinity;
            const currentSquadSize = newTeam.squad?.length || 0;
            if (currentSquadSize >= maxSquad) {
              showToast(
                `${newTeam.team_name} squad is full (${maxSquad} players)`,
                "error",
              );
              return;
            }
            // Group limit check (only when player is assigned to a known group)
            const playerGroup = salePlayer.group_id
              ? groupsList.find(
                  (g) => String(g.id) === String(salePlayer.group_id),
                )
              : null;
            const groupMax = Number(playerGroup?.max_per_team || 0);
            if (playerGroup && groupMax > 0) {
              const groupCount = playersList.filter(
                (p) =>
                  String(p.group_id) === String(salePlayer.group_id) &&
                  String(p.soldTo) === String(newTeamId) &&
                  String(p.id) !== String(salePlayer.id),
              ).length;
              if (groupCount >= groupMax) {
                showToast(
                  `${newTeam.team_name} already has ${groupMax} player(s) from ${playerGroup.group_name}`,
                  "error",
                );
                return;
              }
            }
          }
        }

        // If team changed, update old team (remove player, refund) and new team (add player, deduct)
        if (String(oldTeamId) !== String(newTeamId) && oldTeamId) {
          const oldTeam = teamsList.find(
            (t) => String(t.id) === String(oldTeamId),
          );
          if (oldTeam) {
            const oldTeamRef = ref(
              db,
              `auctions/${auctionId}/teams/${oldTeam.id}`,
            );
            await update(oldTeamRef, {
              squad: (oldTeam.squad || []).filter(
                (pid) => String(pid) !== String(salePlayer.id),
              ),
              budget_remaining:
                Number(oldTeam.budget_remaining || 0) + oldPrice,
            });
          }

          const newTeam = teamsList.find(
            (t) => String(t.id) === String(newTeamId),
          );
          if (newTeam) {
            const newTeamRef = ref(
              db,
              `auctions/${auctionId}/teams/${newTeam.id}`,
            );
            await update(newTeamRef, {
              squad: [...(newTeam.squad || []), salePlayer.id],
              budget_remaining:
                Number(newTeam.budget_remaining || 0) - newPrice,
            });
          }
        } else if (oldPrice !== newPrice && oldTeamId) {
          // Same team, price changed — adjust budget difference
          const team = teamsList.find(
            (t) => String(t.id) === String(oldTeamId),
          );
          if (team) {
            const teamRef = ref(db, `auctions/${auctionId}/teams/${team.id}`);
            await update(teamRef, {
              budget_remaining:
                Number(team.budget_remaining || 0) + oldPrice - newPrice,
            });
          }
        } else if (!oldTeamId) {
          // Selling a previously unsold/pending player
          const newTeam = teamsList.find(
            (t) => String(t.id) === String(newTeamId),
          );
          if (newTeam) {
            const newTeamRef = ref(
              db,
              `auctions/${auctionId}/teams/${newTeam.id}`,
            );
            await update(newTeamRef, {
              squad: [...(newTeam.squad || []), salePlayer.id],
              budget_remaining:
                Number(newTeam.budget_remaining || 0) - newPrice,
            });
          }
        }

        await update(playerRef, {
          soldTo: newTeamId,
          soldPrice: newPrice,
          unsold: null,
        });
        const teamName =
          teamsList.find((t) => String(t.id) === String(newTeamId))
            ?.team_name || "Unknown";
        showToast(
          `${salePlayer.player_name} → ${teamName} at ₹${newPrice.toLocaleString()}`,
          "success",
        );
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
      const team = teamsList.find(
        (t) => String(t.id) === String(player.soldTo),
      );
      return (
        <div>
          <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs font-bold">
            SOLD
          </span>
          <p className="text-xs text-textLight mt-1">
            {team?.team_name || "Unknown"} - ₹
            {(player.soldPrice || 0).toLocaleString()}
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

  // Bulk upload CSV (parallel batched)
  const handleBulkUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const csvPlayers = await parsePlayersCSV(file);

      // Prepare valid players first
      const validPlayers = [];
      let skippedCount = 0;
      let unmatchedGroupCount = 0;
      for (const player of csvPlayers) {
        if (!player.player_name) {
          if (Object.values(player).some((v) => v)) skippedCount++;
          continue;
        }

        const rawGroupValue = player.group_id || player.group_name || player.group;
        const groupId = rawGroupValue ? resolveGroupId(rawGroupValue) : "";
        if (rawGroupValue && !groupId) {
          unmatchedGroupCount++;
        }

        const playerData = {
          player_name: player.player_name,
          age: Number(player.age),
          group_id: groupId || "",
          photo_url: player.photo_filename || player.photo_url || "",
        };

        const errors = validatePlayer(playerData, { requireGroup: false });
        if (!errors) {
          validPlayers.push(playerData);
        } else {
          skippedCount++;
        }
      }

      // Upload in parallel batches of 10
      const BATCH_SIZE = 10;
      let addedCount = 0;
      for (let i = 0; i < validPlayers.length; i += BATCH_SIZE) {
        const batch = validPlayers.slice(i, i + BATCH_SIZE);
        const results = await Promise.allSettled(
          batch.map((p) => addPlayer(auctionId, p)),
        );
        addedCount += results.filter((r) => r.status === "fulfilled").length;
        skippedCount += results.filter((r) => r.status === "rejected").length;
      }

      const msg =
        skippedCount > 0
          ? `${addedCount} players added, ${skippedCount} skipped (invalid data)`
          : `${addedCount} players added successfully!`;
      const unmatchedGroupMsg =
        unmatchedGroupCount > 0
          ? ` ${unmatchedGroupCount} player(s) were imported as Unassigned due to unmatched group values.`
          : "";
      showToast(`${msg}${unmatchedGroupMsg}`, addedCount > 0 ? "success" : "error");
      e.target.value = "";
    } catch (error) {
      showToast("Error uploading CSV: " + error.message, "error");
    }
  };

  // Bulk upload career stats CSV with safe matching
  const handleStatsUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const csvRows = await parseCareerStatsCSV(file);
      const playersByExactName = new Map();
      const playersByFirstName = new Map();
      const playersByToken = new Map();

      playersList.forEach((player) => {
        const normalizedFull = normalizeName(player.player_name);
        if (!normalizedFull) return;

        if (!playersByExactName.has(normalizedFull)) {
          playersByExactName.set(normalizedFull, []);
        }
        playersByExactName.get(normalizedFull).push(player);

        const tokens = getNameTokens(player.player_name);
        const firstName = tokens[0];
        if (!firstName) return;
        if (!playersByFirstName.has(firstName)) {
          playersByFirstName.set(firstName, []);
        }
        playersByFirstName.get(firstName).push(player);

        const uniqueTokens = new Set(tokens.filter(Boolean));
        uniqueTokens.forEach((token) => {
          if (!playersByToken.has(token)) {
            playersByToken.set(token, []);
          }
          playersByToken.get(token).push(player);
        });
      });

      const updatesByPlayerId = new Map();
      const ambiguousRows = [];
      const unmatchedRows = [];
      let matchedRows = 0;

      for (const row of csvRows) {
        const csvCleanName = row.player_name_clean;
        const csvUrl = row.player_url || "";
        const csvSlug = csvUrl.split("/").filter(Boolean).pop() || "";
        const slugName = normalizeName(csvSlug.replace(/-/g, " "));
        const normalizedClean = normalizeName(csvCleanName);

        if (!normalizedClean && !slugName) {
          unmatchedRows.push(row);
          continue;
        }

        const exactCandidates = [];
        if (normalizedClean && playersByExactName.has(normalizedClean)) {
          exactCandidates.push(...playersByExactName.get(normalizedClean));
        }
        if (slugName && playersByExactName.has(slugName)) {
          exactCandidates.push(...playersByExactName.get(slugName));
        }

        const uniqueExact = Array.from(
          new Map(exactCandidates.map((p) => [String(p.id), p])).values(),
        );

        let matchedPlayer = null;
        if (uniqueExact.length === 1) {
          matchedPlayer = uniqueExact[0];
        } else if (uniqueExact.length > 1) {
          const candidatesWithAge = uniqueExact.filter(
            (p) => p.age && toNumberOrNull(row.age) && Number(p.age) === Number(row.age),
          );
          if (candidatesWithAge.length === 1) {
            matchedPlayer = candidatesWithAge[0];
          } else {
            ambiguousRows.push({
              csvName: csvCleanName || slugName || "unknown",
              candidates: uniqueExact.map((p) => p.player_name),
            });
            continue;
          }
        } else {
          const fallbackName = normalizedClean || slugName;
          const fallbackFirstName = fallbackName.split(" ")[0];
          const firstNameCandidates = playersByFirstName.get(fallbackFirstName) || [];
          if (firstNameCandidates.length > 1) {
            ambiguousRows.push({
              csvName: csvCleanName || slugName || "unknown",
              candidates: firstNameCandidates.map((p) => p.player_name),
            });
            continue;
          }
          if (firstNameCandidates.length === 1) {
            // Safe to match by first name only when that first name is unique in this auction.
            matchedPlayer = firstNameCandidates[0];
          } else {
            const csvTokens = getNameTokens(fallbackName);
            const tokenCandidates = [];
            csvTokens.forEach((token) => {
              const candidates = playersByToken.get(token) || [];
              tokenCandidates.push(...candidates);
            });

            const uniqueTokenCandidates = Array.from(
              new Map(tokenCandidates.map((p) => [String(p.id), p])).values(),
            );

            if (uniqueTokenCandidates.length === 1) {
              matchedPlayer = uniqueTokenCandidates[0];
            } else if (uniqueTokenCandidates.length > 1) {
              const csvTokenSet = new Set(csvTokens);
              const scoredCandidates = uniqueTokenCandidates
                .map((candidate) => {
                  const candidateTokens = new Set(
                    getNameTokens(candidate.player_name),
                  );
                  let overlap = 0;
                  csvTokenSet.forEach((token) => {
                    if (candidateTokens.has(token)) overlap += 1;
                  });
                  return { candidate, overlap };
                })
                .filter((item) => item.overlap > 0)
                .sort((a, b) => b.overlap - a.overlap);

              if (
                scoredCandidates.length > 0 &&
                scoredCandidates[0].overlap >
                  (scoredCandidates[1]?.overlap || 0)
              ) {
                matchedPlayer = scoredCandidates[0].candidate;
              } else {
                ambiguousRows.push({
                  csvName: csvCleanName || slugName || "unknown",
                  candidates: uniqueTokenCandidates.map((p) => p.player_name),
                });
                continue;
              }
            }
          }
        }

        if (!matchedPlayer) {
          unmatchedRows.push(row);
          continue;
        }

        matchedRows++;
        updatesByPlayerId.set(String(matchedPlayer.id), {
          stats: buildPlayerStatsPayload(row),
        });
      }

      const updates = Array.from(updatesByPlayerId.entries());
      const BATCH_SIZE = 20;
      let updatedCount = 0;

      for (let i = 0; i < updates.length; i += BATCH_SIZE) {
        const batch = updates.slice(i, i + BATCH_SIZE);
        const result = await Promise.allSettled(
          batch.map(([playerId, payload]) =>
            update(ref(db, `auctions/${auctionId}/players/${playerId}`), payload),
          ),
        );
        updatedCount += result.filter((r) => r.status === "fulfilled").length;
      }

      const summary = `${updatedCount} players updated (${matchedRows} matched rows, ${ambiguousRows.length} ambiguous, ${unmatchedRows.length} unmatched)`;
      if (ambiguousRows.length > 0) {
        console.table(ambiguousRows.slice(0, 20));
      }
      if (unmatchedRows.length > 0) {
        console.table(
          unmatchedRows.slice(0, 20).map((row) => ({
            player_name_clean: row.player_name_clean || null,
            player_url: row.player_url || null,
          })),
        );
      }
      showToast(summary, updatedCount > 0 ? "success" : "error");
      e.target.value = "";
    } catch (error) {
      showToast("Error uploading stats CSV: " + error.message, "error");
    }
  };

  // Download CSV template
  const downloadTemplate = () => {
    const groupNames = groupsList.map((g) => g.group_name).join(", ");
    const exampleGroup = groupsList[0]?.group_name || "";
    const template = `player_name,age,group_name,photo_filename
Virat Kohli,35,${exampleGroup},virat_kohli.jpg
Rohit Sharma,36,,rohit_sharma.jpg
Jasprit Bumrah,30,${exampleGroup},jasprit_bumrah.jpg

# Group is optional. Leave group_name blank to add player as Unassigned
# Available groups: ${groupNames || "Create groups in setup first"}
# Place photos in public/images/player-photos/ folder`;

    const element = document.createElement("a");
    element.setAttribute(
      "href",
      `data:text/csv;charset=utf-8,${encodeURIComponent(template)}`,
    );
    element.setAttribute("download", "players_template.csv");
    element.click();
    showToast("Template downloaded!", "success");
  };

  const handleToggleSegregationPlayer = (playerId) => {
    const normalizedId = String(playerId);
    setSegregationSelectedIds((prev) => {
      const exists = prev.some((id) => String(id) === normalizedId);
      if (exists) {
        return prev.filter((id) => String(id) !== normalizedId);
      }
      return [...prev, normalizedId];
    });
  };

  const handleToggleSelectAllFiltered = () => {
    setSegregationSelectedIds((prev) => {
      const next = new Set(prev.map((id) => String(id)));
      if (allFilteredSelected) {
        segregationFilteredCandidates.forEach((player) => {
          next.delete(String(player.id));
        });
      } else {
        segregationFilteredCandidates.forEach((player) => {
          next.add(String(player.id));
        });
      }
      return Array.from(next);
    });
  };

  const resetSegregationState = () => {
    setSegregationSelectedIds([]);
    setSegregationSearch("");
  };

  const handleApplySegregation = async () => {
    if (!segregationForm.targetGroup) {
      showToast("Select the target group", "error");
      return;
    }

    if (segregationForm.sourceGroup === segregationForm.targetGroup) {
      showToast("Source and target group cannot be the same", "error");
      return;
    }

    if (selectedSegregationPlayers.length === 0) {
      showToast("Select at least one player to move", "error");
      return;
    }

    const candidates = selectedSegregationPlayers.filter(
      (player) => String(player.group_id || "") !== String(segregationForm.targetGroup),
    );

    if (candidates.length === 0) {
      showToast("Selected players are already in the target group", "error");
      return;
    }

    try {
      const updates = {};
      candidates.forEach((player) => {
        updates[`${player.id}/group_id`] = segregationForm.targetGroup;
      });
      await update(ref(db, `auctions/${auctionId}/players`), updates);
      const targetGroupName =
        groupsList.find((g) => String(g.id) === String(segregationForm.targetGroup))
          ?.group_name || "selected group";
      showToast(
        `${candidates.length} player(s) moved to ${targetGroupName}`,
        "success",
      );
      setSegregationSelectedIds([]);
    } catch (error) {
      showToast("Failed to segregate players: " + error.message, "error");
    }
  };

  const handleGoLive = () => {
    if (unassignedPlayersCount > 0) {
      setSelectedGroup(UNASSIGNED_GROUP_ID);
      showToast(
        `Assign groups to ${unassignedPlayersCount} unassigned player(s) before starting live auction`,
        "error",
      );
      return;
    }
    navigate(ROUTES.ADMIN_LIVE(auctionId));
  };

  // Player form fields (shared between add and edit)
  const renderPlayerForm = () => (
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
            Group (Optional)
          </label>
          <select
            value={playerForm.group_id}
            onChange={(e) =>
              setPlayerForm({ ...playerForm, group_id: e.target.value })
            }
            className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:border-primary"
          >
            <option value="">Assign Later (Unassigned)</option>
            {groupsList.map((group) => (
              <option key={group.id} value={group.id}>
                {group.group_name} (Base: ₹
                {(group.base_price || 0).toLocaleString()})
              </option>
            ))}
          </select>
          {groupsList.length === 0 && (
            <p className="text-xs text-textLight mt-1">
              No groups created yet. You can assign groups later.
            </p>
          )}
        </div>
      </div>

      <div>
        <label className="block font-semibold text-text mb-2">
          Photo Filename (Optional)
        </label>
        <input
          type="text"
          value={playerForm.photo_url}
          onChange={(e) =>
            setPlayerForm({ ...playerForm, photo_url: e.target.value })
          }
          placeholder="e.g., john_smith.jpg"
          className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:border-primary"
        />
        <p className="text-xs text-textLight mt-1">
          Place photo in public/images/player-photos/ folder
        </p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-lightBg transition-colors duration-300">
      {/* Header */}
      <Header showBranding={true} />

      <div className="p-3 sm:p-6">
        <div className="max-w-6xl mx-auto">
          {/* Page Title */}
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4">
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-4xl font-bold text-primary">
                Manage Players
              </h1>
              <p className="text-textLight text-sm">
                {selectedGroup === "all"
                  ? `Total Players: ${playersList.length}`
                  : `Showing ${filteredPlayers.length} of ${playersList.length} players`}
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => navigate(ROUTES.ADMIN_SETUP)}
                className="btn btn-sm btn-secondary flex items-center gap-1"
              >
                <IoArrowBack size={16} /> Dashboard
              </button>
              <button
                onClick={downloadTemplate}
                className="btn btn-sm btn-secondary flex items-center gap-1"
              >
                <IoDownload size={16} /> Template
              </button>
              <label className="btn btn-sm btn-secondary cursor-pointer flex items-center gap-1">
                <IoDownload size={16} /> CSV
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleBulkUpload}
                  hidden
                />
              </label>
              <label className="btn btn-sm btn-secondary cursor-pointer flex items-center gap-1">
                <IoDownload size={16} /> Stats CSV
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleStatsUpload}
                  hidden
                />
              </label>
              <button
                onClick={openAddModal}
                className="btn btn-sm btn-primary flex items-center gap-1"
              >
                <IoAdd size={18} /> Add
              </button>
              {playersList.length > 0 && groupsList.length > 0 && (
                <button
                  onClick={() => {
                    setSegregationForm({
                      sourceGroup: UNASSIGNED_GROUP_ID,
                      targetGroup: groupsList[0]?.id || "",
                    });
                    resetSegregationState();
                    setShowSegregationModal(true);
                  }}
                  className="btn btn-sm btn-secondary flex items-center gap-1"
                >
                  <IoLayers size={16} /> Segregate
                </button>
              )}
              {playersList.length > 0 && (
                <button
                  onClick={handleGoLive}
                  className="btn btn-sm flex items-center gap-1 bg-success hover:bg-green-700 text-white"
                >
                  Live <IoArrowForward size={16} />
                </button>
              )}
            </div>
          </div>

          {/* Group Filter Bar */}
          {playersList.length > 0 && (
            <div className="flex items-center gap-2 mb-3 overflow-x-auto pb-2">
              <span className="text-sm font-semibold text-textLight mr-1">
                Group:
              </span>
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
              <button
                onClick={() => setSelectedGroup(UNASSIGNED_GROUP_ID)}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition flex-shrink-0 ${
                  selectedGroup === UNASSIGNED_GROUP_ID
                    ? "bg-primary text-white"
                    : "bg-white border border-border text-textLight hover:border-primary"
                }`}
              >
                Unassigned ({unassignedPlayersCount})
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
          {playersList.length > 0 &&
            (statusCounts.sold > 0 || statusCounts.unsold > 0) && (
              <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
                <span className="text-sm font-semibold text-textLight mr-1">
                  Status:
                </span>
                {[
                  { key: "all", label: "All", count: playersList.length },
                  {
                    key: "sold",
                    label: "Sold",
                    count: statusCounts.sold,
                    color: "green",
                  },
                  {
                    key: "unsold",
                    label: "Unsold",
                    count: statusCounts.unsold,
                    color: "red",
                  },
                  {
                    key: "pending",
                    label: "Pending",
                    count: statusCounts.pending,
                    color: "gray",
                  },
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
                <p className="text-lg text-textLight mb-4">
                  No players added yet
                </p>
                <button onClick={openAddModal} className="btn btn-primary">
                  Add First Player
                </button>
              </div>
            ) : filteredPlayers.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-lg text-textLight">
                  No players in this group
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto -mx-4 sm:-mx-6 px-4 sm:px-6 pb-2">
                <table className="w-full min-w-[800px] table-improved">
                  <thead>
                    <tr className="border-b-2 border-border">
                      <th className="text-left py-4 px-4 font-bold text-primary whitespace-nowrap">
                        #
                      </th>
                      <th className="text-left py-4 px-4 font-bold text-primary whitespace-nowrap">
                        Player Name
                      </th>
                      <th className="text-left py-4 px-4 font-bold text-primary whitespace-nowrap">
                        Age
                      </th>
                      <th className="text-left py-4 px-4 font-bold text-primary whitespace-nowrap">
                        Group
                      </th>
                      <th className="text-left py-4 px-4 font-bold text-primary whitespace-nowrap">
                        Base Price
                      </th>
                      <th className="text-left py-4 px-4 font-bold text-primary whitespace-nowrap">
                        Status
                      </th>
                      <th className="text-center py-4 px-4 font-bold text-primary whitespace-nowrap">
                        Actions
                      </th>
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
                            player.soldTo
                              ? "bg-green-50/50"
                              : player.unsold
                                ? "bg-red-50/50"
                                : ""
                          }`}
                        >
                          <td className="py-4 px-4 text-textLight">
                            {idx + 1}
                          </td>
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-3">
                              {player.photo_url && (
                                <img
                                  src={getImagePath(
                                    "player-photo",
                                    player.photo_url,
                                  )}
                                  alt={player.player_name}
                                  className="w-8 h-8 rounded-full object-cover"
                                  onError={(e) => {
                                    e.target.style.display = "none";
                                  }}
                                />
                              )}
                              <span className="font-bold text-text">
                                {player.player_name}
                              </span>
                            </div>
                          </td>
                          <td className="py-4 px-4 text-text">{player.age}</td>
                          <td className="py-4 px-4">
                            <span
                              className={`px-3 py-1 rounded-full text-sm font-bold ${
                                !player.group_id
                                  ? "bg-amber-100 text-amber-700"
                                  : "bg-secondary text-primary"
                              }`}
                            >
                              {!player.group_id
                                ? "Unassigned"
                                : group?.group_name || "Unknown Group"}
                            </span>
                            {player.group_id && !group && (
                              <span className="block text-xs text-danger mt-1">
                                Bad ID: {player.group_id}
                              </span>
                            )}
                          </td>
                          <td className="py-4 px-4 text-text font-semibold">
                            {!player.group_id
                              ? "—"
                              : `₹${(group?.base_price || 0).toLocaleString()}`}
                          </td>
                          <td className="py-4 px-4">
                            {getStatusBadge(player)}
                          </td>
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
                                onClick={() => handleDeletePlayer(player)}
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
          title={
            editingPlayer ? `Edit ${editingPlayer.player_name}` : "Add Player"
          }
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
          title={
            salePlayer ? `Edit Sale: ${salePlayer.player_name}` : "Edit Sale"
          }
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
                  {!salePlayer.group_id
                    ? "Unassigned Group"
                    : groupsList.find(
                        (g) => String(g.id) === String(salePlayer.group_id),
                      )?.group_name || "Unknown Group"}
                  {salePlayer.soldTo && (
                    <span>
                      {" "}
                      | Currently:{" "}
                      {
                        teamsList.find(
                          (t) => String(t.id) === String(salePlayer.soldTo),
                        )?.team_name
                      }{" "}
                      at ₹{(salePlayer.soldPrice || 0).toLocaleString()}
                    </span>
                  )}
                </p>
              </div>

              <div>
                <label className="block font-semibold text-text mb-2">
                  Sold To Team
                </label>
                <select
                  value={saleForm.soldTo}
                  onChange={(e) =>
                    setSaleForm({ ...saleForm, soldTo: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:border-primary"
                >
                  <option value="">Not Sold (move to pending)</option>
                  {teamsList.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.team_name} (Budget: ₹
                      {(team.budget_remaining || 0).toLocaleString()})
                    </option>
                  ))}
                </select>
              </div>

              {saleForm.soldTo && (
                <div>
                  <label className="block font-semibold text-text mb-2">
                    Sold Price (₹)
                  </label>
                  <input
                    type="number"
                    value={saleForm.soldPrice}
                    onChange={(e) =>
                      setSaleForm({
                        ...saleForm,
                        soldPrice: Number(e.target.value),
                      })
                    }
                    placeholder="e.g., 50000"
                    className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:border-primary"
                  />
                </div>
              )}
            </div>
          )}
        </Modal>

        <Modal
          isOpen={showSegregationModal}
          title="Segregate Players into Groups"
          onClose={() => {
            setShowSegregationModal(false);
            resetSegregationState();
          }}
          onConfirm={handleApplySegregation}
          confirmText={`Move Selected (${segregationSelectedIds.length})`}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-text mb-2">
                  Show players from
                </label>
                <select
                  value={segregationForm.sourceGroup}
                  onChange={(e) => {
                    setSegregationForm({
                      ...segregationForm,
                      sourceGroup: e.target.value,
                    });
                    setSegregationSelectedIds([]);
                  }}
                  className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:border-primary"
                >
                  <option value={UNASSIGNED_GROUP_ID}>Unassigned players</option>
                  <option value="all">All players</option>
                  {groupsList.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.group_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-text mb-2">
                  Assign selected to
                </label>
                <select
                  value={segregationForm.targetGroup}
                  onChange={(e) =>
                    setSegregationForm({
                      ...segregationForm,
                      targetGroup: e.target.value,
                    })
                  }
                  className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:border-primary"
                >
                  <option value="">Select target group</option>
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
                Find players
              </label>
              <input
                type="text"
                value={segregationSearch}
                onChange={(e) => setSegregationSearch(e.target.value)}
                placeholder="Search by player name"
                className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:border-primary"
              />
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <p className="text-sm text-textLight">
                {segregationSelectedIds.length} selected out of{" "}
                {segregationFilteredCandidates.length} shown (
                {segregationCandidates.length} total from source)
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleToggleSelectAllFiltered}
                  className="btn btn-sm btn-secondary"
                >
                  {allFilteredSelected ? "Unselect Shown" : "Select All Shown"}
                </button>
                <button
                  type="button"
                  onClick={() => setSegregationSelectedIds([])}
                  className="btn btn-sm btn-secondary"
                >
                  Clear
                </button>
              </div>
            </div>
            <p className="text-xs text-textLight">
              Note: Sold players are excluded from segregation.
            </p>

            <div className="max-h-64 overflow-y-auto border border-border rounded-lg">
              {segregationFilteredCandidates.length === 0 ? (
                <p className="text-sm text-textLight p-4">
                  No players found for the selected source/search.
                </p>
              ) : (
                segregationFilteredCandidates.map((player) => {
                  const currentGroup = player.group_id
                    ? groupsById.get(String(player.group_id))
                    : null;
                  const isSelected = segregationSelectedIdSet.has(String(player.id));
                  return (
                    <label
                      key={player.id}
                      className="flex items-center justify-between gap-3 p-3 border-b border-border last:border-b-0 hover:bg-lightBg cursor-pointer"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSegregationPlayer(player.id)}
                          className="h-4 w-4"
                        />
                        <div className="min-w-0">
                          <p className="font-semibold text-text truncate">
                            {player.player_name}
                          </p>
                          <p className="text-xs text-textLight">
                            Age: {player.age || "N/A"} | Current:{" "}
                            {currentGroup?.group_name || "Unassigned"}
                          </p>
                        </div>
                      </div>
                      {player.soldTo && (
                        <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700 font-semibold">
                          SOLD
                        </span>
                      )}
                    </label>
                  );
                })
              )}
            </div>
          </div>
        </Modal>

        {/* Toast Notifications */}
        <ToastContainer toasts={toasts} removeToast={removeToast} />
      </div>
    </div>
  );
};

export default AdminPlayers;
