// Validation utilities for auction data

export const validateAuctionSetup = (auctionData) => {
  const errors = {}

  if (!auctionData.name || auctionData.name.trim() === '') {
    errors.name = 'Auction name is required'
  }

  if (!auctionData.purseSize || auctionData.purseSize <= 0) {
    errors.purseSize = 'Purse size must be greater than 0'
  }

  if (!auctionData.maxPlayers || auctionData.maxPlayers <= 0) {
    errors.maxPlayers = 'Max players must be greater than 0'
  }

  if (auctionData.date && new Date(auctionData.date) < new Date()) {
    errors.date = 'Auction date cannot be in the past'
  }

  return Object.keys(errors).length === 0 ? null : errors
}

export const validateTeam = (teamData) => {
  const errors = {}

  if (!teamData.team_name || teamData.team_name.trim() === '') {
    errors.team_name = 'Team name is required'
  }

  if (!teamData.owner_name || teamData.owner_name.trim() === '') {
    errors.owner_name = 'Owner name is required'
  }

  if (!teamData.budget_total || teamData.budget_total <= 0) {
    errors.budget_total = 'Budget must be greater than 0'
  }

  return Object.keys(errors).length === 0 ? null : errors
}

export const validateGroup = (groupData) => {
  const errors = {}

  if (!groupData.group_name || groupData.group_name.trim() === '') {
    errors.group_name = 'Group name is required'
  }

  if (!groupData.increment_value || groupData.increment_value <= 0) {
    errors.increment_value = 'Increment value must be greater than 0'
  }

  if (groupData.max_bid_cap && groupData.max_bid_cap <= 0) {
    errors.max_bid_cap = 'Max bid cap must be greater than 0'
  }

  return Object.keys(errors).length === 0 ? null : errors
}

export const validatePlayer = (playerData) => {
  const errors = {}

  if (!playerData.player_name || playerData.player_name.trim() === '') {
    errors.player_name = 'Player name is required'
  }

  if (!playerData.age || playerData.age <= 0 || playerData.age > 120) {
    errors.age = 'Valid age is required'
  }

  if (!playerData.group_id) {
    errors.group_id = 'Player group is required'
  }

  if (playerData.base_price === undefined || playerData.base_price < 0) {
    errors.base_price = 'Valid base price is required'
  }

  return Object.keys(errors).length === 0 ? null : errors
}

export const validateBidIncrement = (
  newBid,
  groupMaxPrice,
  teamBudget,
  basePrice
) => {
  if (newBid < basePrice) {
    return 'Bid cannot be less than base price'
  }

  if (groupMaxPrice && newBid > groupMaxPrice) {
    return `Bid exceeds group max price of ${groupMaxPrice}`
  }

  if (teamBudget && newBid > teamBudget) {
    return `Bid exceeds team remaining budget of ${teamBudget}`
  }

  return null
}

export const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

export const validateCSVData = (data) => {
  // Validates CSV player data structure
  if (!Array.isArray(data) || data.length === 0) {
    return 'CSV must contain at least one row'
  }

  const requiredFields = ['player_name', 'age', 'group_id', 'base_price']
  const firstRow = data[0]

  for (const field of requiredFields) {
    if (!(field in firstRow)) {
      return `CSV must contain ${field} column`
    }
  }

  return null
}

export const sanitizePlayerName = (name) => {
  return name.trim().replace(/[<>]/g, '')
}

export const calculateRemainingBudget = (totalBudget, amountSpent) => {
  return Math.max(0, totalBudget - amountSpent)
}

export const isValidImageUrl = (url) => {
  try {
    const urlObj = new URL(url)
    return /\.(jpg|jpeg|png|gif|webp)$/i.test(urlObj.pathname)
  } catch {
    return false
  }
}
