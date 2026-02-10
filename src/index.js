import 'dotenv/config'
import {program} from 'commander'
import chalk from 'chalk'
import logger from '../utils/logger.js'
import {version, description} from '../utils/package.js'
import {runAuthFlow, getAuthenticatedClient} from './auth.js'
import {initDrive} from './drive.js'
import {initYouTube} from './youtube.js'
import {loadManifests} from './manifest.js'
import {ensurePlaylists} from './playlists.js'
import {runUpload} from './upload.js'
import {loadState} from './state.js'
import {getQuotaStatus} from './quota.js'
import {generateReport} from './report.js'

program
  .name('pcc-youtube-upload')
  .description(description)
  .version(version)

program
  .command('auth')
  .description('Run OAuth 2.0 authentication flow')
  .action(async () => {
    try {
      await runAuthFlow()
    } catch (error) {
      logger.error({err: error}, 'Authentication failed')
      console.error(chalk.red(`Authentication failed: ${error.message}`))
      process.exit(1)
    }
  })

program
  .command('upload')
  .description('Start or resume the upload process')
  .option('--item <id>', 'Upload a single item by ID')
  .option('--dry-run', 'Validate and show what would be uploaded')
  .action(async options => {
    try {
      const {oauth2Client} = await getAuthenticatedClient()
      initDrive(oauth2Client)
      initYouTube(oauth2Client)

      const {items, libraryById, series} = await loadManifests()
      const state = loadState()

      // Ensure playlists exist (unless dry run)
      if (!options.dryRun) {
        await ensurePlaylists(series, state)
      }

      // Run upload
      await runUpload(items, libraryById, state, {
        singleItemId: options.item,
        dryRun: options.dryRun,
      })

      // Generate report after completion
      if (!options.dryRun) {
        const report = generateReport(items, libraryById, state)
        console.log(chalk.green(`\nReport generated: ${report.summary.uploaded} uploaded, ${report.summary.failed} failed, ${report.summary.pending} pending`))
      }
    } catch (error) {
      logger.error({err: error}, 'Upload failed')
      console.error(chalk.red(`Upload failed: ${error.message}`))
      process.exit(1)
    }
  })

program
  .command('status')
  .description('Show current quota and upload status')
  .action(async () => {
    try {
      const state = loadState()
      const quota = getQuotaStatus(state)

      console.log(chalk.bold('\n--- Quota Status ---'))
      console.log(`  Daily quota:      ${quota.dailyQuota} units`)
      console.log(`  Used today:       ${quota.used} units`)
      console.log(`  Remaining:        ${quota.remaining} units`)
      console.log(`  Videos remaining: ${quota.videosRemaining} today`)
      console.log(`  Reset date:       ${quota.resetDate || 'N/A'}`)

      const videoStates = Object.values(state.videos)
      const complete = videoStates.filter(v => v.status === 'complete').length
      const failed = videoStates.filter(v => v.status === 'failed').length
      const uploading = videoStates.filter(v => v.status === 'uploading').length
      const pending = videoStates.filter(v => v.status === 'pending').length

      console.log(chalk.bold('\n--- Upload Status ---'))
      console.log(`  Complete:   ${complete}`)
      console.log(`  Failed:     ${failed}`)
      console.log(`  Uploading:  ${uploading}`)
      console.log(`  Pending:    ${pending}`)
      console.log(`  Playlists:  ${Object.keys(state.playlists).length}`)
      console.log()
    } catch (error) {
      logger.error({err: error}, 'Status check failed')
      console.error(chalk.red(`Status check failed: ${error.message}`))
      process.exit(1)
    }
  })

program
  .command('report')
  .description('Generate upload report from current state')
  .action(async () => {
    try {
      const {oauth2Client} = await getAuthenticatedClient()
      initDrive(oauth2Client)

      const {items, libraryById} = await loadManifests()
      const state = loadState()
      const report = generateReport(items, libraryById, state)

      console.log(chalk.bold('\n--- Upload Report ---'))
      console.log(`  Total videos:  ${report.summary.totalVideos}`)
      console.log(`  Uploaded:      ${report.summary.uploaded}`)
      console.log(`  Failed:        ${report.summary.failed}`)
      console.log(`  Pending:       ${report.summary.pending}`)
      console.log(`  Playlists:     ${report.summary.playlists}`)
      console.log('\n  Report saved to upload-report.json')
      console.log()
    } catch (error) {
      logger.error({err: error}, 'Report generation failed')
      console.error(chalk.red(`Report generation failed: ${error.message}`))
      process.exit(1)
    }
  })

program.parse()
