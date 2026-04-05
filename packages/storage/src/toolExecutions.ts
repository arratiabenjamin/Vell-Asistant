import { randomUUID } from 'node:crypto'
import type { Storage } from './types.js'

export function recordToolExecution(
  storage: Pick<Storage, 'db'>,
  params: {
    sessionId: string
    toolName: string
    input: unknown
    output: unknown
    status: 'success' | 'error'
  }
): void {
  storage.db
    .prepare(
      `
      INSERT INTO tool_executions (id, session_id, tool_name, input_json, output_json, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      `
    )
    .run(
      randomUUID(),
      params.sessionId,
      params.toolName,
      JSON.stringify(params.input),
      JSON.stringify(params.output),
      params.status,
      new Date().toISOString()
    )
}
