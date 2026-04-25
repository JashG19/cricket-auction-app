import { useMemo } from "react";
import { useRealtimeData } from "./useRealtimeData";
import { normalizeGroupName } from "../utils/auctionUtils";

/**
 * Legacy hardcoded GROUP_RULES for backward compatibility
 * Used as fallback when auction doesn't have config
 */
const LEGACY_GROUP_RULES = {
  "A+": { basePrice: 500, minPerTeam: 1, maxPerTeam: 1, order: 1 },
  A: { basePrice: 400, minPerTeam: 1, maxPerTeam: 1, order: 2 },
  "B+": { basePrice: 300, minPerTeam: 1, maxPerTeam: 1, order: 3 },
  B: { basePrice: 200, minPerTeam: 2, maxPerTeam: 2, order: 4 },
  C: { basePrice: 150, minPerTeam: 1, maxPerTeam: 1, order: 5 },
  D: { basePrice: 100, minPerTeam: 2, maxPerTeam: 2, order: 6 },
  X: { basePrice: 100, minPerTeam: 1, maxPerTeam: 1, order: 7 },
};

const LEGACY_TOTAL_PLAYERS_PER_TEAM = 9;
const LEGACY_TOTAL_MIN_RESERVE = 2050;
const LEGACY_GROUP_ORDER = ["A+", "A", "B+", "B", "C", "D", "X"];

/**
 * Hook to load auction configuration from Firebase
 * Falls back to legacy hardcoded values for old auctions
 *
 * @param {string} auctionId - The auction ID
 * @param {Array} groupsList - Optional groups list (if already loaded elsewhere)
 * @returns {Object} Configuration object with groupRules, totals, and helpers
 */
export const useAuctionConfig = (auctionId, groupsList = null) => {
  const { data: configData, loading } = useRealtimeData(
    auctionId ? `auctions/${auctionId}/config` : null,
  );

  // Also load groups as fallback source (skip if groupsList already provided)
  const { data: groupsData } = useRealtimeData(
    !groupsList && auctionId ? `auctions/${auctionId}/groups` : null,
  );

  // Use provided groupsList or loaded groupsData
  const effectiveGroupsData =
    groupsList?.length > 0
      ? groupsList.reduce((acc, g, idx) => {
          acc[g.id || idx] = g;
          return acc;
        }, {})
      : groupsData;

  const config = useMemo(() => {
    // Live groups are ALWAYS the source of truth for base prices, min/max per
    // team, increments, and caps — they reflect any edits made after creation.
    // Config is only trusted for the custom groupOrder (sequential mode sequence).
    if (effectiveGroupsData) {
      const groups = Object.values(effectiveGroupsData);
      if (groups.length > 0) {
        const groupRules = {};
        groups.forEach((group, index) => {
          const groupName = normalizeGroupName(group.group_name);
          groupRules[groupName] = {
            basePrice: parseInt(group.base_price) || 0,
            minPerTeam: parseInt(group.min_per_team) || 1,
            maxPerTeam: parseInt(group.max_per_team) || 1,
            order: group.order || index + 1,
            incrementValue: parseInt(group.increment_value) || 10,
            maxBidCap: parseInt(group.max_bid_cap) || 0,
          };
        });

        const totalPlayersPerTeam = Object.values(groupRules).reduce(
          (sum, rule) => sum + rule.maxPerTeam,
          0,
        );
        const totalMinReserve = Object.values(groupRules).reduce(
          (sum, rule) => sum + rule.basePrice * rule.minPerTeam,
          0,
        );

        // Use custom groupOrder from config if admin set one (sequential mode),
        // otherwise fall back to sorting by the group's own order field.
        const defaultOrder = Object.entries(groupRules)
          .sort(([, a], [, b]) => a.order - b.order)
          .map(([name]) => name);
        const groupOrder = configData?.groupOrder
          ? configData.groupOrder.map((name) =>
              normalizeGroupName(name, groupRules),
            )
          : defaultOrder;

        return {
          groupRules,
          totalPlayersPerTeam,
          totalMinReserve,
          groupOrder,
          isLegacy: false,
          isBuiltFromGroups: true,
        };
      }
    }

    // No live groups available — fall back to config (less accurate but better
    // than nothing; this path should rarely be hit in production).
    if (configData?.groupRules) {
      const normalizedRules = {};
      Object.entries(configData.groupRules).forEach(([rawName, rule]) => {
        const name = normalizeGroupName(rawName, configData.groupRules);
        normalizedRules[name] = {
          ...rule,
          basePrice: parseInt(rule.basePrice) || 0,
          minPerTeam: parseInt(rule.minPerTeam) || 1,
          maxPerTeam: parseInt(rule.maxPerTeam) || 1,
          order: parseInt(rule.order) || 1,
          incrementValue: parseInt(rule.incrementValue) || 10,
          maxBidCap: parseInt(rule.maxBidCap) || 0,
        };
      });
      const totalPlayersPerTeam = Object.values(normalizedRules).reduce(
        (sum, r) => sum + r.maxPerTeam,
        0,
      );
      const totalMinReserve = Object.values(normalizedRules).reduce(
        (sum, r) => sum + r.basePrice * r.minPerTeam,
        0,
      );
      const groupOrder = (
        configData.groupOrder || Object.keys(normalizedRules)
      ).map((name) => normalizeGroupName(name, normalizedRules));
      return {
        groupRules: normalizedRules,
        totalPlayersPerTeam,
        totalMinReserve,
        groupOrder,
        isLegacy: false,
      };
    }

    // Fallback to legacy hardcoded values
    return {
      groupRules: LEGACY_GROUP_RULES,
      totalPlayersPerTeam: LEGACY_TOTAL_PLAYERS_PER_TEAM,
      totalMinReserve: LEGACY_TOTAL_MIN_RESERVE,
      groupOrder: LEGACY_GROUP_ORDER,
      isLegacy: true,
    };
  }, [configData, effectiveGroupsData]);

  return {
    ...config,
    loading,

    // Helper functions
    getGroupRule: (groupName) => config.groupRules[groupName] || null,
    isValidGroup: (groupName) => groupName in config.groupRules,
    getBasePrice: (groupName) =>
      config.groupRules[groupName]?.basePrice ?? null,
    getGroupsInOrder: () => config.groupOrder,
  };
};

/**
 * Build group rules from a groups array (for use outside React)
 * @param {Array} groups - Array of group objects from Firebase
 * @returns {Object} Group rules object
 */
export const buildGroupRulesFromGroups = (groups) => {
  if (!groups || groups.length === 0) {
    return LEGACY_GROUP_RULES;
  }

  const groupRules = {};
  groups.forEach((group, index) => {
    const groupName = normalizeGroupName(group.group_name);
    groupRules[groupName] = {
      basePrice: parseInt(group.base_price) || 0,
      minPerTeam: parseInt(group.min_per_team) || 1,
      maxPerTeam: parseInt(group.max_per_team) || 1,
      order: group.order || index + 1,
    };
  });

  return groupRules;
};

/**
 * Calculate totals from group rules
 * @param {Object} groupRules - Group rules object
 * @returns {Object} { totalPlayersPerTeam, totalMinReserve, groupOrder }
 */
export const calculateTotalsFromRules = (groupRules) => {
  const totalPlayersPerTeam = Object.values(groupRules).reduce(
    (sum, rule) => sum + rule.maxPerTeam,
    0,
  );
  const totalMinReserve = Object.values(groupRules).reduce(
    (sum, rule) => sum + rule.basePrice * rule.minPerTeam,
    0,
  );
  const groupOrder = Object.entries(groupRules)
    .sort(([, a], [, b]) => a.order - b.order)
    .map(([name]) => name);

  return { totalPlayersPerTeam, totalMinReserve, groupOrder };
};

// Export legacy values for tests and backward compatibility
export {
  LEGACY_GROUP_RULES,
  LEGACY_TOTAL_PLAYERS_PER_TEAM,
  LEGACY_TOTAL_MIN_RESERVE,
  LEGACY_GROUP_ORDER,
};
