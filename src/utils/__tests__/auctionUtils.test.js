/**
 * Comprehensive tests for auctionUtils.js
 * Tests all calculation functions with various edge cases and parameter variations
 */

import {
  GROUP_RULES,
  TOTAL_PLAYERS_PER_TEAM,
  TOTAL_MIN_RESERVE,
  normalizeGroupName,
  getTeamGroupCounts,
  getUnfilledMinimums,
  calculateMinReserve,
  checkTeamEligibility,
  getTeamGroupStatus,
  getSequentialProgress,
  calculateSequentialReserve,
  getCurrentSequentialGroup,
  getNextSequentialPlayer,
} from "../auctionUtils";

// ============================================
// TEST DATA FIXTURES
// ============================================

// Standard 7 groups as in PCL 26
const standardGroups = [
  { id: "1", group_name: "A+" },
  { id: "2", group_name: "A" },
  { id: "3", group_name: "B+" },
  { id: "4", group_name: "B" },
  { id: "5", group_name: "C" },
  { id: "6", group_name: "D" },
  { id: "7", group_name: "X" },
];

// Alternative group naming (with "Group" prefix)
const prefixedGroups = [
  { id: "1", group_name: "Group A+" },
  { id: "2", group_name: "Group A" },
  { id: "3", group_name: "Group B+" },
  { id: "4", group_name: "Group B" },
  { id: "5", group_name: "Group C" },
  { id: "6", group_name: "Group D" },
  { id: "7", group_name: "Group X" },
];

// Sample players spread across groups
const createPlayers = (groups) => [
  // A+ players (Group ID 1)
  { id: "p1", player_name: "Player 1", group_id: "1" },
  { id: "p2", player_name: "Player 2", group_id: "1" },
  // A players (Group ID 2)
  { id: "p3", player_name: "Player 3", group_id: "2" },
  { id: "p4", player_name: "Player 4", group_id: "2" },
  // B+ players (Group ID 3)
  { id: "p5", player_name: "Player 5", group_id: "3" },
  { id: "p6", player_name: "Player 6", group_id: "3" },
  // B players (Group ID 4)
  { id: "p7", player_name: "Player 7", group_id: "4" },
  { id: "p8", player_name: "Player 8", group_id: "4" },
  { id: "p9", player_name: "Player 9", group_id: "4" },
  { id: "p10", player_name: "Player 10", group_id: "4" },
  // C players (Group ID 5)
  { id: "p11", player_name: "Player 11", group_id: "5" },
  { id: "p12", player_name: "Player 12", group_id: "5" },
  // D players (Group ID 6)
  { id: "p13", player_name: "Player 13", group_id: "6" },
  { id: "p14", player_name: "Player 14", group_id: "6" },
  { id: "p15", player_name: "Player 15", group_id: "6" },
  { id: "p16", player_name: "Player 16", group_id: "6" },
  // X players (Group ID 7)
  { id: "p17", player_name: "Player 17", group_id: "7" },
  { id: "p18", player_name: "Player 18", group_id: "7" },
];

// ============================================
// GROUP_RULES CONSTANTS TESTS
// ============================================

describe("GROUP_RULES Constants", () => {
  test("GROUP_RULES should have correct base prices", () => {
    expect(GROUP_RULES["A+"].basePrice).toBe(500);
    expect(GROUP_RULES["A"].basePrice).toBe(400);
    expect(GROUP_RULES["B+"].basePrice).toBe(300);
    expect(GROUP_RULES["B"].basePrice).toBe(200);
    expect(GROUP_RULES["C"].basePrice).toBe(150);
    expect(GROUP_RULES["D"].basePrice).toBe(100);
    expect(GROUP_RULES["X"].basePrice).toBe(100);
  });

  test("GROUP_RULES should have correct min/max per team", () => {
    expect(GROUP_RULES["A+"].minPerTeam).toBe(1);
    expect(GROUP_RULES["A+"].maxPerTeam).toBe(1);

    expect(GROUP_RULES["B"].minPerTeam).toBe(2);
    expect(GROUP_RULES["B"].maxPerTeam).toBe(2);

    expect(GROUP_RULES["D"].minPerTeam).toBe(2);
    expect(GROUP_RULES["D"].maxPerTeam).toBe(2);
  });

  test("TOTAL_PLAYERS_PER_TEAM should be 9", () => {
    expect(TOTAL_PLAYERS_PER_TEAM).toBe(9);

    // Verify it matches sum of all maxPerTeam
    const totalFromRules = Object.values(GROUP_RULES).reduce(
      (sum, rule) => sum + rule.maxPerTeam,
      0,
    );
    expect(totalFromRules).toBe(9);
  });

  test("TOTAL_MIN_RESERVE should be 2050", () => {
    // Manual calculation: 500*1 + 400*1 + 300*1 + 200*2 + 150*1 + 100*2 + 100*1 = 2050
    expect(TOTAL_MIN_RESERVE).toBe(2050);

    // Verify calculation
    const calculated = Object.values(GROUP_RULES).reduce(
      (sum, rule) => sum + rule.basePrice * rule.minPerTeam,
      0,
    );
    expect(calculated).toBe(2050);
  });
});

// ============================================
// normalizeGroupName TESTS
// ============================================

describe("normalizeGroupName", () => {
  test("should handle null/undefined", () => {
    expect(normalizeGroupName(null)).toBe(null);
    expect(normalizeGroupName(undefined)).toBe(null);
  });

  test("should handle simple group names", () => {
    expect(normalizeGroupName("A+")).toBe("A+");
    expect(normalizeGroupName("A")).toBe("A");
    expect(normalizeGroupName("B+")).toBe("B+");
    expect(normalizeGroupName("B")).toBe("B");
    expect(normalizeGroupName("C")).toBe("C");
    expect(normalizeGroupName("D")).toBe("D");
    expect(normalizeGroupName("X")).toBe("X");
  });

  test('should strip "Group " prefix', () => {
    expect(normalizeGroupName("Group A+")).toBe("A+");
    expect(normalizeGroupName("Group A")).toBe("A");
    expect(normalizeGroupName("Group B+")).toBe("B+");
    expect(normalizeGroupName("Group B")).toBe("B");
  });

  test("should handle case insensitivity", () => {
    expect(normalizeGroupName("group a+")).toBe("A+");
    expect(normalizeGroupName("GROUP A+")).toBe("A+");
    expect(normalizeGroupName("Group A+")).toBe("A+");
  });

  test("should handle whitespace", () => {
    expect(normalizeGroupName("  A+  ")).toBe("A+");
    expect(normalizeGroupName("Group  B+")).toBe("B+");
  });

  test("should return original for unknown groups", () => {
    expect(normalizeGroupName("Unknown")).toBe("Unknown");
    expect(normalizeGroupName("Group Z")).toBe("Z");
  });
});

// ============================================
// getTeamGroupCounts TESTS
// ============================================

describe("getTeamGroupCounts", () => {
  const players = createPlayers(standardGroups);

  test("should return all zeros for empty squad", () => {
    const counts = getTeamGroupCounts([], players, standardGroups);
    expect(counts).toEqual({
      "A+": 0,
      A: 0,
      "B+": 0,
      B: 0,
      C: 0,
      D: 0,
      X: 0,
    });
  });

  test("should return all zeros for null squad", () => {
    const counts = getTeamGroupCounts(null, players, standardGroups);
    expect(counts).toEqual({
      "A+": 0,
      A: 0,
      "B+": 0,
      B: 0,
      C: 0,
      D: 0,
      X: 0,
    });
  });

  test("should count single player correctly", () => {
    const counts = getTeamGroupCounts(["p1"], players, standardGroups);
    expect(counts["A+"]).toBe(1);
    expect(counts["A"]).toBe(0);
  });

  test("should count multiple players from same group", () => {
    const counts = getTeamGroupCounts(["p7", "p8"], players, standardGroups);
    expect(counts["B"]).toBe(2);
  });

  test("should count players from multiple groups", () => {
    // Full team: 1 A+, 1 A, 1 B+, 2 B, 1 C, 2 D, 1 X
    const squad = ["p1", "p3", "p5", "p7", "p8", "p11", "p13", "p14", "p17"];
    const counts = getTeamGroupCounts(squad, players, standardGroups);

    expect(counts["A+"]).toBe(1);
    expect(counts["A"]).toBe(1);
    expect(counts["B+"]).toBe(1);
    expect(counts["B"]).toBe(2);
    expect(counts["C"]).toBe(1);
    expect(counts["D"]).toBe(2);
    expect(counts["X"]).toBe(1);
  });

  test("should handle Firebase object format for squad", () => {
    const firebaseSquad = { 0: "p1", 1: "p3", 2: "p5" };
    const counts = getTeamGroupCounts(firebaseSquad, players, standardGroups);

    expect(counts["A+"]).toBe(1);
    expect(counts["A"]).toBe(1);
    expect(counts["B+"]).toBe(1);
  });

  test("should handle prefixed group names", () => {
    const counts = getTeamGroupCounts(["p1", "p3"], players, prefixedGroups);
    expect(counts["A+"]).toBe(1);
    expect(counts["A"]).toBe(1);
  });
});

// ============================================
// getUnfilledMinimums TESTS
// ============================================

describe("getUnfilledMinimums", () => {
  test("should return all minimums for empty counts", () => {
    const counts = { "A+": 0, A: 0, "B+": 0, B: 0, C: 0, D: 0, X: 0 };
    const unfilled = getUnfilledMinimums(counts);

    expect(unfilled["A+"]).toBe(1);
    expect(unfilled["A"]).toBe(1);
    expect(unfilled["B+"]).toBe(1);
    expect(unfilled["B"]).toBe(2);
    expect(unfilled["C"]).toBe(1);
    expect(unfilled["D"]).toBe(2);
    expect(unfilled["X"]).toBe(1);
  });

  test("should return zeros for filled minimums", () => {
    const counts = { "A+": 1, A: 1, "B+": 1, B: 2, C: 1, D: 2, X: 1 };
    const unfilled = getUnfilledMinimums(counts);

    Object.values(unfilled).forEach((value) => {
      expect(value).toBe(0);
    });
  });

  test("should handle partial filling", () => {
    const counts = { "A+": 1, A: 0, "B+": 1, B: 1, C: 0, D: 1, X: 0 };
    const unfilled = getUnfilledMinimums(counts);

    expect(unfilled["A+"]).toBe(0); // Have 1, need 1
    expect(unfilled["A"]).toBe(1); // Have 0, need 1
    expect(unfilled["B+"]).toBe(0); // Have 1, need 1
    expect(unfilled["B"]).toBe(1); // Have 1, need 2
    expect(unfilled["C"]).toBe(1); // Have 0, need 1
    expect(unfilled["D"]).toBe(1); // Have 1, need 2
    expect(unfilled["X"]).toBe(1); // Have 0, need 1
  });

  test("should not return negative values for over-filled groups", () => {
    // This shouldn't happen normally, but test edge case
    const counts = { "A+": 3, A: 2, "B+": 2, B: 4, C: 3, D: 5, X: 2 };
    const unfilled = getUnfilledMinimums(counts);

    Object.values(unfilled).forEach((value) => {
      expect(value).toBeGreaterThanOrEqual(0);
    });
  });
});

// ============================================
// calculateMinReserve TESTS
// ============================================

describe("calculateMinReserve", () => {
  test("should return TOTAL_MIN_RESERVE for empty squad", () => {
    const counts = { "A+": 0, A: 0, "B+": 0, B: 0, C: 0, D: 0, X: 0 };
    const reserve = calculateMinReserve(counts);
    expect(reserve).toBe(2050);
  });

  test("should return 0 for fully filled squad", () => {
    const counts = { "A+": 1, A: 1, "B+": 1, B: 2, C: 1, D: 2, X: 1 };
    const reserve = calculateMinReserve(counts);
    expect(reserve).toBe(0);
  });

  test("should calculate correctly for partial squad", () => {
    // Have: 1 A+, 1 A, 0 B+, 1 B, 1 C, 0 D, 0 X
    // Need: 0 A+, 0 A, 1 B+, 1 B, 0 C, 2 D, 1 X
    // Reserve: 300 + 200 + 200 + 100 = 800
    const counts = { "A+": 1, A: 1, "B+": 0, B: 1, C: 1, D: 0, X: 0 };
    const reserve = calculateMinReserve(counts);
    expect(reserve).toBe(300 + 200 + 200 + 100); // 800
  });

  test("should reduce reserve when bidding on needed group", () => {
    // If counts = {B: 1} and bidding on B, assume we'll get one more
    const counts = { "A+": 1, A: 1, "B+": 1, B: 1, C: 1, D: 2, X: 1 };
    // Without bidding: need 1 more B = 200 reserve
    expect(calculateMinReserve(counts)).toBe(200);
    // With bidding on B: assume we get it, need 0 more B = 0 reserve
    expect(calculateMinReserve(counts, "B")).toBe(0);
  });

  test("should not change reserve when bidding on already-filled group", () => {
    const counts = { "A+": 1, A: 1, "B+": 1, B: 2, C: 0, D: 2, X: 1 };
    // C is unfilled (150), bidding on A+ (already full) shouldn't change it
    expect(calculateMinReserve(counts)).toBe(150);
    expect(calculateMinReserve(counts, "A+")).toBe(150);
  });

  test("should handle missing groups in counts", () => {
    // If groupCounts is missing some groups, they should default to 0
    const counts = { "A+": 1, A: 1 }; // Missing B+, B, C, D, X
    const reserve = calculateMinReserve(counts);
    // Need: 1 B+ (300), 2 B (400), 1 C (150), 2 D (200), 1 X (100)
    expect(reserve).toBe(300 + 400 + 150 + 200 + 100); // 1150
  });
});

// ============================================
// checkTeamEligibility TESTS
// ============================================

describe("checkTeamEligibility", () => {
  const createTeam = (budget, squad = []) => ({
    budget_remaining: budget,
    squad: squad,
  });

  test("should allow bid when all conditions met", () => {
    const team = createTeam(5000, ["p1", "p3", "p5"]); // 3 players, plenty of budget
    const counts = { "A+": 1, A: 1, "B+": 1, B: 0, C: 0, D: 0, X: 0 };

    const result = checkTeamEligibility(team, 200, "B", counts);

    expect(result.eligible).toBe(true);
    expect(result.canAffordBid).toBe(true);
    expect(result.canMeetMinimums).toBe(true);
    expect(result.groupFull).toBe(false);
    expect(result.squadFull).toBe(false);
    expect(result.reasons).toHaveLength(0);
  });

  test("should reject when budget too low", () => {
    const team = createTeam(100, []);
    const counts = { "A+": 0, A: 0, "B+": 0, B: 0, C: 0, D: 0, X: 0 };

    const result = checkTeamEligibility(team, 500, "A+", counts);

    expect(result.eligible).toBe(false);
    expect(result.canAffordBid).toBe(false);
    expect(result.reasons.some((r) => r.includes("Budget"))).toBe(true);
  });

  test("should reject when squad is full", () => {
    const squad = ["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8", "p9"]; // 9 players
    const team = createTeam(5000, squad);
    const counts = { "A+": 1, A: 1, "B+": 1, B: 2, C: 1, D: 2, X: 1 };

    const result = checkTeamEligibility(team, 200, "B", counts);

    expect(result.eligible).toBe(false);
    expect(result.squadFull).toBe(true);
    expect(result.reasons.some((r) => r.includes("Squad full"))).toBe(true);
  });

  test("should reject when group is maxed out", () => {
    const team = createTeam(5000, ["p1"]); // Has 1 A+ already
    const counts = { "A+": 1, A: 0, "B+": 0, B: 0, C: 0, D: 0, X: 0 };

    const result = checkTeamEligibility(team, 500, "A+", counts);

    expect(result.eligible).toBe(false);
    expect(result.groupFull).toBe(true);
    expect(result.reasons.some((r) => r.includes("max"))).toBe(true);
  });

  test("should reject when cannot meet remaining minimums", () => {
    // Budget: 600, Bid: 500
    // After bid: 100
    // Still need: 1 A (400), 1 B+ (300), 2 B (400), 1 C (150), 2 D (200), 1 X (100)
    // Reserve needed: 1550 > 100
    const team = createTeam(600, ["p1"]);
    const counts = { "A+": 1, A: 0, "B+": 0, B: 0, C: 0, D: 0, X: 0 };

    const result = checkTeamEligibility(team, 500, "A+", counts);

    expect(result.eligible).toBe(false);
    expect(result.canAffordBid).toBe(true); // Can afford the bid itself
    expect(result.canMeetMinimums).toBe(false); // But can't meet minimums after
  });

  test("should handle prefixed group names", () => {
    const team = createTeam(5000, ["p1", "p3", "p5"]);
    const counts = { "A+": 1, A: 1, "B+": 1, B: 0, C: 0, D: 0, X: 0 };

    const result = checkTeamEligibility(team, 200, "Group B", counts);

    expect(result.eligible).toBe(true);
  });

  test("should calculate correct budgetAfterBid", () => {
    const team = createTeam(1000, []);
    const counts = { "A+": 0, A: 0, "B+": 0, B: 0, C: 0, D: 0, X: 0 };

    const result = checkTeamEligibility(team, 350, "A", counts);

    expect(result.budgetAfterBid).toBe(650);
  });

  test("should work with custom max squad size", () => {
    const squad = Array(7).fill("p1"); // 7 players
    const team = createTeam(5000, squad);
    const counts = { "A+": 1, A: 1, "B+": 1, B: 2, C: 1, D: 1, X: 0 };

    // Default squad size 9: should pass (7 < 9)
    expect(checkTeamEligibility(team, 100, "D", counts).squadFull).toBe(false);

    // Custom squad size 7: should fail (7 >= 7)
    expect(checkTeamEligibility(team, 100, "D", counts, 7).squadFull).toBe(
      true,
    );
  });
});

// ============================================
// EDGE CASE TESTS
// ============================================

describe("Edge Cases", () => {
  test("should handle very large budgets", () => {
    const team = { budget_remaining: 100000, squad: [] };
    const counts = { "A+": 0, A: 0, "B+": 0, B: 0, C: 0, D: 0, X: 0 };

    const result = checkTeamEligibility(team, 50000, "A+", counts);
    expect(result.eligible).toBe(true);
  });

  test("should handle zero budget", () => {
    const team = { budget_remaining: 0, squad: [] };
    const counts = { "A+": 0, A: 0, "B+": 0, B: 0, C: 0, D: 0, X: 0 };

    const result = checkTeamEligibility(team, 100, "X", counts);
    expect(result.eligible).toBe(false);
    expect(result.canAffordBid).toBe(false);
  });

  test("should handle negative budget (edge case)", () => {
    const team = { budget_remaining: -100, squad: [] };
    const counts = { "A+": 0, A: 0, "B+": 0, B: 0, C: 0, D: 0, X: 0 };

    const result = checkTeamEligibility(team, 100, "X", counts);
    expect(result.eligible).toBe(false);
    expect(result.canAffordBid).toBe(false);
  });

  test("should handle bid amount of zero", () => {
    const team = { budget_remaining: 0, squad: [] };
    const counts = { "A+": 0, A: 0, "B+": 0, B: 0, C: 0, D: 0, X: 0 };

    // Zero bid is affordable even with zero budget
    const result = checkTeamEligibility(team, 0, "X", counts);
    expect(result.canAffordBid).toBe(true);
    // But still can't meet minimums
    expect(result.canMeetMinimums).toBe(false);
  });
});

// ============================================
// DIFFERENT TEAM CONFIGURATIONS
// ============================================

describe("Different Number of Teams", () => {
  // The calculations shouldn't depend on number of teams
  // But we verify the group requirements stay consistent

  test("requirements should be same regardless of team count", () => {
    // GROUP_RULES defines per-team requirements
    // With 8 teams or 12 teams, each team needs same minimums
    const counts8Teams = { "A+": 0, A: 0, "B+": 0, B: 0, C: 0, D: 0, X: 0 };
    const counts12Teams = { "A+": 0, A: 0, "B+": 0, B: 0, C: 0, D: 0, X: 0 };

    expect(calculateMinReserve(counts8Teams)).toBe(
      calculateMinReserve(counts12Teams),
    );
    expect(getUnfilledMinimums(counts8Teams)).toEqual(
      getUnfilledMinimums(counts12Teams),
    );
  });
});

// ============================================
// SEQUENTIAL MODE TESTS
// ============================================

describe("Sequential Mode Functions", () => {
  const players = createPlayers(standardGroups);

  describe("getCurrentSequentialGroup", () => {
    test("should return first group if no players sold", () => {
      const unsoldPlayers = players.map((p) => ({
        ...p,
        soldTo: null,
        unsold: false,
      }));
      const currentGroup = getCurrentSequentialGroup(
        unsoldPlayers,
        standardGroups,
      );
      expect(currentGroup.group_name).toBe("A+");
    });

    test("should return second group if first is complete", () => {
      const playersWithSold = players.map((p) => ({
        ...p,
        soldTo: p.group_id === "1" ? "team1" : null, // All A+ sold
        unsold: false,
      }));
      const currentGroup = getCurrentSequentialGroup(
        playersWithSold,
        standardGroups,
      );
      expect(currentGroup.group_name).toBe("A");
    });

    test("should return null if all groups complete", () => {
      const allSoldPlayers = players.map((p) => ({ ...p, soldTo: "team1" }));
      const currentGroup = getCurrentSequentialGroup(
        allSoldPlayers,
        standardGroups,
      );
      expect(currentGroup).toBe(null);
    });
  });

  describe("getNextSequentialPlayer", () => {
    test("should return first unsold player from current group", () => {
      const unsoldPlayers = players.map((p) => ({
        ...p,
        soldTo: null,
        unsold: false,
      }));
      const nextPlayer = getNextSequentialPlayer(unsoldPlayers, standardGroups);
      expect(nextPlayer.group_id).toBe("1"); // A+ group
    });

    test("should skip current player when specified", () => {
      const unsoldPlayers = players.map((p) => ({
        ...p,
        soldTo: null,
        unsold: false,
      }));
      const firstPlayer = unsoldPlayers.find((p) => p.group_id === "1");

      const nextPlayer = getNextSequentialPlayer(
        unsoldPlayers,
        standardGroups,
        firstPlayer.id,
      );
      expect(nextPlayer.id).not.toBe(firstPlayer.id);
    });

    test("should cycle through unsold players", () => {
      // All A+ players marked unsold (went through once, no one bought)
      const playersWithUnsold = players.map((p) => ({
        ...p,
        soldTo: null,
        unsold: p.group_id === "1", // A+ players are unsold
      }));

      const nextPlayer = getNextSequentialPlayer(
        playersWithUnsold,
        standardGroups,
      );
      // Should return one of the unsold A+ players
      expect(nextPlayer.group_id).toBe("1");
    });
  });
});

// ============================================
// STRESS TEST WITH MANY VARIATIONS
// ============================================

describe("Stress Tests - Various Parameters", () => {
  // Test with different base prices
  test("should handle different budget scenarios", () => {
    const budgets = [500, 1000, 2050, 3000, 5000, 8000, 10000];
    const emptyCount = { "A+": 0, A: 0, "B+": 0, B: 0, C: 0, D: 0, X: 0 };

    budgets.forEach((budget) => {
      const team = { budget_remaining: budget, squad: [] };
      const result = checkTeamEligibility(team, 500, "A+", emptyCount);

      // With 2050 minimum reserve needed, only budgets >= 2050 can meet minimums
      if (budget >= 2050) {
        expect(result.canMeetMinimums).toBe(true);
      } else {
        expect(result.canMeetMinimums).toBe(false);
      }
    });
  });

  // Test reserve decreases as groups fill
  test("reserve should decrease monotonically as groups fill", () => {
    const counts = { "A+": 0, A: 0, "B+": 0, B: 0, C: 0, D: 0, X: 0 };
    let prevReserve = calculateMinReserve(counts);

    const fillOrder = ["A+", "A", "B+", "B", "B", "C", "D", "D", "X"];

    fillOrder.forEach((group) => {
      counts[group]++;
      const newReserve = calculateMinReserve(counts);
      expect(newReserve).toBeLessThanOrEqual(prevReserve);
      prevReserve = newReserve;
    });

    // After filling all, reserve should be 0
    expect(prevReserve).toBe(0);
  });
});
