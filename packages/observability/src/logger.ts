import pino, { type Logger as PinoLogger } from 'pino'

export type Logger = PinoLogger

const rootLogger = pino({
  name: 'forge',
  level: process.env.FORGE_LOG_LEVEL ?? 'info'
})

export function getLogger(scope?: string): Logger {
  return scope ? rootLogger.child({ scope }) : rootLogger
}
