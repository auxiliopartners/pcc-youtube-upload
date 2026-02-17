import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import logger from '../utils/logger.js'
import {loadState} from './state.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const reportPath = path.join(__dirname, '..', 'upload-report.json')

export function generateReport(items, libraryById, state) {
  state ||= loadState()

  let uploaded = 0
  let failed = 0
  let pending = 0
  const videos = []

  for (const item of items) {
    const videoState = state.videos[item.id]
    if (!videoState || videoState.status === 'pending') {
      pending++
      continue
    }

    if (videoState.status === 'failed') {
      failed++
      videos.push({
        itemId: item.id,
        title: item.title,
        status: 'failed',
        error: videoState.error,
        failedAt: videoState.failedAt,
      })
      continue
    }

    if (videoState.status === 'complete') {
      uploaded++
      const libraryEntry = libraryById.get(item.id)
      videos.push({
        itemId: item.id,
        title: item.title,
        speaker: libraryEntry?.speaker,
        youtubeVideoId: videoState.youtubeVideoId,
        youtubeUrl: videoState.youtubeUrl,
        thumbnailUploaded: videoState.thumbnailUploaded,
        uploadedAt: videoState.uploadedAt,
      })
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      totalVideos: items.length,
      uploaded,
      failed,
      pending,
    },
    videos,
  }

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))
  logger.info({path: reportPath}, 'Report generated')

  return report
}
