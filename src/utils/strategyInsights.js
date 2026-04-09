// Team Strategy Insights - Real-time bidding guidance

import {
  GROUP_RULES,
  TOTAL_PLAYERS_PER_TEAM,
  normalizeGroupName,
  getTeamGroupCounts,
  getUnfilledMinimums,
  calculateMinReserve,
} from "./auctionUtils";

/**
 * Risk levels for budget situations
 */
export const RISK_LEVELS = {
  SAFE: { level: "SAFE", color: "green", icon: "✅" },
  MEDIUM: { level: "MEDIUM", color: "yellow", icon: "⚠️" },
  HIGH: { level: "HIGH", color: "orange", icon: "🔶" },
  CRITICAL: { level: "CRITICAL", color: "red", icon: "🚨" },
};

/**
 * Analyze a team's budget situation
 * @param {Object} team - Team object
 * @param {Object} groupCounts - Current players per group
 * @param {string} currentGroupName - Group of player being auctioned (normalized)
 * @param {Object} groupRules - Group rules object (defaults to GROUP_RULES)
 * @param {number} totalPlayersPerTeam - Total players per team (defaults to TOTAL_PLAYERS_PER_TEAM)
 * @returns {Object} Budget analysis
 */
export const analyzeBudget = (
  team,
  groupCounts,
  currentGroupName = null,
  groupRules = GROUP_RULES,
  totalPlayersPerTeam = TOTAL_PLAYERS_PER_TEAM,
) => {
  const budget = Number(team.budget_remaining) || 0;
  const squadSize = team.squad?.length || 0;
  const slotsRemaining = totalPlayersPerTeam - squadSize;

  // Calculate mandatory reserve (minimum needed to fill remaining slots)
  const mandatoryReserve = calculateMinReserve(
    groupCounts,
    currentGroupName,
    groupRules,
  );

  // Flexible budget = what's left after setting aside mandatory reserve
  const flexibleBudget = Math.max(0, budget - mandatoryReserve);

  // Average available per remaining player
  const avgPerPlayer =
    slotsRemaining > 0 ? Math.floor(budget / slotsRemaining) : 0;
  const safeAvgPerPlayer =
    slotsRemaining > 0 ? Math.floor(flexibleBudget / slotsRemaining) : 0;

  // Risk assessment
  let riskLevel;
  if (flexibleBudget <= 0) {
    riskLevel = RISK_LEVELS.CRITICAL;
  } else if (flexibleBudget < 300) {
    riskLevel = RISK_LEVELS.HIGH;
  } else if (flexibleBudget < 800) {
    riskLevel = RISK_LEVELS.MEDIUM;
  } else {
    riskLevel = RISK_LEVELS.SAFE;
  }

  return {
    budget,
    squadSize,
    slotsRemaining,
    mandatoryReserve,
    flexibleBudget,
    avgPerPlayer,
    safeAvgPerPlayer,
    riskLevel,
  };
};

/**
 * Calculate max safe bid for a team
 * @param {Object} team - Team object
 * @param {Object} groupCounts - Current players per group
 * @param {string} currentGroupName - Group being bid on (normalized)
 * @param {Object} groupRules - Group rules object (defaults to GROUP_RULES)
 * @param {number} totalPlayersPerTeam - Total players per team (defaults to TOTAL_PLAYERS_PER_TEAM)
 * @returns {Object} Bid limits
 */
export const calculateBidLimits = (
  team,
  groupCounts,
  currentGroupName = null,
  groupRules = GROUP_RULES,
  totalPlayersPerTeam = TOTAL_PLAYERS_PER_TEAM,
) => {
  const budget = Number(team.budget_remaining) || 0;
  const squadSize = team.squad?.length || 0;
  const slotsRemaining = totalPlayersPerTeam - squadSize;

  // Reserve needed AFTER buying this player (one less slot)
  const reserveAfterBuy = calculateMinReserve(
    groupCounts,
    currentGroupName,
    groupRules,
  );

  // Maximum safe bid = budget - reserve needed after buying
  const maxSafeBid = Math.max(0, budget - reserveAfterBuy);

  // Conservative bid (leaves 20% buffer above reserve)
  const conservativeBid = Math.max(0, Math.floor(maxSafeBid * 0.7));

  // Balanced bid (leaves 10% buffer)
  const balancedBid = Math.max(0, Math.floor(maxSafeBid * 0.85));

  // Aggressive bid (right at the limit)
  const aggressiveBid = maxSafeBid;

  return {
    maxSafeBid,
    conservativeBid,
    balancedBid,
    aggressiveBid,
    reserveAfterBuy,
    canBid: maxSafeBid > 0,
    slotsAfterBuy: slotsRemaining - 1,
  };
};

/**
 * Analyze group opportunities - what does this team still need?
 * @param {Object} groupCounts - Current players per group
 * @param {Array} players - All players
 * @param {Array} groups - All groups
 * @param {Object} groupRules - Group rules object (defaults to GROUP_RULES)
 * @returns {Array} Group opportunities
 */
export const analyzeGroupOpportunities = (
  groupCounts,
  players,
  groups,
  groupRules = GROUP_RULES,
) => {
  const opportunities = [];

  Object.entries(groupRules).forEach(([groupName, rule]) => {
    const current = groupCounts[groupName] || 0;
    const needed = Math.max(0, rule.minPerTeam - current);
    const canAdd = rule.maxPerTeam - current;

    // Find matching group in Firebase data
    const group = groups.find(
      (g) => normalizeGroupName(g.group_name, groupRules) === groupName,
    );
    if (!group) return;

    // Count available players in this group
    const groupPlayers = players.filter(
      (p) => String(p.group_id) === String(group.id) && !p.soldTo,
    );
    const available = groupPlayers.length;

    // Find cheapest available player
    const cheapest =
      groupPlayers.length > 0
        ? groupPlayers.reduce((min, p) =>
            (p.soldPrice || rule.basePrice) < (min.soldPrice || rule.basePrice)
              ? p
              : min,
          )
        : null;

    opportunities.push({
      group: groupName,
      basePrice: rule.basePrice,
      current,
      min: rule.minPerTeam,
      max: rule.maxPerTeam,
      needed,
      stillNeed: needed, // Alias for UI
      canAdd,
      canBuyMore: canAdd, // Alias for UI
      available,
      cheapestPlayer: cheapest?.player_name || null,
      cheapestPrice: rule.basePrice,
      fulfilled: current >= rule.minPerTeam,
      maxedOut: current >= rule.maxPerTeam,
      urgent: needed > 0 && available <= needed + 2, // Running low
      critical: needed > 0 && available <= needed, // Must buy NOW
    });
  });

  return opportunities;
};

/**
 * Generate risk warnings for a team
 * @param {Object} team - Team object
 * @param {Object} budgetAnalysis - From analyzeBudget
 * @param {Array} groupOpportunities - From analyzeGroupOpportunities
 * @returns {Array} Warning messages
 */
export const generateRiskWarnings = (
  team,
  budgetAnalysis,
  groupOpportunities,
) => {
  const warnings = [];

  // Critical: Can't fulfill minimum requirements
  if (budgetAnalysis.flexibleBudget < 0) {
    warnings.push({
      type: "CRITICAL",
      severity: "critical",
      icon: "🚨",
      title: "Cannot fulfill minimum requirements!",
      message: `Budget ₹${budgetAnalysis.budget.toLocaleString()} is less than mandatory reserve ₹${budgetAnalysis.mandatoryReserve.toLocaleString()}. Must skip all non-essential bids.`,
    });
  }

  // High: Very tight budget
  if (
    budgetAnalysis.riskLevel.level === "HIGH" &&
    budgetAnalysis.flexibleBudget >= 0
  ) {
    warnings.push({
      type: "HIGH",
      severity: "high",
      icon: "🔶",
      title: "Tight budget situation",
      message: `Only ₹${budgetAnalysis.flexibleBudget.toLocaleString()} buffer remaining. Bid carefully.`,
    });
  }

  // Group scarcity warnings
  groupOpportunities.forEach((opp) => {
    if (opp.critical && !opp.fulfilled) {
      warnings.push({
        type: "CRITICAL",
        severity: "critical",
        icon: "🚨",
        title: `${opp.group} running out!`,
        message: `Only ${opp.available} player(s) left and you need ${opp.needed}. Must buy NOW!`,
      });
    } else if (opp.urgent && !opp.fulfilled) {
      warnings.push({
        type: "HIGH",
        severity: "high",
        icon: "⚠️",
        title: `${opp.group} getting scarce`,
        message: `Only ${opp.available} player(s) available, you still need ${opp.needed}.`,
      });
    }
  });

  // Overspending warning
  const avgSpent =
    team.squad?.length > 0
      ? (Number(team.budget_total) - Number(team.budget_remaining)) /
        team.squad.length
      : 0;

  if (avgSpent > 800 && budgetAnalysis.slotsRemaining > 3) {
    warnings.push({
      type: "MEDIUM",
      severity: "medium",
      icon: "⚠️",
      title: "Spending above average",
      message: `Avg ₹${Math.round(avgSpent).toLocaleString()}/player. Consider cheaper picks for remaining ${budgetAnalysis.slotsRemaining} slots.`,
    });
  }

  return warnings;
};

/**
 * Generate bid recommendations for current player
 * @param {Object} team - Team object
 * @param {Object} currentPlayer - Player being auctioned
 * @param {Object} currentGroup - Group of current player
 * @param {Object} groupCounts - Team's current group counts
 * @param {number} currentBid - Current bid amount
 * @param {Array} competingTeams - Other teams that need this group
 * @param {Object} groupRules - Group rules object (defaults to GROUP_RULES)
 * @returns {Object} Bid recommendations
 */
export const generateBidRecommendation = (
  team,
  currentPlayer,
  currentGroup,
  groupCounts,
  currentBid,
  competingTeams = [],
  groupRules = GROUP_RULES,
) => {
  const groupName = normalizeGroupName(currentGroup?.group_name, groupRules);
  const rule = groupRules[groupName];

  if (!rule) {
    return { recommendation: null, reason: "Unknown group" };
  }

  const bidLimits = calculateBidLimits(
    team,
    groupCounts,
    groupName,
    groupRules,
  );
  const current = groupCounts[groupName] || 0;
  const needsThisGroup = current < rule.minPerTeam;
  const canTakeMore = current < rule.maxPerTeam;

  // Can't bid at all
  if (!bidLimits.canBid || currentBid > bidLimits.maxSafeBid) {
    return {
      canBid: false,
      recommendation: "SKIP",
      reason: needsThisGroup
        ? `Budget too tight. Max safe: ₹${bidLimits.maxSafeBid.toLocaleString()}`
        : "Cannot afford this bid safely",
      maxSafeBid: bidLimits.maxSafeBid,
      urgency: needsThisGroup ? "Find cheaper option" : "Not needed",
    };
  }

  // Already maxed out this group
  if (!canTakeMore) {
    return {
      canBid: false,
      recommendation: "SKIP",
      reason: `Already have max ${groupName} players (${rule.maxPerTeam})`,
      maxSafeBid: 0,
      urgency: "None - group complete",
    };
  }

  // Generate recommendation
  let recommendation, reason, urgency;
  const competition = competingTeams.length;

  if (needsThisGroup) {
    if (competition > 3) {
      recommendation = "BID_AGGRESSIVE";
      reason = `You NEED ${groupName} and ${competition} other teams competing. Bid strong!`;
      urgency = "HIGH - Must win eventually";
    } else {
      recommendation = "BID_BALANCED";
      reason = `You need this group. Low competition (${competition} teams).`;
      urgency = "MEDIUM - Required purchase";
    }
  } else {
    if (currentBid <= rule.basePrice + 50) {
      recommendation = "BID_CONSERVATIVE";
      reason = `Optional ${groupName} player at good price. Worth trying.`;
      urgency = "LOW - Nice to have";
    } else {
      recommendation = "CONSIDER_SKIP";
      reason = `Already have minimum ${groupName}. Price getting high.`;
      urgency = "LOW - Not required";
    }
  }

  return {
    canBid: true,
    recommendation,
    reason,
    urgency,
    needsGroup: needsThisGroup,
    ...bidLimits,
    suggestedBid: needsThisGroup
      ? bidLimits.balancedBid
      : bidLimits.conservativeBid,
    currentBid,
    headroom: bidLimits.maxSafeBid - currentBid,
  };
};

/**
 * Generate complete strategy insights for a team
 * @param {Object} team - Team object
 * @param {Array} players - All players
 * @param {Array} groups - All groups
 * @param {Object} currentPlayer - Current player being auctioned (optional)
 * @param {Object} currentGroup - Current player's group (optional)
 * @param {number} currentBid - Current bid amount (optional)
 * @param {Array} allTeams - All teams (for competition analysis)
 * @param {Object} groupRules - Group rules object (defaults to GROUP_RULES)
 * @param {number} totalPlayersPerTeam - Total players per team (defaults to TOTAL_PLAYERS_PER_TEAM)
 * @returns {Object} Complete strategy insights
 */
export const generateTeamInsights = (
  team,
  players,
  groups,
  currentPlayer = null,
  currentGroup = null,
  currentBid = 0,
  allTeams = [],
  groupRules = GROUP_RULES,
  totalPlayersPerTeam = TOTAL_PLAYERS_PER_TEAM,
) => {
  // Get team's current group counts
  const groupCounts = getTeamGroupCounts(
    team.squad,
    players,
    groups,
    groupRules,
  );
  const normalizedGroupName = currentGroup
    ? normalizeGroupName(currentGroup.group_name, groupRules)
    : null;

  // Budget analysis
  const budgetAnalysis = analyzeBudget(
    team,
    groupCounts,
    normalizedGroupName,
    groupRules,
    totalPlayersPerTeam,
  );

  // Group opportunities
  const groupOpportunities = analyzeGroupOpportunities(
    groupCounts,
    players,
    groups,
    groupRules,
  );

  // Risk warnings
  const warnings = generateRiskWarnings(
    team,
    budgetAnalysis,
    groupOpportunities,
  );

  // Check if team can bid on current player (group max check)
  let canBidOnCurrentPlayer = true;
  if (currentPlayer && currentGroup && normalizedGroupName) {
    const currentGroupCount = groupCounts[normalizedGroupName] || 0;
    const rule = groupRules[normalizedGroupName];
    if (rule && currentGroupCount >= rule.maxPerTeam) {
      canBidOnCurrentPlayer = false;
      warnings.unshift({
        type: "CRITICAL",
        severity: "critical",
        icon: "🚫",
        title: `Cannot bid on ${currentPlayer.player_name}`,
        message: `You already have ${currentGroupCount}/${rule.maxPerTeam} players from ${currentGroup.group_name}. Maximum reached!`,
      });
    }
  }

  // Unfilled groups summary
  const unfilledGroups = groupOpportunities.filter((g) => !g.fulfilled);
  const urgentGroups = groupOpportunities.filter(
    (g) => g.urgent && !g.fulfilled,
  );

  // Bid recommendation (if current player provided)
  let bidRecommendation = null;
  if (currentPlayer && currentGroup) {
    // Find competing teams (others that need this group and can afford it)
    const competingTeams = allTeams.filter((t) => {
      if (String(t.id) === String(team.id)) return false;
      const theirCounts = getTeamGroupCounts(
        t.squad,
        players,
        groups,
        groupRules,
      );
      const theirCurrent = theirCounts[normalizedGroupName] || 0;
      const rule = groupRules[normalizedGroupName];
      return (
        rule &&
        theirCurrent < rule.minPerTeam &&
        Number(t.budget_remaining) > currentBid
      );
    });

    bidRecommendation = generateBidRecommendation(
      team,
      currentPlayer,
      currentGroup,
      groupCounts,
      currentBid,
      competingTeams,
      groupRules,
    );
  }

  return {
    teamId: team.id,
    teamName: team.team_name,
    budgetAnalysis,
    groupCounts,
    groupOpportunities,
    unfilledGroups,
    urgentGroups,
    warnings,
    bidRecommendation,
    summary: generateSummary(budgetAnalysis, unfilledGroups, warnings),
  };
};

/**
 * Generate a short summary string
 */
const generateSummary = (budgetAnalysis, unfilledGroups, warnings) => {
  const criticalWarnings = warnings.filter((w) => w.type === "CRITICAL").length;

  if (criticalWarnings > 0) {
    return `🚨 ${criticalWarnings} critical issue(s)! Check warnings.`;
  }

  if (unfilledGroups.length === 0) {
    return `✅ All group requirements met. ₹${budgetAnalysis.flexibleBudget.toLocaleString()} flexible.`;
  }

  const neededGroups = unfilledGroups.map((g) => g.group).join(", ");
  return `Need: ${neededGroups} | Buffer: ₹${budgetAnalysis.flexibleBudget.toLocaleString()}`;
};

/**
 * Format currency for display
 */
export const formatCurrency = (amount) => {
  return `₹${Number(amount).toLocaleString()}`;
};

/**
 * Get risk level color class for Tailwind
 */
export const getRiskColorClass = (riskLevel) => {
  switch (riskLevel?.level) {
    case "SAFE":
      return "text-green-600 bg-green-100";
    case "MEDIUM":
      return "text-yellow-600 bg-yellow-100";
    case "HIGH":
      return "text-orange-600 bg-orange-100";
    case "CRITICAL":
      return "text-red-600 bg-red-100";
    default:
      return "text-gray-600 bg-gray-100";
  }
};
