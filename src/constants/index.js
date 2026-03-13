// Color scheme
export const colors = {
  primary: "#1a3a52", // Dark blue/black
  secondary: "#ffc107", // Gold/yellow
  accent: "#2c5aa0", // Lighter blue
  darkBg: "#0F1419", // Very dark background
  lightBg: "#f8f9fa", // Light gray background
  success: "#10b981", // Green
  danger: "#ef4444", // Red
  warning: "#f59e0b", // Orange
  text: "#1a1a1a", // Dark text
  textLight: "#6b7280", // Light gray text
  border: "#e5e7eb", // Light border
};

// Button colors
export const buttonColors = {
  primary: colors.primary,
  secondary: colors.secondary,
  success: colors.success,
  danger: colors.danger,
};

// Auction status
export const auctionStatus = {
  SETUP: "setup",
  LIVE: "live",
  COMPLETED: "completed",
  PAUSED: "paused",
};

// Player status
export const playerStatus = {
  PENDING: "pending",
  LIVE: "live",
  SOLD: "sold",
  UNSOLD: "unsold",
};

// Default auction settings
export const defaultAuctionSettings = {
  minBasePrice: 5000,
  maxBasePrice: 10000000,
  minIncrement: 5000,
  maxIncrement: 1000000,
  minGroupMaxPrice: 10000,
  maxGroupMaxPrice: 50000000,
};

// Routes
export const routes = {
  HOME: "/",
  LOGIN: "/login",
  ADMIN_SETUP: "/admin/setup",
  ADMIN_PLAYERS: "/admin/players",
  ADMIN_LIVE: "/admin/live",
  ADMIN_RESULTS: "/admin/results",
  AUCTION_DASHBOARD: "/auction/:auctionId",
  AUCTION_TEAMS: "/auction/:auctionId/teams",
  AUCTION_PLAYERS: "/auction/:auctionId/players",
};
