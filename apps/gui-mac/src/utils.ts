export function shortId(value: string | null | undefined): string {
  if (!value) return '-'
  return value.slice(0, 8)
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '-'
  try {
    return new Date(value).toLocaleString('es-CL')
  } catch {
    return value
  }
}

export function truncate(value: string, max = 140): string {
  if (value.length <= max) return value
  return `${value.slice(0, max - 1)}…`
}

export function summarizeUnknown(payload: unknown, max = 160): string {
  if (typeof payload === 'undefined') return '-'
  const serialized =
    typeof payload === 'string' ? payload : JSON.stringify(payload, null, 0) ?? String(payload)
  return truncate(serialized, max)
}

export function asStringValue(value: unknown, fallback = '-'): string {
  if (typeof value === 'string' && value.trim().length > 0) return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return fallback
}
