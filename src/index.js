import 'dotenv/config'
import logger from '../utils/logger.js'

/**
 * Main application entry point
 * This is a sample starting point for your Node.js application
 */
async function main() {
  logger.info('Application starting...')
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`)

  try {
    // Your application logic goes here
    logger.info('Application initialized successfully')

    // Example: Check for required environment variables
    if (!process.env.NODE_ENV) {
      logger.warn('NODE_ENV is not set, defaulting to development')
    }

    // Add your application code here
    logger.info('Ready to build something amazing!')
  } catch (error) {
    logger.error({err: error}, 'Application error')
    process.exit(1)
  }
}

// Run the application
main().catch(error => {
  logger.error({err: error}, 'Unhandled error in main')
  process.exit(1)
})
