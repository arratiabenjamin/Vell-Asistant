import { DaemonClient } from '@forge/control-plane'

export const DEFAULT_DAEMON_URL = 'http://127.0.0.1:4545'

export const resolveDaemonUrl = (): string => {
  const candidate = import.meta.env.VITE_FORGE_DAEMON_URL
  if (typeof candidate === 'string' && candidate.trim().length > 0) {
    return candidate.trim()
  }
  return DEFAULT_DAEMON_URL
}

export const resolveDaemonToken = (): string | undefined => {
  const candidate = import.meta.env.VITE_FORGE_DAEMON_TOKEN
  if (typeof candidate === 'string' && candidate.trim().length > 0) {
    return candidate.trim()
  }
  return undefined
}

export const daemonUrl = resolveDaemonUrl()
export const daemonToken = resolveDaemonToken()
export const daemonClient = new DaemonClient(daemonUrl, {
  ...(daemonToken ? { token: daemonToken } : {})
})
