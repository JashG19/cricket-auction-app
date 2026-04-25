// Auction flow utilities and group rules

/**
 * Default group rules for PCL 26 auction (legacy/fallback)
 * Each team must have exactly these players from each group
 *
 * NOTE: For new auctions, group rules are loaded from Firebase config.
 * These defaults are used for backward compatibility with old auctions.
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

// Total players per team (sum of all maxPerTeam) - legacy default
export const TOTAL_PLAYERS_PER_TEAM = 9;

// Total minimum reserve needed to fill a squad from scratch - legacy default
export const TOTAL_MIN_RESERVE = Object.values(GROUP_RULES).reduce(
  (sum, rule) => sum + rule.basePrice * rule.minPerTeam,
  0,
); // = 500 + 400 + 300 + 400 + 150 + 200 + 100 = 2050

/**
 * Normalize group name to match group rules keys
 * Handles formats like "Group A+", "Group B", "A+", "B", etc.
 * @param {string} groupName - Raw group name from Firebase
 * @param {Object} groupRules - Group rules object (defaults to GROUP_RULES)
 * @returns {string} - Normalized name (e.g., "A+", "B")
 */
export const normalizeGroupName = (groupName, groupRules = GROUP_RULES) => {
  if (!groupName) return null;
  let normalized = groupName.trim();

  // Remove "Group " prefix if present (case-insensitive)
  if (normalized.toLowerCase().startsWith("group ")) {
    normalized = normalized.substring(6).trim();
  }

  // Find matching key in groupRules (case-insensitive)
  const matchingKey = Object.keys(groupRules).find(
    (k) => k.toLowerCase() === normalized.toLowerCase(),
  );

  return matchingKey || normalized;
};

/**
 * Calculate how many players a team has from each group
 * @param {Array|Object} squad - Array of player IDs in team's squad (or Firebase object)
 * @param {Array} players - All players with group info
 * @param {Array} groups - All groups
 * @param {Object} groupRules - Group rules object (defaults to GROUP_RULES)
 * @returns {Object} - { 'A+': 1, 'A': 0, 'B+': 1, ... }
 */
export const getTeamGroupCounts = (
  squad,
  players,
  groups,
  groupRules = GROUP_RULES,
) => {
  const counts = {};
  // Initialize with groupRules keys
  Object.keys(groupRules).forEach((g) => (counts[g] = 0));

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
        const normalizedName = normalizeGroupName(groupName, groupRules);
        if (normalizedName && counts.hasOwnProperty(normalizedName)) {
          counts[normalizedName]++;
        }
        // Note: Unknown groups are silently ignored - they're likely custom groups
        // not in the default GROUP_RULES
      }
    }
  });

  return counts;
};

/**
 * Calculate unfilled minimums for a team
 * @param {Object} groupCounts - Current counts per group { 'A+': 1, 'A': 0, ... }
 * @param {Object} groupRules - Group rules object (defaults to GROUP_RULES)
 * @returns {Object} - { 'A+': 0, 'A': 1, 'B+': 1, ... } (how many more needed)
 */
export const getUnfilledMinimums = (groupCounts, groupRules = GROUP_RULES) => {
  const unfilled = {};
  Object.entries(groupRules).forEach(([groupName, rule]) => {
    const current = groupCounts[groupName] || 0;
    unfilled[groupName] = Math.max(0, rule.minPerTeam - current);
  });
  return unfilled;
};

/**
 * Calculate minimum reserve budget needed for unfilled group minimums
 * @param {Object} groupCounts - Current counts per group
 * @param {string} currentGroupName - Group being bid on (will be filled if bid succeeds)
 * @param {Object} groupRules - Group rules object (defaults to GROUP_RULES)
 * @returns {number} - Minimum reserve needed in ₹
 */
export const calculateMinReserve = (
  groupCounts,
  currentGroupName = null,
  groupRules = GROUP_RULES,
) => {
  let reserve = 0;

  Object.entries(groupRules).forEach(([groupName, rule]) => {
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
 * @param {Object} groupRules - Group rules object (defaults to GROUP_RULES)
 * @returns {Object} - { eligible, reasons: [], canAffordBid, canMeetMinimums, groupFull, squadFull }
 */
export const checkTeamEligibility = (
  team,
  bidAmount,
  currentGroupName,
  groupCounts,
  maxSquadSize = TOTAL_PLAYERS_PER_TEAM,
  groupRules = GROUP_RULES,
) => {
  // Normalize the group name to match groupRules keys
  const normalizedGroupName = normalizeGroupName(currentGroupName, groupRules);

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
    ? groupRules[normalizedGroupName]
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
    groupRules,
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
 * Get the first group in order (equivalent to "A+" in legacy mode)
 * This is used for Phase 1 of "Open After First Group" auction mode
 * @param {Array} groups - All groups
 * @param {Array} groupOrder - Order of groups (defaults to GROUP_ORDER)
 * @returns {Object|null} - The first group, or null if no groups
 */
export const getFirstGroup = (groups, groupOrder = GROUP_ORDER) => {
  if (!groups || groups.length === 0) return null;

  // Ensure groupOrder is an array
  const order = Array.isArray(groupOrder) ? groupOrder : GROUP_ORDER;

  // Try to find by groupOrder
  for (const groupName of order) {
    const group = groups.find((g) => {
      const normalized = g.group_name
        ?.replace(/^Group\s*/i, "")
        .trim()
        .toUpperCase();
      return normalized === groupName.toUpperCase();
    });
    if (group) return group;
  }

  // Fallback: use first group by order field or array position
  const sortedGroups = [...groups].sort(
    (a, b) => (a.order || 999) - (b.order || 999),
  );
  return sortedGroups[0] || null;
};

/**
 * Get the first TWO groups in order — both are auctioned sequentially in
 * "Open After A+" mode (A+ first, then A). Phase 2 (random) starts from B+.
 * @param {Array} groups - All groups
 * @param {Array} groupOrder - Order of groups (defaults to GROUP_ORDER)
 * @returns {Array} - Up to two group objects
 */
export const getPhase1Groups = (groups, groupOrder = GROUP_ORDER) => {
  if (!groups || groups.length === 0) return [];
  const order = Array.isArray(groupOrder) ? groupOrder : GROUP_ORDER;
  const result = [];
  for (const groupName of order) {
    const group = groups.find((g) => {
      const normalized = g.group_name
        ?.replace(/^Group\s*/i, "")
        .trim()
        .toUpperCase();
      return normalized === groupName.toUpperCase();
    });
    if (group) {
      result.push(group);
      if (result.length === 2) break;
    }
  }
  if (result.length === 0) {
    const sorted = [...groups].sort(
      (a, b) => (a.order || 999) - (b.order || 999),
    );
    return sorted.slice(0, 2);
  }
  return result;
};

/**
 * Get the next player for Phase 1 (A+ then A, sequentially)
 * All A+ players are auctioned first, then all A players, then the
 * unsold re-auction queue for both groups at the end.
 * @param {Array} players - All players
 * @param {Array} groups - All groups
 * @param {Array} unsoldFirstGroupIds - IDs of unsold phase-1 players for re-auction
 * @param {Array} groupOrder - Order of groups (defaults to GROUP_ORDER)
 * @returns {Object|null} - Next phase-1 player to auction, or null if phase complete
 */
export const getNextAplusPlayer = (
  players,
  groups,
  unsoldFirstGroupIds = [],
  groupOrder = GROUP_ORDER,
) => {
  const phase1Groups = getPhase1Groups(groups, groupOrder);
  if (phase1Groups.length === 0) return null;

  // Go through A+ then A in order — return first unauctioned player found
  for (const group of phase1Groups) {
    const groupPlayers = players.filter(
      (p) => String(p.group_id) === String(group.id),
    );
    const notYetAuctioned = groupPlayers.find((p) => !p.soldTo && !p.unsold);
    if (notYetAuctioned) return notYetAuctioned;
  }

  // All phase-1 players have been through once — handle re-auction queue
  if (unsoldFirstGroupIds && unsoldFirstGroupIds.length > 0) {
    for (const unsoldId of unsoldFirstGroupIds) {
      const player = players.find((p) => String(p.id) === String(unsoldId));
      if (player && !player.soldTo) return player;
    }
  }

  return null; // Phase 1 complete
};

/**
 * Check if Phase 1 (A+ and A) is complete — all their players must be sold.
 * @param {Array} players - All players
 * @param {Array} groups - All groups
 * @param {Array} groupOrder - Order of groups (defaults to GROUP_ORDER)
 * @returns {boolean}
 */
export const isPhase1Complete = (players, groups, groupOrder = GROUP_ORDER) => {
  const phase1Groups = getPhase1Groups(groups, groupOrder);
  if (phase1Groups.length === 0) return true;

  return phase1Groups.every((group) => {
    const groupPlayers = players.filter(
      (p) => String(p.group_id) === String(group.id),
    );
    return groupPlayers.every((p) => p.soldTo);
  });
};

/**
 * Get a random player for Phase 2 (excludes A+ and A groups)
 * @param {Array} players - All players
 * @param {Array} groups - All groups
 * @param {Array} groupOrder - Order of groups (defaults to GROUP_ORDER)
 * @returns {Object|null} - Random unsold non-phase-1 player, or null if all sold
 */
export const getRandomPlayer = (players, groups, groupOrder = GROUP_ORDER) => {
  const phase1Groups = getPhase1Groups(groups, groupOrder);
  const phase1Ids = new Set(phase1Groups.map((g) => String(g.id)));

  const availablePlayers = players.filter((p) => {
    return !phase1Ids.has(String(p.group_id)) && !p.soldTo;
  });

  if (availablePlayers.length === 0) return null;
  const randomIndex = Math.floor(Math.random() * availablePlayers.length);
  return availablePlayers[randomIndex];
};

/**
 * Get the next player based on current phase
 * @param {number} phase - Current auction phase (1 or 2)
 * @param {Array} players - All players
 * @param {Array} groups - All groups
 * @param {Array} unsoldFirstGroupIds - IDs of unsold first-group players (for Phase 1 re-auction)
 * @param {Array} groupOrder - Order of groups (defaults to GROUP_ORDER)
 * @returns {Object} - { player, shouldTransitionToPhase2 }
 */
export const getNextAuctionPlayer = (
  phase,
  players,
  groups,
  unsoldFirstGroupIds = [],
  groupOrder = GROUP_ORDER,
) => {
  if (phase === 1) {
    const nextPlayer = getNextAplusPlayer(
      players,
      groups,
      unsoldFirstGroupIds,
      groupOrder,
    );
    if (nextPlayer) {
      return { player: nextPlayer, shouldTransitionToPhase2: false };
    }
    // Phase 1 complete, transition to Phase 2
    return { player: null, shouldTransitionToPhase2: true };
  }

  // Phase 2: Random selection
  const randomPlayer = getRandomPlayer(players, groups, groupOrder);
  return { player: randomPlayer, shouldTransitionToPhase2: false };
};

/**
 * Get display info for a group
 * @param {string} groupName - Group name (e.g., 'A+')
 * @param {Object} groupRules - Group rules object (defaults to GROUP_RULES)
 * @returns {Object} - { basePrice, minPerTeam, maxPerTeam }
 */
export const getGroupInfo = (groupName, groupRules = GROUP_RULES) => {
  return (
    groupRules[groupName] || { basePrice: 100, minPerTeam: 1, maxPerTeam: 1 }
  );
};

// Auction mode constants
export const AUCTION_MODES = {
  OPEN_AFTER_APLUS: "open_after_aplus",
  SEQUENTIAL: "sequential",
};

// Default group order for sequential mode (legacy)
export const GROUP_ORDER = ["A+", "A", "B+", "B", "C", "D", "X"];

/**
 * Check team's group fulfillment status
 * @param {Object} groupCounts - Team's current counts per group
 * @param {Object} groupRules - Group rules object (defaults to GROUP_RULES)
 * @returns {Object} - { complete: boolean, summary: string, details: [] }
 */
export const getTeamGroupStatus = (groupCounts, groupRules = GROUP_RULES) => {
  const details = [];
  let allMet = true;

  Object.entries(groupRules).forEach(([groupName, rule]) => {
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
 * @param {Array} groupOrder - Order of groups for sequential auction (defaults to GROUP_ORDER)
 * @param {Object} groupRules - Group rules object (defaults to GROUP_RULES)
 * @returns {Object|null} - Current group being auctioned
 */
export const getCurrentSequentialGroup = (
  players,
  groups,
  groupOrder = GROUP_ORDER,
  groupRules = GROUP_RULES,
) => {
  // Ensure groupOrder is an array
  const order = Array.isArray(groupOrder) ? groupOrder : GROUP_ORDER;

  for (const groupName of order) {
    const group = groups.find((g) => {
      const normalized = normalizeGroupName(g.group_name, groupRules);
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
 * @param {Array} groupOrder - Order of groups for sequential auction (defaults to GROUP_ORDER)
 * @param {Object} groupRules - Group rules object (defaults to GROUP_RULES)
 * @returns {Object|null} - Next player in sequence, or null if auction complete
 */
export const getNextSequentialPlayer = (
  players,
  groups,
  skipPlayerId = null,
  groupOrder = GROUP_ORDER,
  groupRules = GROUP_RULES,
) => {
  const currentGroup = getCurrentSequentialGroup(
    players,
    groups,
    groupOrder,
    groupRules,
  );

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
    return getNextSequentialPlayer(
      players,
      groups,
      null,
      groupOrder,
      groupRules,
    );
  }

  // If we have a current player to skip, find the NEXT one in the list
  if (skipPlayerId) {
    const currentIndex = allNotSold.findIndex(
      (p) => String(p.id) === String(skipPlayerId),
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
 * @param {Array} groupOrder - Order of groups for sequential auction (defaults to GROUP_ORDER)
 * @param {Object} groupRules - Group rules object (defaults to GROUP_RULES)
 * @returns {number} - Minimum reserve needed in ₹
 */
export const calculateSequentialReserve = (
  groupCounts,
  currentGroupName,
  groups,
  players,
  groupOrder = GROUP_ORDER,
  groupRules = GROUP_RULES,
) => {
  let reserve = 0;
  const normalizedCurrent = normalizeGroupName(currentGroupName, groupRules);

  // Ensure groupOrder is an array
  const order = Array.isArray(groupOrder) ? groupOrder : GROUP_ORDER;

  // Find the current group's position in the order
  const currentGroup = getCurrentSequentialGroup(
    players,
    groups,
    order,
    groupRules,
  );
  const currentGroupNormalized = currentGroup
    ? normalizeGroupName(currentGroup.group_name, groupRules)
    : null;
  const currentIndex = currentGroupNormalized
    ? order.indexOf(currentGroupNormalized)
    : 0;

  order.forEach((groupName, index) => {
    // Only count current and future groups
    if (index < currentIndex) return;

    const rule = groupRules[groupName];
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
 * @param {Array} groupOrder - Order of groups for sequential auction (defaults to GROUP_ORDER)
 * @param {Object} groupRules - Group rules object (defaults to GROUP_RULES)
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
  groupOrder = GROUP_ORDER,
  groupRules = GROUP_RULES,
) => {
  const normalizedGroupName = normalizeGroupName(currentGroupName, groupRules);

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
    ? groupRules[normalizedGroupName]
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
      groupOrder,
      groupRules,
    );
  } else {
    minReserveNeeded = calculateMinReserve(
      groupCounts,
      normalizedGroupName,
      groupRules,
    );
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
 * @param {Array} groupOrder - Order of groups for sequential auction (defaults to GROUP_ORDER)
 * @param {Object} groupRules - Group rules object (defaults to GROUP_RULES)
 * @returns {Object} - { currentGroup, groupProgress, totalProgress }
 */
export const getSequentialProgress = (
  players,
  groups,
  groupOrder = GROUP_ORDER,
  groupRules = GROUP_RULES,
) => {
  const progress = {};
  let totalSold = 0;
  let totalPlayers = 0;

  // Ensure groupOrder is an array
  const order = Array.isArray(groupOrder) ? groupOrder : GROUP_ORDER;

  order.forEach((groupName) => {
    const group = groups.find(
      (g) => normalizeGroupName(g.group_name, groupRules) === groupName,
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

  const currentGroup = getCurrentSequentialGroup(
    players,
    groups,
    order,
    groupRules,
  );

  return {
    currentGroup: currentGroup
      ? normalizeGroupName(currentGroup.group_name, groupRules)
      : null,
    groupProgress: progress,
    totalSold,
    totalPlayers,
  };
};
