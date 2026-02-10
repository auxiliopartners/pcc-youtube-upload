import pino from 'pino'

const logLevel = process.env.DEBUG === 'true' ? 'debug' : 'info'

const logger = pino({
  level: logLevel,
  transport: process.env.NODE_ENV === 'development'
    ? {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss',
        ignore: 'pid,hostname',
        destination: 2, // Output to stderr
      },
    }
    : undefined,
})

export default logger
