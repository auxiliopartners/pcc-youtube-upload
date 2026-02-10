import logger from '../utils/logger.js'
import {getFileStream, getFileBuffer, bufferToStream} from './drive.js'
import {buildVideoMetadata, getThumbnailFilename} from './metadata.js'
import {uploadVideo as ytUploadVideo, setThumbnail, withRetry} from './youtube.js'
import {addVideoToPlaylist} from './playlists.js'
import {setVideoState, getVideoState} from './state.js'
import {
  canUploadMore, trackQuota, resetQuotaIfNewDay, getMsUntilMidnightPacific, UPLOAD_COST, THUMBNAIL_COST,
} from './quota.js'

function sleep(ms) {
  return new Promise(resolve => {
    setTimeout(resolve, ms)
  })
}

function formatBytes(bytes) {
  const units = ['B', 'KB', 'MB', 'GB']
  let i = 0
  let size = bytes
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024
    i++
  }

  return `${size.toFixed(1)} ${units[i]}`
}

async function uploadSingleVideo(item, libraryEntry, state) {
  const videoFilename = item.files.video_original.filename
  logger.info({id: item.id, title: item.title, video: videoFilename}, 'Starting upload')

  setVideoState(state, item.id, {status: 'uploading', startedAt: new Date().toISOString()})

  // Build metadata
  const metadata = buildVideoMetadata(item, libraryEntry)

  // Stream video from Drive to YouTube
  const {stream: videoStream, size: fileSize} = await getFileStream(item.folder, videoFilename)

  logger.info({title: item.title, size: formatBytes(fileSize)}, 'Uploading video')

  const result = await withRetry(
    () => ytUploadVideo(metadata, videoStream, fileSize, (bytesRead, total) => {
      const percent = ((bytesRead / total) * 100).toFixed(1)
      process.stdout.write(`\r  Upload progress: ${percent}% (${formatBytes(bytesRead)} / ${formatBytes(total)})`)
    }),
    `upload video "${item.title}"`,
  )

  process.stdout.write('\n')

  const videoId = result.id
  trackQuota(state, UPLOAD_COST)
  logger.info({videoId, title: item.title}, 'Video uploaded')

  setVideoState(state, item.id, {
    status: 'uploaded',
    youtubeVideoId: videoId,
    youtubeUrl: `https://youtu.be/${videoId}`,
    uploadedAt: new Date().toISOString(),
  })

  // Upload thumbnail
  const thumbnailFilename = getThumbnailFilename(item)
  let thumbnailUploaded = false
  if (thumbnailFilename) {
    try {
      logger.info({videoId, thumbnail: thumbnailFilename}, 'Setting thumbnail')
      const {buffer, mimeType} = await getFileBuffer(item.folder, thumbnailFilename)
      const thumbnailStream = bufferToStream(buffer)
      await withRetry(
        () => setThumbnail(videoId, thumbnailStream, mimeType),
        `set thumbnail for "${item.title}"`,
      )
      trackQuota(state, THUMBNAIL_COST)
      thumbnailUploaded = true
      logger.info({videoId}, 'Thumbnail set')
    } catch (error) {
      logger.error({err: error, videoId, thumbnail: thumbnailFilename}, 'Failed to set thumbnail')
    }
  }

  // Add to playlist
  let addedToPlaylist = false
  if (item.series?.id) {
    try {
      // Position is 0-indexed in YouTube API; manifest position may be 1-indexed
      const position = typeof item.series.position === 'number'
        ? item.series.position - 1
        : undefined
      addedToPlaylist = await addVideoToPlaylist(videoId, item.series.id, position, state)
    } catch (error) {
      logger.error({err: error, videoId, seriesId: item.series.id}, 'Failed to add video to playlist')
    }
  }

  setVideoState(state, item.id, {
    status: 'complete',
    youtubeVideoId: videoId,
    youtubeUrl: `https://youtu.be/${videoId}`,
    uploadedAt: new Date().toISOString(),
    thumbnailUploaded,
    addedToPlaylist,
  })

  return videoId
}

export async function getNextPendingItem(items, state) {
  for (const item of items) {
    const videoState = getVideoState(state, item.id)
    if (videoState.status === 'pending' || videoState.status === 'uploading') {
      return item
    }
  }

  return null
}

export async function runUpload(items, libraryById, state, {singleItemId, dryRun} = {}) {
  // Filter to a single item if specified
  let uploadItems = items
  if (singleItemId) {
    uploadItems = items.filter(i => i.id === singleItemId)
    if (uploadItems.length === 0) {
      throw new Error(`Item "${singleItemId}" not found in manifest`)
    }
  }

  // Dry run - just show what would be uploaded
  if (dryRun) {
    return runDryRun(uploadItems, libraryById, state)
  }

  // Continuous upload loop
  let uploaded = 0
  let errors = 0

  while (true) {
    resetQuotaIfNewDay(state)

    if (!canUploadMore(state)) {
      const msUntilReset = getMsUntilMidnightPacific()
      const hoursUntilReset = (msUntilReset / 1000 / 60 / 60).toFixed(1)
      logger.info({
        quotaUsed: state.quotaUsedToday,
        hoursUntilReset,
      }, 'Daily quota exhausted. Sleeping until midnight Pacific...')
      console.log(`\nQuota exhausted. Sleeping for ~${hoursUntilReset} hours until midnight Pacific.`)
      await sleep(msUntilReset + 60_000) // eslint-disable-line no-await-in-loop
      continue
    }

    const item = await getNextPendingItem(uploadItems, state) // eslint-disable-line no-await-in-loop
    if (!item) {
      logger.info({uploaded, errors}, 'All videos processed')
      console.log(`\nAll done! Uploaded ${uploaded} videos with ${errors} errors.`)
      break
    }

    const libraryEntry = libraryById.get(item.id)

    try {
      await uploadSingleVideo(item, libraryEntry, state) // eslint-disable-line no-await-in-loop
      uploaded++
    } catch (error) {
      errors++
      logger.error({err: error, itemId: item.id, title: item.title}, 'Upload failed')
      setVideoState(state, item.id, {
        status: 'failed',
        error: error.message,
        failedAt: new Date().toISOString(),
      })
    }

    // Small delay between uploads
    await sleep(5000) // eslint-disable-line no-await-in-loop
  }

  return {uploaded, errors}
}

function runDryRun(items, libraryById, state) {
  let pending = 0
  let completed = 0
  let failed = 0

  console.log('\n--- DRY RUN ---\n')

  for (const item of items) {
    const videoState = getVideoState(state, item.id)
    const libraryEntry = libraryById.get(item.id)
    const status = videoState.status || 'pending'

    if (status === 'complete') {
      completed++
      continue
    }

    if (status === 'failed') {
      failed++
    }

    pending++
    const thumbnail = getThumbnailFilename(item)
    console.log(`  [${status}] ${item.title}`)
    console.log(`         Date: ${item.date}`)
    console.log(`         Video: ${item.files.video_original.filename}`)
    console.log(`         Thumbnail: ${thumbnail || 'none'}`)
    console.log(`         Series: ${item.series?.title || 'none'}`)
    if (libraryEntry?.speaker) {
      console.log(`         Speaker: ${libraryEntry.speaker}`)
    }

    console.log()
  }

  console.log(`Summary: ${pending} to upload, ${completed} already done, ${failed} previously failed`)
  console.log(`Estimated days at 6 videos/day: ${Math.ceil(pending / 6)}`)
  console.log('\n--- END DRY RUN ---\n')

  return {pending, completed, failed}
}
