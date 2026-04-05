import type { DatabaseSync } from 'node:sqlite'
import type { Project, Session, SessionMessage } from '@forge/shared'

export type Storage = {
  db: DatabaseSync
  dbPath: string
  appliedMigrations: string[]
  initializedAt: string
}

export type StorageHealth = {
  ready: boolean
  path: string
  migrationsApplied: number
}

export type SessionRecord = Session
export type SessionMessageRecord = SessionMessage
export type ProjectRecord = Project

export type CreateSessionInput = {
  type?: string
  projectPath?: string
  title?: string
  provider?: string
  model?: string
}

export type AppendMessageInput = {
  sessionId: string
  role: string
  content: string
}
