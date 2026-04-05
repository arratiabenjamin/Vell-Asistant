import { randomUUID } from 'node:crypto'
import type { ApprovalStatus } from '@forge/shared'
import type { Storage } from './types.js'

type ApprovalRow = {
  id: string
  session_id: string
  kind: string
  name: string
  payload_json: string
  status: ApprovalStatus
  created_at: string
  resolved_at: string | null
}

export type ApprovalRecord = {
  id: string
  sessionId: string
  kind: string
  name: string
  payload: unknown
  status: ApprovalStatus
  createdAt: string
  resolvedAt: string | null
}

function mapApproval(row: ApprovalRow): ApprovalRecord {
  let payload: unknown = null
  try {
    payload = JSON.parse(row.payload_json)
  } catch {
    payload = null
  }

  return {
    id: row.id,
    sessionId: row.session_id,
    kind: row.kind,
    name: row.name,
    payload,
    status: row.status,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at
  }
}

export function createApproval(
  storage: Pick<Storage, 'db'>,
  input: {
    sessionId: string
    kind: string
    name: string
    payload: unknown
  }
): ApprovalRecord {
  const id = randomUUID()
  const createdAt = new Date().toISOString()

  storage.db
    .prepare(
      `
      INSERT INTO approvals (id, session_id, kind, name, payload_json, status, created_at, resolved_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `
    )
    .run(
      id,
      input.sessionId,
      input.kind,
      input.name,
      JSON.stringify(input.payload),
      'pending',
      createdAt,
      null
    )

  return getApprovalById(storage, id)!
}

export function getApprovalById(storage: Pick<Storage, 'db'>, approvalId: string): ApprovalRecord | null {
  const row = storage.db
    .prepare(
      `
      SELECT id, session_id, kind, name, payload_json, status, created_at, resolved_at
      FROM approvals
      WHERE id = ?
      `
    )
    .get(approvalId) as ApprovalRow | undefined

  return row ? mapApproval(row) : null
}

export function listApprovals(
  storage: Pick<Storage, 'db'>,
  status?: ApprovalStatus
): ApprovalRecord[] {
  const rows = status
    ? (storage.db
        .prepare(
          `
          SELECT id, session_id, kind, name, payload_json, status, created_at, resolved_at
          FROM approvals
          WHERE status = ?
          ORDER BY created_at DESC
          `
        )
        .all(status) as ApprovalRow[])
    : (storage.db
        .prepare(
          `
          SELECT id, session_id, kind, name, payload_json, status, created_at, resolved_at
          FROM approvals
          ORDER BY created_at DESC
          `
        )
        .all() as ApprovalRow[])

  return rows.map(mapApproval)
}

export function resolveApproval(
  storage: Pick<Storage, 'db'>,
  approvalId: string,
  status: Extract<ApprovalStatus, 'approved' | 'rejected'>
): ApprovalRecord | null {
  const now = new Date().toISOString()

  const result = storage.db
    .prepare(
      `
      UPDATE approvals
      SET status = ?, resolved_at = ?
      WHERE id = ? AND status = 'pending'
      `
    )
    .run(status, now, approvalId)

  if (result.changes === 0) {
    return getApprovalById(storage, approvalId)
  }

  return getApprovalById(storage, approvalId)
}

export function countApprovals(storage: Pick<Storage, 'db'>, status?: ApprovalStatus): number {
  const row = status
    ? (storage.db
        .prepare('SELECT COUNT(*) AS total FROM approvals WHERE status = ?')
        .get(status) as { total: number })
    : (storage.db.prepare('SELECT COUNT(*) AS total FROM approvals').get() as { total: number })

  return row.total
}
