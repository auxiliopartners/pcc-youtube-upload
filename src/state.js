import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import logger from '../utils/logger.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const statePath = path.join(__dirname, '..', 'upload-state.json')

const defaultState = {
  startedAt: null,
  updatedAt: null,
  quotaUsedToday: 0,
  quotaResetDate: null,
  videos: {},
}

export function loadState() {
  try {
    const data = fs.readFileSync(statePath, 'utf8')
    return JSON.parse(data)
  } catch {
    logger.info('No existing state found, starting fresh')
    return {...defaultState}
  }
}

export function saveState(state) {
  state.updatedAt = new Date().toISOString()
  state.startedAt ||= state.updatedAt

  fs.writeFileSync(statePath, JSON.stringify(state, null, 2))
}

export function getVideoState(state, itemId) {
  return state.videos[itemId] || {status: 'pending'}
}

export function setVideoState(state, itemId, videoState) {
  state.videos[itemId] = {
    ...state.videos[itemId],
    ...videoState,
  }
  saveState(state)
}
