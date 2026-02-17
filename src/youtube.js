import {youtube} from '@googleapis/youtube'
import logger from '../utils/logger.js'

let youtubeClient

export function initYouTube(oauth2Client) {
  youtubeClient = youtube({version: 'v3', auth: oauth2Client})
  return youtubeClient
}

export function getYouTube() {
  if (!youtubeClient) {
    throw new Error('YouTube client not initialized. Call initYouTube first.')
  }

  return youtubeClient
}

const MAX_RETRIES = 3
const RETRY_DELAYS = [5000, 30_000, 120_000]

function sleep(ms) {
  return new Promise(resolve => {
    setTimeout(resolve, ms)
  })
}

function isRetryable(error) {
  const {code} = error
  const status = error.response?.status || error.status

  return (
    code === 'ECONNRESET'
    || code === 'ETIMEDOUT'
    || code === 'EPIPE'
    || status === 500
    || status === 503
    || (status === 403
      && error.response?.data?.error?.errors?.[0]?.reason === 'rateLimitExceeded')
  )
}

export async function withRetry(fn, context) {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await fn() // eslint-disable-line no-await-in-loop
    } catch (error) {
      if (!isRetryable(error) || attempt === MAX_RETRIES - 1) {
        throw error
      }

      const delay = RETRY_DELAYS[attempt]
      logger.warn({
        attempt: attempt + 1, maxRetries: MAX_RETRIES, context, delay,
      }, 'Retrying after error')
      await sleep(delay) // eslint-disable-line no-await-in-loop
    }
  }
}

export async function uploadVideo(metadata, videoStream, fileSize, onProgress) {
  const youtube = getYouTube()

  const response = await youtube.videos.insert({
    part: ['snippet', 'status', 'recordingDetails'],
    notifySubscribers: false,
    requestBody: metadata,
    media: {
      body: videoStream,
    },
  }, {
    onUploadProgress(event) {
      if (onProgress) {
        onProgress(event.bytesRead, fileSize)
      }
    },
  })

  return response.data
}

export async function setThumbnail(videoId, thumbnailStream, mimeType) {
  const youtube = getYouTube()

  const response = await youtube.thumbnails.set({
    videoId,
    media: {
      mimeType,
      body: thumbnailStream,
    },
  })

  return response.data
}
