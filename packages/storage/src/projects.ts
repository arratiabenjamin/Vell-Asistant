import { randomUUID } from 'node:crypto'
import type { Storage } from './types.js'
import type { ProjectRecord } from './types.js'

type ProjectRow = {
  id: string
  path: string
  name: string
  last_opened_at: string | null
  created_at: string
}

function mapProject(row: ProjectRow): ProjectRecord {
  return {
    id: row.id,
    path: row.path,
    name: row.name,
    lastOpenedAt: row.last_opened_at,
    createdAt: row.created_at
  }
}

export function listProjects(storage: Pick<Storage, 'db'>, limit = 50): ProjectRecord[] {
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(Math.floor(limit), 500) : 50

  const rows = storage.db
    .prepare(
      `
      SELECT id, path, name, last_opened_at, created_at
      FROM projects
      ORDER BY COALESCE(last_opened_at, created_at) DESC
      LIMIT ?
      `
    )
    .all(safeLimit) as ProjectRow[]

  return rows.map(mapProject)
}

export function getProjectByPath(storage: Pick<Storage, 'db'>, path: string): ProjectRecord | null {
  const row = storage.db
    .prepare(
      `
      SELECT id, path, name, last_opened_at, created_at
      FROM projects
      WHERE path = ?
      `
    )
    .get(path) as ProjectRow | undefined

  return row ? mapProject(row) : null
}

export function upsertProject(
  storage: Pick<Storage, 'db'>,
  input: {
    path: string
    name: string
    lastOpenedAt?: string
  }
): ProjectRecord {
  const now = input.lastOpenedAt ?? new Date().toISOString()

  storage.db
    .prepare(
      `
      INSERT INTO projects (id, path, name, last_opened_at, created_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(path)
      DO UPDATE SET
        name = excluded.name,
        last_opened_at = excluded.last_opened_at
      `
    )
    .run(randomUUID(), input.path, input.name, now, now)

  return getProjectByPath(storage, input.path)!
}

export function countProjects(storage: Pick<Storage, 'db'>): number {
  const row = storage.db.prepare('SELECT COUNT(*) AS total FROM projects').get() as { total: number }
  return row.total
}
