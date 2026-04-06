// Auction flow utilities and group rules

/**
 * Group rules for PCL 26 auction
 * Each team must have exactly these players from each group
 */
export const GROUP_RULES = {
  "A+": { basePrice: 500, minPerTeam: 1, maxPerTeam: 1, order: 1 },
  A: { basePrice: 400, minPerTeam: 1, maxPerTeam: 1, order: 2 },
  "B+": { basePrice: 300, minPerTeam: 1, maxPerTeam: 1, order: 3 },
  B: { basePrice: 200, minPerTeam: 2, maxPerTeam: 2, order: 4 },
  C: { basePrice: 150, minPerTeam: 1, maxPerTeam: 1, order: 5 },
  D: { basePrice: 100, minPerTeam: 2, maxPerTeam: 2, order: 6 },
  X: { basePrice: 100, minPerTeam: 1, maxPerTeam: 1, order: 7 },
};

// Total players per team (sum of all maxPerTeam)
export const TOTAL_PLAYERS_PER_TEAM = 9;

// Total minimum reserve needed to fill a squad from scratch
export const TOTAL_MIN_RESERVE = Object.values(GROUP_RULES).reduce(
  (sum, rule) => sum + rule.basePrice * rule.minPerTeam,
  0,
); // = 500 + 400 + 300 + 400 + 150 + 200 + 100 = 2050

/**
 * Normalize group name to match GROUP_RULES keys
 * Handles formats like "Group A+", "Group B", "A+", "B", etc.
 * @param {string} groupName - Raw group name from Firebase
 * @returns {string} - Normalized name (e.g., "A+", "B")
 */
export const normalizeGroupName = (groupName) => {
  if (!groupName) return null;
  let normalized = groupName.trim();

  // Remove "Group " prefix if present (case-insensitive)
  if (normalized.toLowerCase().startsWith("group ")) {
    normalized = normalized.substring(6).trim();
  }

  // Find matching key in GROUP_RULES (case-insensitive)
  const matchingKey = Object.keys(GROUP_RULES).find(
    (k) => k.toLowerCase() === normalized.toLowerCase(),
  );

  return matchingKey || normalized;
};

/**
 * Calculate how many players a team has from each group
 * @param {Array|Object} squad - Array of player IDs in team's squad (or Firebase object)
 * @param {Array} players - All players with group info
 * @param {Array} groups - All groups
 * @returns {Object} - { 'A+': 1, 'A': 0, 'B+': 1, ... }
 */
export const getTeamGroupCounts = (squad, players, groups) => {
  const counts = {};
  // Initialize with GROUP_RULES keys
  Object.keys(GROUP_RULES).forEach((g) => (counts[g] = 0));

  if (!squad || !players || !groups) return counts;

  // Handle Firebase object format (convert to array if needed)
  let squadArray = squad;
  if (squad && typeof squad === "object" && !Array.isArray(squad)) {
    squadArray = Object.values(squad);
  }

  if (!squadArray || squadArray.length === 0) return counts;

  const squadSet = new Set(squadArray.map(String));
  const groupMap = new Map(groups.map((g) => [String(g.id), g.group_name]));

  players.forEach((player) => {
    // Count if player is in this team's squad
    if (squadSet.has(String(player.id))) {
      const groupName = groupMap.get(String(player.group_id));
      if (groupName) {
        const normalizedName = normalizeGroupName(groupName);
        if (normalizedName && counts.hasOwnProperty(normalizedName)) {
          counts[normalizedName]++;
        } else {
          // Log unmatched group for debugging
          console.warn(
            `⚠️ Unknown group name: "${groupName}" (normalized: "${normalizedName}")`,
          );
        }
      }
    }
  });

  return counts;
};

/**
 * Calculate unfilled minimums for a team
 * @param {Object} groupCounts - Current counts per group { 'A+': 1, 'A': 0, ... }
 * @returns {Object} - { 'A+': 0, 'A': 1, 'B+': 1, ... } (how many more needed)
 */
export const getUnfilledMinimums = (groupCounts) => {
  const unfilled = {};
  Object.entries(GROUP_RULES).forEach(([groupName, rule]) => {
    const current = groupCounts[groupName] || 0;
    unfilled[groupName] = Math.max(0, rule.minPerTeam - current);
  });
  return unfilled;
};

/**
 * Calculate minimum reserve budget needed for unfilled group minimums
 * @param {Object} groupCounts - Current counts per group
 * @param {string} currentGroupName - Group being bid on (will be filled if bid succeeds)
 * @returns {number} - Minimum reserve needed in ₹
 */
export const calculateMinReserve = (groupCounts, currentGroupName = null) => {
  let reserve = 0;

  Object.entries(GROUP_RULES).forEach(([groupName, rule]) => {
    let current = groupCounts[groupName] || 0;

    // If bidding on this group, assume we'll get one more
    if (groupName === currentGroupName) {
      current += 1;
    }

    const stillNeeded = Math.max(0, rule.minPerTeam - current);
    reserve += stillNeeded * rule.basePrice;
  });

  return reserve;
};

/**
 * Check if a team can bid at a given amount
 * Returns detailed eligibility info
 * @param {Object} team - Team object with budget_remaining, squad
 * @param {number} bidAmount - Current bid amount
 * @param {string} currentGroupName - Group name of player being auctioned (can be "Group B" or "B")
 * @param {Object} groupCounts - Team's current player counts per group
 * @param {number} maxSquadSize - Maximum squad size (default 9)
 * @returns {Object} - { eligible, reasons: [], canAffordBid, canMeetMinimums, groupFull, squadFull }
 */
export const checkTeamEligibility = (
  team,
  bidAmount,
  currentGroupName,
  groupCounts,
  maxSquadSize = TOTAL_PLAYERS_PER_TEAM,
) => {
  // Normalize the group name to match GROUP_RULES keys
  const normalizedGroupName = normalizeGroupName(currentGroupName);

  const budgetRemaining = Number(team.budget_remaining) || 0;
  const squadSize = team.squad?.length || 0;
  const reasons = [];

  // 1. Basic affordability
  const canAffordBid = budgetRemaining >= bidAmount;
  if (!canAffordBid) {
    reasons.push(
      `Budget ₹${budgetRemaining.toLocaleString()} < Bid ₹${bidAmount.toLocaleString()}`,
    );
  }

  // 2. Squad full check
  const squadFull = squadSize >= maxSquadSize;
  if (squadFull) {
    reasons.push(`Squad full (${maxSquadSize})`);
  }

  // 3. Group max check (only if we have a valid group)
  const groupRule = normalizedGroupName
    ? GROUP_RULES[normalizedGroupName]
    : null;
  const currentGroupCount = normalizedGroupName
    ? groupCounts[normalizedGroupName] || 0
    : 0;
  const groupFull = groupRule && currentGroupCount >= groupRule.maxPerTeam;
  if (groupFull) {
    reasons.push(
      `Already has max ${normalizedGroupName} players (${groupRule.maxPerTeam})`,
    );
  }

  // 4. Reserve for unfilled minimums check
  const budgetAfterBid = budgetRemaining - bidAmount;
  const minReserveNeeded = calculateMinReserve(
    groupCounts,
    normalizedGroupName,
  );
  const canMeetMinimums = budgetAfterBid >= minReserveNeeded;
  if (!canMeetMinimums && canAffordBid && minReserveNeeded > 0) {
    reasons.push(
      `Reserve needed: ₹${minReserveNeeded.toLocaleString()} for unfilled group minimums (have ₹${budgetAfterBid.toLocaleString()} after bid)`,
    );
  }

  const eligible = canAffordBid && !squadFull && !groupFull && canMeetMinimums;

  return {
    eligible,
    canAffordBid,
    canMeetMinimums,
    groupFull,
    squadFull,
    minReserveNeeded,
    budgetAfterBid,
    reasons,
  };
};

/**
 * Get the next player for Phase 1 (A+ round)
 * @param {Array} players - All players
 * @param {Array} groups - All groups
 * @param {Array} unsoldAplusIds - IDs of unsold A+ players for re-auction
 * @returns {Object|null} - Next A+ player to auction, or null if phase complete
 */
export const getNextAplusPlayer = (players, groups, unsoldAplusIds = []) => {
  // Find A+ group
  const aplusGroup = groups.find((g) => g.group_name === "A+");
  if (!aplusGroup) return null;

  // Get all A+ players
  const aplusPlayers = players.filter(
    (p) => String(p.group_id) === String(aplusGroup.id),
  );

  // First, find A+ players not yet auctioned (neither sold nor unsold)
  const notYetAuctioned = aplusPlayers.find((p) => !p.soldTo && !p.unsold);
  if (notYetAuctioned) return notYetAuctioned;

  // If all auctioned once, check unsold queue for re-auction
  // But verify the player is still actually unsold (not sold in a previous re-auction)
  if (unsoldAplusIds && unsoldAplusIds.length > 0) {
    for (const unsoldId of unsoldAplusIds) {
      const player = players.find((p) => String(p.id) === String(unsoldId));
      // Only return if player exists and is still not sold
      if (player && !player.soldTo) {
        return player;
      }
    }
  }

  return null; // Phase 1 complete
};

/**
 * Check if Phase 1 (A+ round) is complete
 * @param {Array} players - All players
 * @param {Array} groups - All groups
 * @returns {boolean} - True if all A+ players are sold
 */
export const isPhase1Complete = (players, groups) => {
  const aplusGroup = groups.find((g) => g.group_name === "A+");
  if (!aplusGroup) return true;

  const aplusPlayers = players.filter(
    (p) => String(p.group_id) === String(aplusGroup.id),
  );

  // Phase 1 is complete when ALL A+ players have soldTo (not just auctioned)
  return aplusPlayers.every((p) => p.soldTo);
};

/**
 * Get a random player for Phase 2
 * @param {Array} players - All players
 * @param {Array} groups - All groups
 * @returns {Object|null} - Random unsold non-A+ player, or null if all sold
 */
export const getRandomPlayer = (players, groups) => {
  const aplusGroup = groups.find((g) => g.group_name === "A+");
  const aplusGroupId = aplusGroup ? String(aplusGroup.id) : null;

  // Get all available non-A+ players (not sold yet, including those marked unsold for re-auction)
  const availablePlayers = players.filter((p) => {
    const isAplus = aplusGroupId && String(p.group_id) === aplusGroupId;
    const isSold = !!p.soldTo;
    // Available if: not A+, not sold (unsold players can be re-auctioned)
    return !isAplus && !isSold;
  });

  if (availablePlayers.length === 0) return null;

  // Random selection
  const randomIndex = Math.floor(Math.random() * availablePlayers.length);
  return availablePlayers[randomIndex];
};

/**
 * Get the next player based on current phase
 * @param {number} phase - Current auction phase (1 or 2)
 * @param {Array} players - All players
 * @param {Array} groups - All groups
 * @param {Array} unsoldAplusIds - IDs of unsold A+ players (for Phase 1 re-auction)
 * @returns {Object} - { player, shouldTransitionToPhase2 }
 */
export const getNextAuctionPlayer = (
  phase,
  players,
  groups,
  unsoldAplusIds = [],
) => {
  if (phase === 1) {
    const nextPlayer = getNextAplusPlayer(players, groups, unsoldAplusIds);
    if (nextPlayer) {
      return { player: nextPlayer, shouldTransitionToPhase2: false };
    }
    // Phase 1 complete, transition to Phase 2
    return { player: null, shouldTransitionToPhase2: true };
  }

  // Phase 2: Random selection
  const randomPlayer = getRandomPlayer(players, groups);
  return { player: randomPlayer, shouldTransitionToPhase2: false };
};

/**
 * Get display info for a group
 * @param {string} groupName - Group name (e.g., 'A+')
 * @returns {Object} - { basePrice, minPerTeam, maxPerTeam }
 */
export const getGroupInfo = (groupName) => {
  return (
    GROUP_RULES[groupName] || { basePrice: 100, minPerTeam: 1, maxPerTeam: 1 }
  );
};

// Auction mode constants
export const AUCTION_MODES = {
  OPEN_AFTER_APLUS: "open_after_aplus",
  SEQUENTIAL: "sequential",
};

// Group order for sequential mode
export const GROUP_ORDER = ["A+", "A", "B+", "B", "C", "D", "X"];

/**
 * Check team's group fulfillment status
 * @param {Object} groupCounts - Team's current counts per group
 * @returns {Object} - { complete: boolean, summary: string, details: [] }
 */
export const getTeamGroupStatus = (groupCounts) => {
  const details = [];
  let allMet = true;

  Object.entries(GROUP_RULES).forEach(([groupName, rule]) => {
    const count = groupCounts[groupName] || 0;
    const needed = rule.minPerTeam;
    const met = count >= needed;
    if (!met) allMet = false;

    details.push({
      group: groupName,
      current: count,
      min: rule.minPerTeam,
      max: rule.maxPerTeam,
      met,
      canAdd: count < rule.maxPerTeam,
    });
  });

  return {
    complete: allMet,
    summary: allMet ? "All group requirements met" : "Missing required players",
    details,
  };
};

// ============================================
// SEQUENTIAL MODE FUNCTIONS
// ============================================

/**
 * Get the current group being auctioned in sequential mode
 * @param {Array} players - All players
 * @param {Array} groups - All groups
 * @returns {Object|null} - Current group being auctioned
 */
export const getCurrentSequentialGroup = (players, groups) => {
  for (const groupName of GROUP_ORDER) {
    const group = groups.find((g) => {
      const normalized = normalizeGroupName(g.group_name);
      return normalized === groupName;
    });

    if (!group) continue;

    // Check if this group has any unsold players
    const groupPlayers = players.filter(
      (p) => String(p.group_id) === String(group.id),
    );
    const hasUnsoldPlayers = groupPlayers.some((p) => !p.soldTo);

    if (hasUnsoldPlayers) {
      return group;
    }
  }

  return null; // All groups complete
};

/**
 * Get the next player for sequential mode
 * @param {Array} players - All players
 * @param {Array} groups - All groups
 * @param {string|null} skipPlayerId - Optional player ID to skip (current player)
 * @returns {Object|null} - Next player in sequence, or null if auction complete
 */
export const getNextSequentialPlayer = (
  players,
  groups,
  skipPlayerId = null,
) => {
  const currentGroup = getCurrentSequentialGroup(players, groups);

  if (!currentGroup) return null; // All groups complete

  // Get players from current group
  const groupPlayers = players.filter(
    (p) => String(p.group_id) === String(currentGroup.id),
  );

  // First, find players not yet auctioned (skip current player if specified)
  const notYetAuctioned = groupPlayers.find(
    (p) =>
      !p.soldTo &&
      !p.unsold &&
      (!skipPlayerId || String(p.id) !== String(skipPlayerId)),
  );
  if (notYetAuctioned) return notYetAuctioned;

  // Then, find unsold players for re-auction
  // Get ALL players not sold (includes those with unsold=true)
  const allNotSold = groupPlayers.filter((p) => !p.soldTo);
  
  if (allNotSold.length === 0) {
    // Current group complete, move to next (recursive)
    return getNextSequentialPlayer(players, groups, null);
  }

  // If we have a current player to skip, find the NEXT one in the list
  if (skipPlayerId) {
    const currentIndex = allNotSold.findIndex(
      (p) => String(p.id) === String(skipPlayerId)
    );
    
    if (currentIndex !== -1) {
      // Return the next player in the list (wrap around to start if at end)
      const nextIndex = (currentIndex + 1) % allNotSold.length;
      return allNotSold[nextIndex];
    }
  }

  // No skip or current player not in list, return first not-sold player
  return allNotSold[0];
};

/**
 * Calculate minimum reserve for sequential mode
 * In sequential mode, we only need reserve for CURRENT and FUTURE groups
 * @param {Object} groupCounts - Current counts per group
 * @param {string} currentGroupName - Group being bid on
 * @param {Array} groups - All groups (to determine current position)
 * @param {Array} players - All players (to determine current group)
 * @returns {number} - Minimum reserve needed in ₹
 */
export const calculateSequentialReserve = (
  groupCounts,
  currentGroupName,
  groups,
  players,
) => {
  let reserve = 0;
  const normalizedCurrent = normalizeGroupName(currentGroupName);

  // Find the current group's position in the order
  const currentGroup = getCurrentSequentialGroup(players, groups);
  const currentGroupNormalized = currentGroup
    ? normalizeGroupName(currentGroup.group_name)
    : null;
  const currentIndex = currentGroupNormalized
    ? GROUP_ORDER.indexOf(currentGroupNormalized)
    : 0;

  GROUP_ORDER.forEach((groupName, index) => {
    // Only count current and future groups
    if (index < currentIndex) return;

    const rule = GROUP_RULES[groupName];
    if (!rule) return;

    let current = groupCounts[groupName] || 0;

    // If bidding on this group, assume we'll get one more
    if (groupName === normalizedCurrent) {
      current += 1;
    }

    const stillNeeded = Math.max(0, rule.minPerTeam - current);
    reserve += stillNeeded * rule.basePrice;
  });

  return reserve;
};

/**
 * Check team eligibility with mode-specific reserve calculation
 * @param {Object} team - Team object
 * @param {number} bidAmount - Current bid amount
 * @param {string} currentGroupName - Group name of player being auctioned
 * @param {Object} groupCounts - Team's current player counts per group
 * @param {string} auctionMode - "open_after_aplus" or "sequential"
 * @param {Array} groups - All groups (needed for sequential mode)
 * @param {Array} players - All players (needed for sequential mode)
 * @param {number} maxSquadSize - Maximum squad size
 * @returns {Object} - Eligibility result
 */
export const checkTeamEligibilityWithMode = (
  team,
  bidAmount,
  currentGroupName,
  groupCounts,
  auctionMode = AUCTION_MODES.OPEN_AFTER_APLUS,
  groups = [],
  players = [],
  maxSquadSize = TOTAL_PLAYERS_PER_TEAM,
) => {
  const normalizedGroupName = normalizeGroupName(currentGroupName);

  const budgetRemaining = Number(team.budget_remaining) || 0;
  const squadSize = team.squad?.length || 0;
  const reasons = [];

  // 1. Basic affordability
  const canAffordBid = budgetRemaining >= bidAmount;
  if (!canAffordBid) {
    reasons.push(
      `Budget ₹${budgetRemaining.toLocaleString()} < Bid ₹${bidAmount.toLocaleString()}`,
    );
  }

  // 2. Squad full check
  const squadFull = squadSize >= maxSquadSize;
  if (squadFull) {
    reasons.push(`Squad full (${maxSquadSize})`);
  }

  // 3. Group max check
  const groupRule = normalizedGroupName
    ? GROUP_RULES[normalizedGroupName]
    : null;
  const currentGroupCount = normalizedGroupName
    ? groupCounts[normalizedGroupName] || 0
    : 0;
  const groupFull = groupRule && currentGroupCount >= groupRule.maxPerTeam;
  if (groupFull) {
    reasons.push(
      `Already has max ${normalizedGroupName} players (${groupRule.maxPerTeam})`,
    );
  }

  // 4. Reserve calculation - mode specific
  const budgetAfterBid = budgetRemaining - bidAmount;
  let minReserveNeeded;

  if (auctionMode === AUCTION_MODES.SEQUENTIAL) {
    minReserveNeeded = calculateSequentialReserve(
      groupCounts,
      normalizedGroupName,
      groups,
      players,
    );
  } else {
    minReserveNeeded = calculateMinReserve(groupCounts, normalizedGroupName);
  }

  const canMeetMinimums = budgetAfterBid >= minReserveNeeded;
  if (!canMeetMinimums && canAffordBid && minReserveNeeded > 0) {
    reasons.push(
      `Reserve needed: ₹${minReserveNeeded.toLocaleString()} for unfilled group minimums (have ₹${budgetAfterBid.toLocaleString()} after bid)`,
    );
  }

  const eligible = canAffordBid && !squadFull && !groupFull && canMeetMinimums;

  return {
    eligible,
    canAffordBid,
    canMeetMinimums,
    groupFull,
    squadFull,
    minReserveNeeded,
    budgetAfterBid,
    reasons,
  };
};

/**
 * Get progress info for sequential mode
 * @param {Array} players - All players
 * @param {Array} groups - All groups
 * @returns {Object} - { currentGroup, groupProgress, totalProgress }
 */
export const getSequentialProgress = (players, groups) => {
  const progress = {};
  let totalSold = 0;
  let totalPlayers = 0;

  GROUP_ORDER.forEach((groupName) => {
    const group = groups.find(
      (g) => normalizeGroupName(g.group_name) === groupName,
    );
    if (!group) {
      progress[groupName] = { sold: 0, total: 0 };
      return;
    }

    const groupPlayers = players.filter(
      (p) => String(p.group_id) === String(group.id),
    );
    const sold = groupPlayers.filter((p) => p.soldTo).length;

    progress[groupName] = {
      sold,
      total: groupPlayers.length,
      complete: sold === groupPlayers.length && groupPlayers.length > 0,
    };

    totalSold += sold;
    totalPlayers += groupPlayers.length;
  });

  const currentGroup = getCurrentSequentialGroup(players, groups);

  return {
    currentGroup: currentGroup
      ? normalizeGroupName(currentGroup.group_name)
      : null,
    groupProgress: progress,
    totalSold,
    totalPlayers,
  };
};
