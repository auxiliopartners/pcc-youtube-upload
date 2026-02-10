import logger from '../../utils/logger.js'

/**
 * Example usage of the Pino logger
 * Run this file with: node src/examples/logger-example.js
 */

// Basic logging at different levels
logger.info('This is an info message')
logger.warn('This is a warning message')
logger.error('This is an error message')
logger.debug('This is a debug message (only visible when DEBUG=true)')

// Structured logging with additional data
logger.info({userId: 123, action: 'login'}, 'User logged in')

// Logging with objects
const user = {
  id: 456,
  email: 'user@example.com',
  name: 'John Doe',
}

logger.info({user}, 'User details')

// Error logging with stack traces
try {
  throw new Error('Something went wrong!')
} catch (error) {
  logger.error({err: error}, 'An error occurred')
}

// Child loggers with bound context
const requestLogger = logger.child({requestId: 'req-789'})
requestLogger.info('Processing request')
requestLogger.info('Request completed')

// Performance timing
const start = Date.now()
// Simulate some work
setTimeout(() => {
  const duration = Date.now() - start
  logger.info({duration}, 'Operation completed')
}, 100)
