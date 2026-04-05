import { randomUUID } from 'node:crypto'
import type { Storage } from './types.js'
import type {
  AppendMessageInput,
  CreateSessionInput,
  SessionMessageRecord,
  SessionRecord
} from './types.js'

type SessionRow = {
  id: string
  type: string
  project_path: string | null
  title: string | null
  status: string
  provider: string | null
  model: string | null
  created_at: string
  updated_at: string
}

type SessionMessageRow = {
  id: string
  session_id: string
  role: string
  content: string
  created_at: string
}

function mapSession(row: SessionRow): SessionRecord {
  return {
    id: row.id,
    type: row.type,
    projectPath: row.project_path,
    title: row.title,
    status: row.status,
    provider: row.provider,
    model: row.model,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function mapSessionMessage(row: SessionMessageRow): SessionMessageRecord {
  return {
    id: row.id,
    sessionId: row.session_id,
    role: row.role,
    content: row.content,
    createdAt: row.created_at
  }
}

export function listSessions(storage: Pick<Storage, 'db'>): SessionRecord[] {
  const rows = storage.db
    .prepare(
      `
      SELECT id, type, project_path, title, status, provider, model, created_at, updated_at
      FROM sessions
      ORDER BY updated_at DESC
      `
    )
    .all() as SessionRow[]

  return rows.map(mapSession)
}

export function createSession(storage: Pick<Storage, 'db'>, input: CreateSessionInput = {}): SessionRecord {
  const now = new Date().toISOString()
  const id = randomUUID()

  storage.db
    .prepare(
      `
      INSERT INTO sessions (id, type, project_path, title, status, provider, model, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
    )
    .run(
      id,
      input.type ?? 'coding',
      input.projectPath ?? null,
      input.title ?? null,
      'idle',
      input.provider ?? 'mock',
      input.model ?? null,
      now,
      now
    )

  return getSessionById(storage, id)!
}

export function getSessionById(storage: Pick<Storage, 'db'>, id: string): SessionRecord | null {
  const row = storage.db
    .prepare(
      `
      SELECT id, type, project_path, title, status, provider, model, created_at, updated_at
      FROM sessions
      WHERE id = ?
      `
    )
    .get(id) as SessionRow | undefined

  return row ? mapSession(row) : null
}

export function resumeSession(storage: Pick<Storage, 'db'>, id: string): SessionRecord | null {
  const now = new Date().toISOString()
  const result = storage.db
    .prepare(
      `
      UPDATE sessions
      SET status = ?, updated_at = ?
      WHERE id = ?
      `
    )
    .run('active', now, id)

  if (result.changes === 0) return null
  return getSessionById(storage, id)
}

export function setSessionProjectPath(
  storage: Pick<Storage, 'db'>,
  sessionId: string,
  projectPath: string | null
): SessionRecord | null {
  const now = new Date().toISOString()
  const result = storage.db
    .prepare(
      `
      UPDATE sessions
      SET project_path = ?, updated_at = ?
      WHERE id = ?
      `
    )
    .run(projectPath, now, sessionId)

  if (result.changes === 0) return null
  return getSessionById(storage, sessionId)
}

export function countSessions(storage: Pick<Storage, 'db'>): number {
  const row = storage.db.prepare('SELECT COUNT(*) AS total FROM sessions').get() as { total: number }
  return row.total
}

export function countActiveSessions(storage: Pick<Storage, 'db'>): number {
  const row = storage.db
    .prepare('SELECT COUNT(*) AS total FROM sessions WHERE status = ?')
    .get('active') as { total: number }
  return row.total
}

export function getLatestSession(storage: Pick<Storage, 'db'>): SessionRecord | null {
  const row = storage.db
    .prepare(
      `
      SELECT id, type, project_path, title, status, provider, model, created_at, updated_at
      FROM sessions
      ORDER BY updated_at DESC
      LIMIT 1
      `
    )
    .get() as SessionRow | undefined

  return row ? mapSession(row) : null
}

export function getLatestSessionUpdatedAt(storage: Pick<Storage, 'db'>): string | null {
  const row = storage.db
    .prepare('SELECT updated_at FROM sessions ORDER BY updated_at DESC LIMIT 1')
    .get() as { updated_at: string } | undefined
  return row?.updated_at ?? null
}

export function listSessionMessages(
  storage: Pick<Storage, 'db'>,
  sessionId: string
): SessionMessageRecord[] {
  const rows = storage.db
    .prepare(
      `
      SELECT id, session_id, role, content, created_at
      FROM session_messages
      WHERE session_id = ?
      ORDER BY created_at ASC
      `
    )
    .all(sessionId) as SessionMessageRow[]

  return rows.map(mapSessionMessage)
}

export function appendSessionMessage(
  storage: Pick<Storage, 'db'>,
  input: AppendMessageInput
): SessionMessageRecord {
  const now = new Date().toISOString()
  const id = randomUUID()

  storage.db
    .prepare(
      `
      INSERT INTO session_messages (id, session_id, role, content, created_at)
      VALUES (?, ?, ?, ?, ?)
      `
    )
    .run(id, input.sessionId, input.role, input.content, now)

  storage.db
    .prepare(
      `
      UPDATE sessions
      SET updated_at = ?, status = ?
      WHERE id = ?
      `
    )
    .run(now, 'active', input.sessionId)

  const row = storage.db
    .prepare(
      `
      SELECT id, session_id, role, content, created_at
      FROM session_messages
      WHERE id = ?
      `
    )
    .get(id) as SessionMessageRow

  return mapSessionMessage(row)
}
