/**
 * Transform Firebase object response to array with IDs
 * Normalizes all IDs to strings to prevent type inconsistencies
 */
export const firebaseObjectToArray = (data) => {
  if (!data) return [];
  return Object.entries(data).map(([id, item]) => ({
    ...item,
    id: String(id), // Normalize ID to string
  }));
};

/**
 * Create Map from array of objects for O(1) lookup by ID
 */
export const createLookupMap = (items) => {
  const map = new Map();
  items.forEach((item) => {
    map.set(String(item.id), item);
  });
  return map;
};

/**
 * Find player's team
 */
export const findPlayerTeam = (playerId, teamsList) => {
  return teamsList.find((team) =>
    team.squad?.some((pid) => String(pid) === String(playerId)),
  );
};

/**
 * Format currency for display
 */
export const formatCurrency = (amount) => {
  return amount.toLocaleString();
};

/**
 * Calculate team's spent budget
 */
export const calculateSpentBudget = (team) => {
  return team.budget_total - team.budget_remaining;
};

/**
 * Get full image path from filename
 * Supports backward compatibility with full URLs
 * @param {string} type - 'team-logo' or 'player-photo'
 * @param {string} filename - Image filename or full URL
 * @returns {string|null} Full path to image
 */
export const getImagePath = (type, filename) => {
  if (!filename) return null;
  // Backward compatibility: if already a full URL, return as-is
  if (filename.startsWith("http://") || filename.startsWith("https://")) {
    return filename;
  }
  const basePaths = {
    "team-logo": "/images/team-logos/",
    "player-photo": "/images/player-photos/",
  };
  const basePath = basePaths[type];
  if (!basePath) return null;
  return `${basePath}${filename}`;
};
