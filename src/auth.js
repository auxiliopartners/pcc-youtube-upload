import {createServer} from 'node:http'
import {createInterface} from 'node:readline'
import {fileURLToPath} from 'node:url'
import fs from 'node:fs'
import path from 'node:path'
import {OAuth2Client} from 'google-auth-library'
import {youtube} from '@googleapis/youtube'
import {createClient} from '@1password/sdk'
import logger from '../utils/logger.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const tokensPath = path.join(__dirname, '..', 'tokens.json')

const SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube',
  'https://www.googleapis.com/auth/drive.readonly',
]

const REDIRECT_PORT = 3000
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}/oauth2callback`

async function getCredentialsFrom1Password() {
  const token = process.env.OP_SERVICE_ACCOUNT_TOKEN
  if (!token) {
    throw new Error('OP_SERVICE_ACCOUNT_TOKEN environment variable is required. '
      + 'Set it in your .env file or environment.')
  }

  const client = await createClient({
    auth: token,
    integrationName: 'pcc-youtube-upload',
    integrationVersion: '1.1.0',
  })

  const clientId = await client.secrets.resolve(process.env.OP_GOOGLE_CLIENT_ID || 'op://Private/Google OAuth YouTube/client_id')
  const clientSecret = await client.secrets.resolve(process.env.OP_GOOGLE_CLIENT_SECRET || 'op://Private/Google OAuth YouTube/client_secret')

  return {clientId, clientSecret}
}

function loadTokens() {
  try {
    const data = fs.readFileSync(tokensPath, 'utf8')
    return JSON.parse(data)
  } catch {
    return null
  }
}

function saveTokens(tokens) {
  fs.writeFileSync(tokensPath, JSON.stringify(tokens, null, 2))
  logger.info('Tokens saved to tokens.json')
}

function createOAuth2Client(clientId, clientSecret) {
  return new OAuth2Client(clientId, clientSecret, REDIRECT_URI)
}

async function waitForAuthCode(authUrl) {
  return new Promise((resolve, reject) => {
    const server = createServer((request, response) => {
      const url = new URL(request.url, `http://localhost:${REDIRECT_PORT}`)
      if (url.pathname !== '/oauth2callback') {
        response.writeHead(404)
        response.end('Not found')
        return
      }

      const code = url.searchParams.get('code')
      const error = url.searchParams.get('error')

      if (error) {
        response.writeHead(200, {'Content-Type': 'text/html'})
        response.end('<h1>Authorization failed</h1><p>You can close this window.</p>')
        server.close()
        reject(new Error(`OAuth error: ${error}`))
        return
      }

      if (code) {
        response.writeHead(200, {'Content-Type': 'text/html'})
        response.end('<h1>Authorization successful!</h1><p>You can close this window and return to the terminal.</p>')
        server.close()
        resolve(code)
      }
    })

    server.listen(REDIRECT_PORT, () => {
      console.log(`\nOpen this URL in your browser to authorize:\n\n${authUrl}\n`)
      console.log(`Waiting for authorization on http://localhost:${REDIRECT_PORT}...`)
    })

    server.on('error', reject)
  })
}

function prompt(rl, question) {
  return new Promise(resolve => {
    rl.question(question, resolve)
  })
}

async function selectChannel(oauth2Client) {
  const yt = youtube({version: 'v3', auth: oauth2Client})
  const response = await yt.channels.list({
    part: ['snippet'],
    mine: true,
  })

  const channels = response.data.items || []
  const rl = createInterface({input: process.stdin, output: process.stdout})

  try {
    console.log('\nChannel linked to this token:')
    for (const [index, channel] of channels.entries()) {
      console.log(`  ${index + 1}. ${channel.snippet.title} (${channel.id})`)
    }

    console.log(`  ${channels.length + 1}. Enter a channel ID manually (for brand accounts)`)

    const answer = await prompt(rl, '\nEnter number: ')
    const choice = Number.parseInt(answer.trim(), 10)

    if (choice >= 1 && choice <= channels.length) {
      return channels[choice - 1].id
    }

    if (choice === channels.length + 1) {
      const id = await prompt(rl, 'Enter channel ID: ')
      const channelId = id.trim()
      if (channelId) {
        return channelId
      }

      throw new Error('No channel ID provided')
    }

    throw new Error('Invalid selection')
  } finally {
    rl.close()
  }
}

export async function authenticate() {
  const {clientId, clientSecret} = await getCredentialsFrom1Password()
  const oauth2Client = createOAuth2Client(clientId, clientSecret)

  const existingTokens = loadTokens()
  if (existingTokens) {
    oauth2Client.setCredentials(existingTokens)

    // Check if token needs refresh
    if (existingTokens.expiry_date && existingTokens.expiry_date < Date.now()) {
      logger.info('Access token expired, refreshing...')
      const {credentials} = await oauth2Client.refreshAccessToken()
      saveTokens(credentials)
      oauth2Client.setCredentials(credentials)
    }

    logger.info('Using existing tokens')
    return {oauth2Client, channelId: existingTokens.channelId}
  }

  throw new Error('No tokens found. Run "yarn start auth" first to authenticate.')
}

export async function runAuthFlow() {
  console.log('Starting OAuth 2.0 authentication flow...\n')

  const {clientId, clientSecret} = await getCredentialsFrom1Password()
  const oauth2Client = createOAuth2Client(clientId, clientSecret)

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline', // eslint-disable-line camelcase
    scope: SCOPES,
    prompt: 'select_account consent',
  })

  const code = await waitForAuthCode(authUrl)

  console.log('\nExchanging authorization code for tokens...')
  const {tokens} = await oauth2Client.getToken(code)
  oauth2Client.setCredentials(tokens)

  // Select channel (brand account support)
  const channelId = await selectChannel(oauth2Client)
  tokens.channelId = channelId

  saveTokens(tokens)
  console.log(`\nAuthentication complete! Channel ID: ${channelId}`)

  return {oauth2Client, channelId}
}

export async function getAuthenticatedClient() {
  const {clientId, clientSecret} = await getCredentialsFrom1Password()
  const oauth2Client = createOAuth2Client(clientId, clientSecret)

  const existingTokens = loadTokens()
  if (!existingTokens) {
    throw new Error('No tokens found. Run "yarn start auth" first to authenticate.')
  }

  oauth2Client.setCredentials(existingTokens)

  // Set up automatic token refresh
  oauth2Client.on('tokens', tokens => {
    const current = loadTokens() || {}
    const updated = {...current, ...tokens}
    saveTokens(updated)
    logger.debug('Tokens refreshed and saved')
  })

  return {oauth2Client, channelId: existingTokens.channelId}
}
