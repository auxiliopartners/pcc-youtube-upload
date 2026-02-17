import {Buffer} from 'node:buffer'
import {Readable} from 'node:stream'
import sharp from 'sharp'
import logger from '../utils/logger.js'
import {getYouTube, withRetry, setPlaylistThumbnail} from './youtube.js'
import {
  trackQuota, canAfford, PLAYLIST_INSERT_COST, PLAYLIST_ITEM_COST, PLAYLIST_IMAGE_COST, LIST_COST,
} from './quota.js'
import {setPlaylistState, saveState} from './state.js'

function getSeriesImageUrl(series) {
  return series._embedded?.images?.[0]?._links?.related?.href ?? null
}

async function setPlaylistThumbnailFromSeries(playlistId, series, state) {
  const imageUrl = getSeriesImageUrl(series)
  if (!imageUrl) {
    logger.debug({title: series.title}, 'No series image URL available')
    return false
  }

  if (!canAfford(state, PLAYLIST_IMAGE_COST)) {
    logger.warn({title: series.title}, 'Not enough quota to set playlist thumbnail')
    return false
  }

  logger.info({title: series.title}, 'Setting playlist thumbnail')
  const imageResponse = await fetch(imageUrl)
  if (!imageResponse.ok) {
    throw new Error(`HTTP ${imageResponse.status} fetching ${imageUrl}`)
  }

  const imageBuffer = Buffer.from(await imageResponse.arrayBuffer())
  const {width, height} = await sharp(imageBuffer).metadata()
  const size = Math.min(width, height)
  const squareBuffer = await sharp(imageBuffer)
    .resize(size, size, {fit: 'cover', position: 'centre'})
    .jpeg()
    .toBuffer()
  await withRetry(
    () => setPlaylistThumbnail(playlistId, Readable.from(squareBuffer), 'image/jpeg'),
    `set thumbnail for playlist "${series.title}"`,
  )

  trackQuota(state, PLAYLIST_IMAGE_COST)
  logger.info({playlistId, title: series.title}, 'Playlist thumbnail set')
  return true
}

async function trySetThumbnail(playlistId, series, state) {
  try {
    const wasSet = await setPlaylistThumbnailFromSeries(playlistId, series, state)
    if (wasSet) {
      setPlaylistState(state, series.id, {thumbnailSet: true})
    }

    return wasSet
  } catch (error) {
    logger.warn(
      {err: error, title: series.title},
      'Failed to set playlist thumbnail, continuing',
    )
    return false
  }
}

async function handleExistingPlaylist(s, existingState, state, {dryRun, fixThumbnails}) {
  if (existingState.thumbnailSet) {
    return 0
  }

  if (dryRun) {
    console.log(`  [THUMBNAIL] Would set thumbnail for "${s.title}" (${existingState.youtubePlaylistId})`)
    return 0
  }

  if (!fixThumbnails) {
    return 0
  }

  logger.info(
    {title: s.title, playlistId: existingState.youtubePlaylistId},
    'Playlist exists but thumbnail not set, retrying',
  )
  const wasSet = await trySetThumbnail(existingState.youtubePlaylistId, s, state)
  return wasSet ? 1 : 0
}

async function adoptYouTubePlaylist(s, youtubeMatch, state, {fixThumbnails}) {
  logger.info(
    {title: s.title, playlistId: youtubeMatch.id},
    'Found existing YouTube playlist matching series title, adopting',
  )
  setPlaylistState(state, s.id, {
    youtubePlaylistId: youtubeMatch.id,
    title: s.title,
    createdAt: new Date().toISOString(),
    thumbnailSet: false,
  })

  if (!fixThumbnails) {
    return 0
  }

  const wasSet = await trySetThumbnail(youtubeMatch.id, s, state)
  return wasSet ? 1 : 0
}

async function createPlaylist(s, state) {
  const youtube = getYouTube()

  logger.info({title: s.title}, 'Creating playlist')

  const response = await withRetry(
    () => youtube.playlists.insert({
      part: ['snippet', 'status'],
      requestBody: {
        snippet: {
          title: s.title,
          description: s.subtitle || `Videos from the "${s.title}" series`,
        },
        status: {
          privacyStatus: 'private',
        },
      },
    }),
    `create playlist "${s.title}"`,
  )

  trackQuota(state, PLAYLIST_INSERT_COST)

  const thumbnailSet = await trySetThumbnail(response.data.id, s, state)

  setPlaylistState(state, s.id, {
    youtubePlaylistId: response.data.id,
    title: s.title,
    createdAt: new Date().toISOString(),
    thumbnailSet,
  })

  logger.info({playlistId: response.data.id, title: s.title}, 'Playlist created')
  return thumbnailSet
}

export async function fetchExistingYouTubePlaylists(state) {
  const youtube = getYouTube()
  const playlistsByTitle = new Map()
  let pageToken

  do {
    if (!canAfford(state, LIST_COST)) {
      logger.warn('Not enough quota to continue fetching playlists')
      break
    }

    const response = await withRetry( // eslint-disable-line no-await-in-loop
      () => youtube.playlists.list({
        part: ['snippet'],
        mine: true,
        maxResults: 50,
        ...(pageToken && {pageToken}),
      }),
      'list existing YouTube playlists',
    )

    trackQuota(state, LIST_COST)

    for (const playlist of response.data.items || []) {
      const {title} = playlist.snippet
      if (!playlistsByTitle.has(title)) {
        playlistsByTitle.set(title, {
          id: playlist.id,
          title,
        })
      }
    }

    pageToken = response.data.nextPageToken
  } while (pageToken)

  logger.info({count: playlistsByTitle.size}, 'Fetched existing YouTube playlists')
  return playlistsByTitle
}

export async function ensurePlaylists(series, state, options = {}) {
  const {dryRun = false, fixThumbnails = true} = options

  // Fetch existing YouTube playlists for duplicate detection
  let existingPlaylists = new Map()
  if (!dryRun) {
    existingPlaylists = await fetchExistingYouTubePlaylists(state)
  }

  let created = 0
  let matched = 0
  let thumbnailsSet = 0
  let skipped = 0

  for (const s of series) {
    const existingState = state.playlists[s.id]

    // Already in state — check if thumbnail needs repair
    if (existingState) {
      thumbnailsSet += await handleExistingPlaylist(s, existingState, state, {dryRun, fixThumbnails}) // eslint-disable-line no-await-in-loop
      skipped++
      continue
    }

    // Not in state — check if it exists on YouTube already
    const youtubeMatch = existingPlaylists.get(s.title)
    if (youtubeMatch && !dryRun) {
      thumbnailsSet += await adoptYouTubePlaylist(s, youtubeMatch, state, {fixThumbnails}) // eslint-disable-line no-await-in-loop
      matched++
      continue
    }

    // Dry run — log what would happen
    if (dryRun) {
      console.log(`  [CREATE] Would create playlist: "${s.title}"`)
      if (getSeriesImageUrl(s)) {
        console.log(`  [THUMBNAIL] Would set thumbnail for "${s.title}"`)
      }

      continue
    }

    // Create new playlist
    if (!canAfford(state, PLAYLIST_INSERT_COST)) {
      logger.warn('Not enough quota to create more playlists today')
      break
    }

    const thumbnailSet = await createPlaylist(s, state) // eslint-disable-line no-await-in-loop
    if (thumbnailSet) {
      thumbnailsSet++
    }

    created++
  }

  saveState(state)
  logger.info({
    total: Object.keys(state.playlists).length,
    created,
    matched,
    thumbnailsSet,
    skipped,
  }, 'Playlist sync complete')

  return {
    created,
    matched,
    thumbnailsSet,
    skipped,
  }
}

export async function addVideoToPlaylist(videoId, seriesId, state) {
  if (!seriesId) {
    return false
  }

  const playlistInfo = state.playlists[seriesId]
  if (!playlistInfo) {
    logger.warn({seriesId}, 'No playlist found for series, skipping playlist add')
    return false
  }

  if (!canAfford(state, PLAYLIST_ITEM_COST)) {
    logger.warn('Not enough quota to add video to playlist')
    return false
  }

  const youtube = getYouTube()

  const requestBody = {
    snippet: {
      playlistId: playlistInfo.youtubePlaylistId,
      resourceId: {
        kind: 'youtube#video',
        videoId,
      },
    },
  }

  await withRetry(
    () => youtube.playlistItems.insert({
      part: ['snippet'],
      requestBody,
    }),
    `add video ${videoId} to playlist ${playlistInfo.youtubePlaylistId}`,
  )

  trackQuota(state, PLAYLIST_ITEM_COST)
  logger.info({videoId, playlistId: playlistInfo.youtubePlaylistId, title: playlistInfo.title}, 'Video added to playlist')
  return true
}
