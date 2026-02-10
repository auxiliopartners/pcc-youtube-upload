import logger from '../utils/logger.js'
import {getYouTube, withRetry} from './youtube.js'
import {
  trackQuota, canAfford, PLAYLIST_INSERT_COST, PLAYLIST_ITEM_COST,
} from './quota.js'
import {setPlaylistState, saveState} from './state.js'

export async function ensurePlaylists(series, state) {
  const youtube = getYouTube()
  let created = 0

  for (const s of series) {
    if (state.playlists[s.id]) {
      logger.debug({seriesId: s.id, title: s.title}, 'Playlist already exists')
      continue
    }

    if (!canAfford(state, PLAYLIST_INSERT_COST)) {
      logger.warn('Not enough quota to create more playlists today')
      break
    }

    logger.info({title: s.title}, 'Creating playlist')

    const response = await withRetry( // eslint-disable-line no-await-in-loop
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
    setPlaylistState(state, s.id, {
      youtubePlaylistId: response.data.id,
      title: s.title,
      createdAt: new Date().toISOString(),
    })

    created++
    logger.info({playlistId: response.data.id, title: s.title}, 'Playlist created')
  }

  saveState(state)
  logger.info({total: Object.keys(state.playlists).length, created}, 'Playlist sync complete')
}

export async function addVideoToPlaylist(videoId, seriesId, position, state) {
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

  // Only set position if provided (0-indexed)
  if (typeof position === 'number') {
    requestBody.snippet.position = position
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
