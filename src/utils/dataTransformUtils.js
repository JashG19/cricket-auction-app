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
 * @param {string} playerName - Optional player name for smart photo matching
 * @returns {string|null} Full path to image
 */
const PLAYER_PHOTO_ASSETS = import.meta.glob(
  "/public/images/player-photos/*.{jpg,jpeg,png,webp,avif,JPG,JPEG,PNG,WEBP,AVIF}",
  { eager: true, import: "default" },
);

const toFileName = (value) => String(value || "").split(/[\\/]/).pop() || "";

const stripExtension = (value) => String(value || "").replace(/\.[^.]+$/, "");

const stripIndexPrefix = (value) =>
  String(value || "").replace(/^\s*\d+\s*[.)-]?\s*/, "").trim();

const normalizePhotoText = (value) =>
  String(value || "")
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^\x00-\x7F]/g, "")
    .replace(/\bcricket profile\b/g, " ")
    .replace(/\bprofile\b/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const playerPhotoIndex = (() => {
  const entries = Object.entries(PLAYER_PHOTO_ASSETS)
    .map(([modulePath, url]) => {
      const fileName = toFileName(modulePath);
      return {
        fileName,
        url,
        normalizedFileName: normalizePhotoText(stripExtension(fileName)),
        normalizedName: normalizePhotoText(
          stripIndexPrefix(stripExtension(fileName)),
        ),
      };
    })
    .filter((entry) => entry.fileName && entry.url)
    .sort((a, b) => a.fileName.localeCompare(b.fileName));

  const byFileName = new Map();
  const byNormalizedFileName = new Map();
  const byNormalizedName = new Map();

  entries.forEach((entry) => {
    const fileKey = entry.fileName.toLowerCase();
    if (!byFileName.has(fileKey)) {
      byFileName.set(fileKey, entry.url);
    }
    if (entry.normalizedFileName && !byNormalizedFileName.has(entry.normalizedFileName)) {
      byNormalizedFileName.set(entry.normalizedFileName, entry.url);
    }
    if (entry.normalizedName && !byNormalizedName.has(entry.normalizedName)) {
      byNormalizedName.set(entry.normalizedName, entry.url);
    }
  });

  return { byFileName, byNormalizedFileName, byNormalizedName };
})();

const resolvePlayerPhotoFromIndex = (filename, playerName) => {
  if (filename) {
    const fileName = toFileName(filename);
    const fileKey = fileName.toLowerCase();
    const normalizedFileName = normalizePhotoText(stripExtension(fileName));
    const normalizedName = normalizePhotoText(stripIndexPrefix(stripExtension(fileName)));

    return (
      playerPhotoIndex.byFileName.get(fileKey) ||
      playerPhotoIndex.byNormalizedFileName.get(normalizedFileName) ||
      playerPhotoIndex.byNormalizedName.get(normalizedName) ||
      null
    );
  }

  const normalizedPlayerName = normalizePhotoText(playerName);
  if (!normalizedPlayerName) return null;
  return playerPhotoIndex.byNormalizedName.get(normalizedPlayerName) || null;
};

export const getImagePath = (type, filename, playerName = "") => {
  if (
    filename &&
    (filename.startsWith("http://") ||
      filename.startsWith("https://") ||
      filename.startsWith("/"))
  ) {
    return filename;
  }

  if (type === "player-photo") {
    const resolved = resolvePlayerPhotoFromIndex(filename, playerName);
    if (resolved) return resolved;
  }

  if (!filename) return null;

  const basePaths = {
    "team-logo": "/images/team-logos/",
    "player-photo": "/images/player-photos/",
  };
  const basePath = basePaths[type];
  if (!basePath) return null;
  return `${basePath}${filename}`;
};
