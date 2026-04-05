import { resolve } from 'node:path'

export type DaemonConfig = {
  host: string
  port: number
  dbPath?: string
  authToken?: string
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): DaemonConfig {
  const host = env.FORGE_DAEMON_HOST?.trim() || '127.0.0.1'
  const portRaw = env.FORGE_DAEMON_PORT?.trim() || '4545'
  const port = Number.parseInt(portRaw, 10)

  if (!Number.isFinite(port) || port <= 0) {
    throw new Error(`Invalid FORGE_DAEMON_PORT: ${portRaw}`)
  }

  const dbPath = env.FORGE_DB_PATH?.trim()
  const authToken = env.FORGE_DAEMON_TOKEN?.trim()

  return {
    host,
    port,
    ...(dbPath ? { dbPath: resolve(dbPath) } : {}),
    ...(authToken ? { authToken } : {})
  }
}
