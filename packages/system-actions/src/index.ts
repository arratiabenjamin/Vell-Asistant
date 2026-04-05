import { spawn } from 'node:child_process'
import type { PolicyDecision, SystemActionName } from '@forge/shared'

export type SystemActionDefinition = {
  name: SystemActionName
  description: string
  defaultPolicy: PolicyDecision
}

export const SYSTEM_ACTIONS: readonly SystemActionDefinition[] = [
  { name: 'open_url', description: 'Open URL in browser', defaultPolicy: 'ALLOW' },
  { name: 'open_browser', description: 'Open default browser', defaultPolicy: 'ALLOW' },
  { name: 'youtube_search', description: 'Search on YouTube', defaultPolicy: 'ALLOW' },
  { name: 'open_vscode', description: 'Open VSCode on path', defaultPolicy: 'CONFIRM' },
  { name: 'show_notification', description: 'Show local notification', defaultPolicy: 'ALLOW' }
]

export type SystemActionExecution = {
  action: SystemActionName
  ok: boolean
  message: string
  metadata?: Record<string, unknown>
}

function runCommand(command: string, args: string[], detached = true): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      detached,
      stdio: 'ignore'
    })

    child.once('error', reject)

    if (detached) {
      child.unref()
      resolve()
      return
    }

    child.once('close', code => {
      if (code === 0) {
        resolve()
        return
      }
      reject(new Error(`Command exited with code ${code ?? -1}: ${command}`))
    })
  })
}

function buildYoutubeUrl(query: string): string {
  const trimmed = query.trim()
  if (!trimmed) {
    throw new Error('youtube_search requires non-empty query')
  }
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(trimmed)}`
}

function normalizeUrl(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) throw new Error('URL is required')

  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  const parsed = new URL(candidate)
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error(`Unsupported URL protocol: ${parsed.protocol}`)
  }

  return parsed.toString()
}

async function openExternal(url: string): Promise<void> {
  if (process.platform === 'darwin') {
    await runCommand('open', [url])
    return
  }

  if (process.platform === 'linux') {
    await runCommand('xdg-open', [url])
    return
  }

  throw new Error(`Platform not supported for opening URLs: ${process.platform}`)
}

async function showLocalNotification(title: string, body: string): Promise<void> {
  if (process.platform === 'darwin') {
    const escapedTitle = title.replace(/"/g, '\\"')
    const escapedBody = body.replace(/"/g, '\\"')
    const script = `display notification "${escapedBody}" with title "${escapedTitle}"`
    await runCommand('osascript', ['-e', script], false)
    return
  }

  if (process.platform === 'linux') {
    await runCommand('notify-send', [title, body], false)
    return
  }

  throw new Error(`Platform not supported for notifications: ${process.platform}`)
}

export async function executeSystemAction(
  action: SystemActionName,
  payload: Record<string, unknown>
): Promise<SystemActionExecution> {
  try {
    if (action === 'open_url') {
      const url = normalizeUrl(String(payload.url ?? ''))
      await openExternal(url)
      return {
        action,
        ok: true,
        message: `Opened URL: ${url}`,
        metadata: { url }
      }
    }

    if (action === 'open_browser') {
      const url = payload.url ? normalizeUrl(String(payload.url)) : 'https://www.google.com'
      await openExternal(url)
      return {
        action,
        ok: true,
        message: `Browser opened at ${url}`,
        metadata: { url }
      }
    }

    if (action === 'youtube_search') {
      const query = String(payload.query ?? '')
      const url = buildYoutubeUrl(query)
      await openExternal(url)
      return {
        action,
        ok: true,
        message: `YouTube search opened for query: ${query}`,
        metadata: { query, url }
      }
    }

    if (action === 'open_vscode') {
      const targetPath = String(payload.path ?? '').trim()
      if (!targetPath) {
        throw new Error('open_vscode requires payload.path')
      }

      await runCommand('code', [targetPath])
      return {
        action,
        ok: true,
        message: `VSCode opened at ${targetPath}`,
        metadata: { path: targetPath }
      }
    }

    if (action === 'show_notification') {
      const title = String(payload.title ?? 'Forge')
      const body = String(payload.body ?? 'Action completed')
      await showLocalNotification(title, body)
      return {
        action,
        ok: true,
        message: 'Notification displayed',
        metadata: { title, body }
      }
    }

    throw new Error(`Unsupported system action: ${action}`)
  } catch (error) {
    return {
      action,
      ok: false,
      message: error instanceof Error ? error.message : String(error)
    }
  }
}
