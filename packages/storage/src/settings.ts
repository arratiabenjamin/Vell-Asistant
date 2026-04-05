import type { Storage } from './types.js'

export function setSetting(storage: Pick<Storage, 'db'>, key: string, valueJson: string): void {
  storage.db
    .prepare(
      `
      INSERT INTO settings (key, value_json)
      VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json
      `
    )
    .run(key, valueJson)
}

export function getSetting(storage: Pick<Storage, 'db'>, key: string): string | null {
  const row = storage.db
    .prepare(
      `
      SELECT value_json
      FROM settings
      WHERE key = ?
      `
    )
    .get(key) as { value_json: string } | undefined

  return row?.value_json ?? null
}

export function setJsonSetting(storage: Pick<Storage, 'db'>, key: string, value: unknown): void {
  setSetting(storage, key, JSON.stringify(value))
}

export function getJsonSetting<T>(
  storage: Pick<Storage, 'db'>,
  key: string,
  fallback: T
): T {
  const raw = getSetting(storage, key)
  if (!raw) return fallback

  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function listSettings(
  storage: Pick<Storage, 'db'>,
  options: {
    includeKeys?: readonly string[]
  } = {}
): Array<{ key: string; value: unknown }> {
  if (options.includeKeys && options.includeKeys.length > 0) {
    return options.includeKeys.map(key => ({
      key,
      value: getJsonSetting<unknown>(storage, key, null)
    }))
  }

  const rows = storage.db
    .prepare(
      `
      SELECT key, value_json
      FROM settings
      ORDER BY key ASC
      `
    )
    .all() as Array<{ key: string; value_json: string }>

  return rows.map(row => {
    let parsed: unknown = null
    try {
      parsed = JSON.parse(row.value_json)
    } catch {
      parsed = row.value_json
    }

    return {
      key: row.key,
      value: parsed
    }
  })
}
