import logger from '../utils/logger.js'
import {loadJsonFromDrive} from './drive.js'

export async function loadManifests() {
  logger.info('Loading manifests from Shared Drive...')

  const [manifest, library] = await Promise.all([
    loadJsonFromDrive('manifest.json'),
    loadJsonFromDrive('library.json'),
  ])

  // Build library lookup by ID
  const libraryById = new Map()
  for (const entry of library) {
    libraryById.set(entry.id, entry)
  }

  // Filter to only items with video_original and status: complete
  const items = Object.entries(manifest.items)
    .filter(([_, item]) => item.files?.video_original && item.status === 'complete')
    .map(([id, item]) => ({id, ...item}))

  // Sort by date ascending (oldest first)
  items.sort((a, b) => new Date(a.date) - new Date(b.date))

  logger.info({
    totalItems: Object.keys(manifest.items).length,
    videoItems: items.length,
    libraryEntries: libraryById.size,
  }, 'Manifests loaded')

  return {items, libraryById}
}
