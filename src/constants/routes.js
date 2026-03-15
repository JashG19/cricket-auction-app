/**
 * Centralized route definitions
 * Use these instead of hardcoding route strings
 */
export const ROUTES = {
  // Public
  HOME: "/",
  LOGIN: "/login",

  // Admin
  ADMIN_SETUP: "/admin/setup",
  ADMIN_PLAYERS: (auctionId) => `/admin/players/${auctionId}`,
  ADMIN_LIVE: (auctionId) => `/admin/live/${auctionId}`,
  ADMIN_RESULTS: (auctionId) => `/admin/results/${auctionId}`,

  // Viewer
  AUCTION_DASHBOARD: (auctionId) => `/auction/${auctionId}`,
  TEAM_DETAILS: (auctionId) => `/auction/${auctionId}/teams`,
  PLAYER_POOL: (auctionId) => `/auction/${auctionId}/players`,
};
