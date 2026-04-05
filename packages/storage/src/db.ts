import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

export function resolveDatabasePath(pathFromConfig?: string): string {
  if (pathFromConfig && pathFromConfig.trim()) {
    return resolve(pathFromConfig)
  }

  const fromEnv = process.env.FORGE_DB_PATH
  if (fromEnv && fromEnv.trim()) {
    return resolve(fromEnv)
  }

  return resolve(process.cwd(), '.forge', 'forge.db')
}

export function openDatabase(dbPath: string): DatabaseSync {
  mkdirSync(dirname(dbPath), { recursive: true })
  const db = new DatabaseSync(dbPath)
  db.exec('PRAGMA journal_mode = WAL;')
  db.exec('PRAGMA foreign_keys = ON;')
  return db
}
