import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getLogger, type Logger } from '@forge/observability'
import { openDatabase, resolveDatabasePath } from './db.js'
import { runMigrations } from './migrator.js'
import type { Storage, StorageHealth } from './types.js'
export * from './sessions.js'
export * from './projects.js'
export * from './settings.js'
export * from './toolExecutions.js'
export * from './approvals.js'

export type InitializeStorageOptions = {
  dbPath?: string
  migrationsDir?: string
  logger?: Logger
}

const currentDir = dirname(fileURLToPath(import.meta.url))
const defaultMigrationsDir = resolve(currentDir, '../migrations')

export function initializeStorage(options: InitializeStorageOptions = {}): Storage {
  const logger = options.logger ?? getLogger('storage')
  const dbPath = resolveDatabasePath(options.dbPath)
  const migrationsDir = options.migrationsDir ?? defaultMigrationsDir

  const db = openDatabase(dbPath)
  const appliedMigrations = runMigrations({ db, migrationsDir, logger })

  logger.info(
    {
      dbPath,
      migrationsDir,
      appliedNow: appliedMigrations.length
    },
    'Storage initialized'
  )

  return {
    db,
    dbPath,
    appliedMigrations,
    initializedAt: new Date().toISOString()
  }
}

export function getStorageHealth(storage: Pick<Storage, 'db' | 'dbPath'>): StorageHealth {
  const row = storage.db.prepare('SELECT COUNT(*) AS total FROM schema_migrations').get() as { total: number }

  return {
    ready: true,
    path: storage.dbPath,
    migrationsApplied: row.total
  }
}

export function closeStorage(storage: Pick<Storage, 'db'>): void {
  storage.db.close()
}

export type { Storage, StorageHealth }
