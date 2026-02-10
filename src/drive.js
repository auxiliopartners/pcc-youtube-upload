import {Buffer} from 'node:buffer'
import {Readable} from 'node:stream'
import {drive} from '@googleapis/drive'
import logger from '../utils/logger.js'

const SHARED_DRIVE_ID = '0ADp1d22rJVx5Uk9PVA'

let driveClient

export function initDrive(oauth2Client) {
  driveClient = drive({version: 'v3', auth: oauth2Client})
}

async function findFileInDrive(filename, folderId) {
  const query = folderId
    ? `name = '${filename}' and '${folderId}' in parents and trashed = false`
    : `name = '${filename}' and trashed = false`

  const response = await driveClient.files.list({
    q: query,
    driveId: SHARED_DRIVE_ID,
    corpora: 'drive',
    includeItemsFromAllDrives: true,
    supportsAllDrives: true,
    fields: 'files(id, name, size, mimeType)',
  })

  return response.data.files?.[0]
}

async function findFolderInDrive(folderName) {
  const query = `name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`

  const response = await driveClient.files.list({
    q: query,
    driveId: SHARED_DRIVE_ID,
    corpora: 'drive',
    includeItemsFromAllDrives: true,
    supportsAllDrives: true,
    fields: 'files(id, name)',
  })

  return response.data.files?.[0]
}

export async function loadJsonFromDrive(filename) {
  logger.info({filename}, 'Loading JSON file from Shared Drive')
  const file = await findFileInDrive(filename)
  if (!file) {
    throw new Error(`File "${filename}" not found in Shared Drive`)
  }

  const response = await driveClient.files.get({
    fileId: file.id,
    alt: 'media',
    supportsAllDrives: true,
  })

  return response.data
}

export async function getFileStream(folderName, filename) {
  const folder = await findFolderInDrive(folderName)
  if (!folder) {
    throw new Error(`Folder "${folderName}" not found in Shared Drive`)
  }

  const file = await findFileInDrive(filename, folder.id)
  if (!file) {
    throw new Error(`File "${filename}" not found in folder "${folderName}"`)
  }

  logger.debug({
    filename, folderId: folder.id, fileId: file.id, size: file.size,
  }, 'Streaming file from Drive')

  const response = await driveClient.files.get({
    fileId: file.id,
    alt: 'media',
    supportsAllDrives: true,
  }, {
    responseType: 'stream',
  })

  return {
    stream: response.data,
    size: Number(file.size),
    mimeType: file.mimeType,
    fileId: file.id,
  }
}

export async function getFileBuffer(folderName, filename) {
  const folder = await findFolderInDrive(folderName)
  if (!folder) {
    throw new Error(`Folder "${folderName}" not found in folder "${folderName}"`)
  }

  const file = await findFileInDrive(filename, folder.id)
  if (!file) {
    throw new Error(`File "${filename}" not found in folder "${folderName}"`)
  }

  const response = await driveClient.files.get({
    fileId: file.id,
    alt: 'media',
    supportsAllDrives: true,
  }, {
    responseType: 'arraybuffer',
  })

  return {
    buffer: Buffer.from(response.data),
    size: Number(file.size),
    mimeType: file.mimeType,
  }
}

export function bufferToStream(buffer) {
  return Readable.from(buffer)
}
