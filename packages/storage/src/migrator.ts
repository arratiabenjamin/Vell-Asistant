import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { DatabaseSync } from 'node:sqlite'
import type { Logger } from '@forge/observability'

export function runMigrations(params: {
  db: DatabaseSync
  migrationsDir: string
  logger?: Logger
}): string[] {
  const { db, migrationsDir, logger } = params

  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      executed_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)

  const files = readdirSync(migrationsDir)
    .filter(file => file.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b))

  const alreadyApplied = new Set<string>(
    db.prepare('SELECT name FROM schema_migrations').all().map(row => String((row as { name: string }).name))
  )

  const appliedNow: string[] = []

  for (const file of files) {
    if (alreadyApplied.has(file)) continue

    const sql = readFileSync(join(migrationsDir, file), 'utf8')

    db.exec('BEGIN')
    try {
      db.exec(sql)
      db.prepare('INSERT INTO schema_migrations (name) VALUES (?)').run(file)
      db.exec('COMMIT')
      appliedNow.push(file)
      logger?.info({ migration: file }, 'Applied migration')
    } catch (error) {
      db.exec('ROLLBACK')
      throw error
    }
  }

  return appliedNow
}
