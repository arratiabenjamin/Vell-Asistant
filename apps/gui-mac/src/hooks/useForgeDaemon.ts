import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  Approval,
  DaemonEvent,
  DaemonStatusResponse,
  Project,
  Session,
  SessionDetailResponse,
  SettingEntry,
  SettingsResponse
} from '@forge/shared'
import { daemonClient, daemonUrl } from '../client/daemonClient'

export type SessionUiState = 'idle' | 'thinking' | 'waiting_approval' | 'error'

const MAX_EVENTS = 200

function pushEvent(previous: DaemonEvent[], next: DaemonEvent): DaemonEvent[] {
  const merged = [...previous, next]
  if (merged.length <= MAX_EVENTS) return merged
  return merged.slice(merged.length - MAX_EVENTS)
}

function pathBasename(projectPath: string): string {
  const chunks = projectPath.split('/').filter(Boolean)
  return chunks[chunks.length - 1] ?? projectPath
}

export function useForgeDaemon() {
  const [connected, setConnected] = useState(false)
  const [status, setStatus] = useState<DaemonStatusResponse | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [currentSession, setCurrentSession] = useState<SessionDetailResponse | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [approvals, setApprovals] = useState<Approval[]>([])
  const [settings, setSettings] = useState<SettingsResponse>({ items: [] })
  const [events, setEvents] = useState<DaemonEvent[]>([])
  const [streamingText, setStreamingText] = useState('')
  const [sessionState, setSessionState] = useState<SessionUiState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const lastEventIdRef = useRef(0)
  const currentSessionIdRef = useRef<string | null>(null)

  useEffect(() => {
    currentSessionIdRef.current = currentSessionId
  }, [currentSessionId])

  const clearError = useCallback(() => {
    setError(null)
    setSessionState(previous => (previous === 'error' ? 'idle' : previous))
  }, [])

  const loadCurrentSession = useCallback(async (sessionId: string | null): Promise<void> => {
    setCurrentSessionId(sessionId)
    if (!sessionId) {
      setCurrentSession(null)
      return
    }

    try {
      const detail = await daemonClient.getSession(sessionId)
      setCurrentSession(detail)
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : String(loadError)
      setCurrentSession(null)
      setError(`No pude cargar sesión ${sessionId.slice(0, 8)}: ${message}`)
    }
  }, [])

  const refreshSnapshot = useCallback(async () => {
    try {
      const [nextStatus, latest, nextSessions, nextProjects, nextApprovals, nextSettings] = await Promise.all([
        daemonClient.status(),
        daemonClient.getLatestSession(),
        daemonClient.listSessions(),
        daemonClient.listProjects(),
        daemonClient.listApprovals(),
        daemonClient.listSettings()
      ])

      setConnected(true)
      setStatus(nextStatus)
      setSessions(nextSessions)
      setProjects(nextProjects)
      setApprovals(nextApprovals)
      setSettings(nextSettings)

      const selectedId = currentSessionIdRef.current ?? latest.session?.id ?? nextSessions[0]?.id ?? null
      await loadCurrentSession(selectedId)
    } catch (refreshError) {
      const message = refreshError instanceof Error ? refreshError.message : String(refreshError)
      setConnected(false)
      setError(`No pude conectar al daemon (${daemonUrl}): ${message}`)
    }
  }, [loadCurrentSession])

  const refreshStatusOnly = useCallback(async () => {
    try {
      const nextStatus = await daemonClient.status()
      setStatus(nextStatus)
      setConnected(true)
    } catch {
      setConnected(false)
    }
  }, [])

  const refreshApprovals = useCallback(async () => {
    setApprovals(await daemonClient.listApprovals())
  }, [])

  const refreshSessions = useCallback(async () => {
    setSessions(await daemonClient.listSessions())
  }, [])

  const refreshProjects = useCallback(async () => {
    setProjects(await daemonClient.listProjects())
  }, [])

  const refreshSettings = useCallback(async () => {
    setSettings(await daemonClient.listSettings())
  }, [])

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      await refreshSnapshot()

      while (!cancelled) {
        try {
          for await (const event of daemonClient.streamEvents(lastEventIdRef.current || undefined)) {
            if (cancelled) break

            lastEventIdRef.current = event.id
            setEvents(previous => pushEvent(previous, event))

            if (event.type.startsWith('approval.')) {
              void refreshApprovals()
              void refreshStatusOnly()
            }

            if (event.type.startsWith('session.')) {
              const activeSessionId = currentSessionIdRef.current
              if (event.sessionId && activeSessionId && event.sessionId === activeSessionId) {
                void loadCurrentSession(activeSessionId)
              }
              void refreshSessions()
              void refreshProjects()
              void refreshStatusOnly()
            }

            if (event.type.startsWith('settings.')) {
              void refreshSettings()
              void refreshStatusOnly()
            }

            if (event.type.startsWith('daemon.')) {
              void refreshStatusOnly()
            }
          }
        } catch {
          if (cancelled) break
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
      }
    }

    void run()

    const poll = setInterval(() => {
      void refreshStatusOnly()
    }, 6000)

    return () => {
      cancelled = true
      clearInterval(poll)
    }
  }, [
    loadCurrentSession,
    refreshApprovals,
    refreshProjects,
    refreshSessions,
    refreshSettings,
    refreshSnapshot,
    refreshStatusOnly
  ])

  const pendingApprovals = useMemo(() => approvals.filter(item => item.status === 'pending'), [approvals])

  const currentSessionRecord = currentSession?.session ?? null

  const pendingForCurrentSession = useMemo(() => {
    if (!currentSessionRecord?.id) return 0
    return pendingApprovals.filter(item => item.sessionId === currentSessionRecord.id).length
  }, [currentSessionRecord?.id, pendingApprovals])

  const setCurrentSessionById = useCallback(
    async (sessionId: string) => {
      await loadCurrentSession(sessionId)
      setSessionState('idle')
      setError(null)
    },
    [loadCurrentSession]
  )

  const ensureCurrentSession = useCallback(async (): Promise<Session> => {
    if (currentSessionRecord) return currentSessionRecord

    const created = await daemonClient.createSession({
      title: 'GUI Session',
      provider: status?.defaultProvider ?? 'mock'
    })

    await refreshSessions()
    await loadCurrentSession(created.id)
    await refreshStatusOnly()
    return created
  }, [currentSessionRecord, loadCurrentSession, refreshSessions, refreshStatusOnly, status?.defaultProvider])

  const submitPrompt = useCallback(
    async (content: string) => {
      const trimmed = content.trim()
      if (!trimmed) return

      setBusy(true)
      setError(null)
      setSessionState('thinking')
      setStreamingText('')

      try {
        const session = await ensureCurrentSession()
        let streamError: string | null = null

        for await (const event of daemonClient.promptSessionStream(session.id, { content: trimmed })) {
          if (event.type === 'token') {
            setStreamingText(previous => previous + event.value)
          }

          if (event.type === 'error') {
            streamError = event.message
          }

          if (event.type === 'done') {
            setStreamingText('')
            await loadCurrentSession(session.id)
            await refreshSessions()
            await refreshStatusOnly()
          }
        }

        if (streamError) {
          setError(`El engine devolvió error: ${streamError}`)
          setSessionState('error')
        }
      } catch (submitError) {
        const message = submitError instanceof Error ? submitError.message : String(submitError)
        setError(`No pude enviar prompt: ${message}`)
        setSessionState('error')
        setBusy(false)
        return
      }

      await refreshApprovals()
      setBusy(false)
      setSessionState(pendingForCurrentSession > 0 ? 'waiting_approval' : 'idle')
    },
    [
      ensureCurrentSession,
      loadCurrentSession,
      pendingForCurrentSession,
      refreshApprovals,
      refreshSessions,
      refreshStatusOnly
    ]
  )

  const resumeLatestSession = useCallback(async () => {
    setBusy(true)
    setError(null)

    try {
      const latest = await daemonClient.resumeLatestSession()
      if (!latest.session) {
        setBusy(false)
        return
      }

      await loadCurrentSession(latest.session.id)
      await refreshSessions()
      await refreshStatusOnly()
    } catch (resumeError) {
      const message = resumeError instanceof Error ? resumeError.message : String(resumeError)
      setError(`No pude reanudar la sesión más reciente: ${message}`)
    }

    setBusy(false)
  }, [loadCurrentSession, refreshSessions, refreshStatusOnly])

  const createSession = useCallback(
    async (title?: string) => {
      setBusy(true)
      setError(null)

      try {
        const created = await daemonClient.createSession({
          title: title?.trim() || 'GUI Session',
          provider: status?.defaultProvider ?? 'mock'
        })
        await refreshSessions()
        await loadCurrentSession(created.id)
        await refreshStatusOnly()
      } catch (createError) {
        const message = createError instanceof Error ? createError.message : String(createError)
        setError(`No pude crear sesión: ${message}`)
      }

      setBusy(false)
    },
    [loadCurrentSession, refreshSessions, refreshStatusOnly, status?.defaultProvider]
  )

  const approve = useCallback(
    async (approvalId: string) => {
      setBusy(true)
      setError(null)

      try {
        await daemonClient.approveApproval(approvalId)
        await refreshApprovals()
        await refreshStatusOnly()
        if (currentSessionIdRef.current) {
          await loadCurrentSession(currentSessionIdRef.current)
        }
      } catch (approvalError) {
        const message = approvalError instanceof Error ? approvalError.message : String(approvalError)
        setError(`No pude aprobar ${approvalId.slice(0, 8)}: ${message}`)
      }

      setBusy(false)
    },
    [loadCurrentSession, refreshApprovals, refreshStatusOnly]
  )

  const reject = useCallback(
    async (approvalId: string) => {
      setBusy(true)
      setError(null)

      try {
        await daemonClient.rejectApproval(approvalId)
        await refreshApprovals()
        await refreshStatusOnly()
      } catch (approvalError) {
        const message = approvalError instanceof Error ? approvalError.message : String(approvalError)
        setError(`No pude rechazar ${approvalId.slice(0, 8)}: ${message}`)
      }

      setBusy(false)
    },
    [refreshApprovals, refreshStatusOnly]
  )

  const openProject = useCallback(
    async (projectPath: string, mode: 'current' | 'new' = 'current') => {
      setBusy(true)
      setError(null)

      try {
        let session = currentSessionRecord

        if (!session || mode === 'new') {
          session = await daemonClient.createSession({
            title: `Project ${pathBasename(projectPath)}`,
            provider: status?.defaultProvider ?? 'mock'
          })
        }

        await daemonClient.selectSessionProject(session.id, { projectPath })
        await loadCurrentSession(session.id)
        await refreshSessions()
        await refreshProjects()
        await refreshStatusOnly()
      } catch (projectError) {
        const message = projectError instanceof Error ? projectError.message : String(projectError)
        setError(`No pude abrir proyecto ${projectPath}: ${message}`)
      }

      setBusy(false)
    },
    [
      currentSessionRecord,
      loadCurrentSession,
      refreshProjects,
      refreshSessions,
      refreshStatusOnly,
      status?.defaultProvider
    ]
  )

  const updateSetting = useCallback(
    async (key: string, value: unknown) => {
      setBusy(true)
      setError(null)

      try {
        const updated = await daemonClient.updateSetting(key, { value })
        setSettings(updated)
        await refreshStatusOnly()
      } catch (settingError) {
        const message = settingError instanceof Error ? settingError.message : String(settingError)
        setError(`No pude actualizar setting ${key}: ${message}`)
      }

      setBusy(false)
    },
    [refreshStatusOnly]
  )

  const settingMap = useMemo(() => {
    return settings.items.reduce<Record<string, unknown>>((accumulator, entry: SettingEntry) => {
      accumulator[entry.key] = entry.value
      return accumulator
    }, {})
  }, [settings.items])

  useEffect(() => {
    if (sessionState === 'error') return
    if (pendingForCurrentSession > 0) {
      setSessionState('waiting_approval')
      return
    }
    if (!busy) {
      setSessionState('idle')
    }
  }, [busy, pendingForCurrentSession, sessionState])

  return {
    daemonUrl,
    connected,
    status,
    sessions,
    currentSession,
    currentSessionRecord,
    currentSessionId,
    projects,
    approvals,
    pendingApprovals,
    pendingForCurrentSession,
    settings,
    settingMap,
    events,
    streamingText,
    sessionState,
    error,
    busy,
    clearError,
    refreshSnapshot,
    setCurrentSessionById,
    resumeLatestSession,
    createSession,
    submitPrompt,
    approve,
    reject,
    openProject,
    updateSetting
  }
}
