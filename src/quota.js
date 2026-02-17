import logger from '../utils/logger.js'

export const DAILY_QUOTA = 10_000
export const UPLOAD_COST = 1600
export const THUMBNAIL_COST = 50
export const PLAYLIST_INSERT_COST = 50
export const PLAYLIST_ITEM_COST = 50
export const PLAYLIST_IMAGE_COST = 50
export const LIST_COST = 1
export const VIDEO_TOTAL_COST = UPLOAD_COST + THUMBNAIL_COST + PLAYLIST_ITEM_COST // 1700

function getPacificDate(date = new Date()) {
  return date.toLocaleDateString('en-CA', {timeZone: 'America/Los_Angeles'})
}

export function resetQuotaIfNewDay(state) {
  const today = getPacificDate()
  if (state.quotaResetDate !== today) {
    logger.info({previousDate: state.quotaResetDate, newDate: today}, 'Quota reset for new day')
    state.quotaUsedToday = 0
    state.quotaResetDate = today
  }
}

export function trackQuota(state, cost) {
  state.quotaUsedToday += cost
  logger.debug({cost, total: state.quotaUsedToday, remaining: DAILY_QUOTA - state.quotaUsedToday}, 'Quota used')
}

export function canAfford(state, cost) {
  return state.quotaUsedToday + cost <= DAILY_QUOTA
}

export function canUploadMore(state) {
  resetQuotaIfNewDay(state)
  return canAfford(state, VIDEO_TOTAL_COST)
}

export function getMsUntilMidnightPacific() {
  const now = new Date()
  // Get current time in Pacific
  const pacificString = now.toLocaleString('en-US', {timeZone: 'America/Los_Angeles'})
  const pacificNow = new Date(pacificString)

  // Midnight Pacific is start of next day
  const midnight = new Date(pacificNow)
  midnight.setDate(midnight.getDate() + 1)
  midnight.setHours(0, 0, 0, 0)

  // Get the difference in ms
  const pacificMs = midnight.getTime() - pacificNow.getTime()
  return pacificMs
}

export function getQuotaStatus(state) {
  resetQuotaIfNewDay(state)
  const remaining = DAILY_QUOTA - state.quotaUsedToday
  const videosRemaining = Math.floor(remaining / VIDEO_TOTAL_COST)

  return {
    dailyQuota: DAILY_QUOTA,
    used: state.quotaUsedToday,
    remaining,
    videosRemaining,
    resetDate: state.quotaResetDate,
  }
}
