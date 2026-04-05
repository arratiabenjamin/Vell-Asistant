import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Box, Text, render, useApp, useInput } from 'ink'
import { DaemonClient } from '@forge/control-plane'
import type {
  Approval,
  ApprovalListResponse,
  DaemonEvent,
  DaemonStatusResponse,
  Project,
  ProjectListResponse,
  Session,
  SessionDetailResponse,
  SessionListResponse,
  SettingsResponse,
  SystemActionName
} from '@forge/shared'

type ScreenId = 'home' | 'session' | 'projects' | 'approvals' | 'settings'

type ActivityLevel = 'info' | 'error' | 'event' | 'tool' | 'stream'

type ActivityEntry = {
  id: string
  timestamp: string
  level: ActivityLevel
  text: string
  sessionId?: string
}

type BootState = {
  connected: boolean
  status: DaemonStatusResponse | null
  sessions: SessionListResponse
  currentSessionId: string | null
  currentSession: SessionDetailResponse | null
  projects: ProjectListResponse
  approvals: ApprovalListResponse
  settings: SettingsResponse
}

const SCREEN_ORDER: Array<{ id: ScreenId; label: string }> = [
  { id: 'home', label: 'Home' },
  { id: 'session', label: 'Session' },
  { id: 'projects', label: 'Projects' },
  { id: 'approvals', label: 'Approvals' },
  { id: 'settings', label: 'Settings' }
]

const MAX_ACTIVITY = 300

function shortId(value: string | null | undefined): string {
  if (!value) return '-'
  return value.slice(0, 8)
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('es-CL', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  } catch {
    return iso
  }
}

function truncate(value: string, max = 120): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value
}

function splitCommandArgs(raw: string): string[] {
  const args: string[] = []
  const regex = /"([^"]*)"|'([^']*)'|(\S+)/g

  let match: RegExpExecArray | null
  while ((match = regex.exec(raw)) !== null) {
    args.push(match[1] ?? match[2] ?? match[3] ?? '')
  }

  return args
}

function resolveByPrefix<T extends { id: string }>(items: T[], prefix: string): T | null {
  const normalized = prefix.trim().toLowerCase()
  if (!normalized) return null

  const exact = items.find(item => item.id.toLowerCase() === normalized)
  if (exact) return exact

  const matches = items.filter(item => item.id.toLowerCase().startsWith(normalized))
  if (matches.length === 1) return matches[0]
  return null
}

function readSessionTitle(session: Session | null): string {
  if (!session) return '(sin sesión)'
  return session.title ?? '(sin título)'
}

function normalizeJsonValue(raw: string): unknown {
  return JSON.parse(raw)
}

function pushEntry(prev: ActivityEntry[], entry: ActivityEntry): ActivityEntry[] {
  const next = [...prev, entry]
  if (next.length <= MAX_ACTIVITY) return next
  return next.slice(next.length - MAX_ACTIVITY)
}

function App() {
  const { exit } = useApp()
  const client = useMemo(() => new DaemonClient(process.env.FORGE_DAEMON_URL ?? 'http://127.0.0.1:4545'), [])

  const [screen, setScreen] = useState<ScreenId>('session')
  const [connected, setConnected] = useState(false)
  const [status, setStatus] = useState<DaemonStatusResponse | null>(null)
  const [sessions, setSessions] = useState<SessionListResponse>([])
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [currentSession, setCurrentSession] = useState<SessionDetailResponse | null>(null)
  const [projects, setProjects] = useState<ProjectListResponse>([])
  const [approvals, setApprovals] = useState<ApprovalListResponse>([])
  const [settings, setSettings] = useState<SettingsResponse>({ items: [] })
  const [activity, setActivity] = useState<ActivityEntry[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const [streamingSessionId, setStreamingSessionId] = useState<string | null>(null)

  const statusRef = useRef(status)
  const sessionsRef = useRef(sessions)
  const approvalsRef = useRef(approvals)
  const currentSessionIdRef = useRef(currentSessionId)
  const lastEventIdRef = useRef(0)

  useEffect(() => {
    statusRef.current = status
  }, [status])
  useEffect(() => {
    sessionsRef.current = sessions
  }, [sessions])
  useEffect(() => {
    approvalsRef.current = approvals
  }, [approvals])
  useEffect(() => {
    currentSessionIdRef.current = currentSessionId
  }, [currentSessionId])

  const appendActivity = useCallback((level: ActivityLevel, text: string, sessionId?: string) => {
    const entry: ActivityEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
      level,
      text,
      ...(sessionId ? { sessionId } : {})
    }
    setActivity(prev => pushEntry(prev, entry))
  }, [])

  const setCurrentSessionSafe = useCallback(
    async (sessionId: string | null) => {
      setCurrentSessionId(sessionId)
      if (!sessionId) {
        setCurrentSession(null)
        return
      }

      try {
        const detail = await client.getSession(sessionId)
        setCurrentSession(detail)
      } catch (error) {
        setCurrentSession(null)
        appendActivity(
          'error',
          `No pude cargar sesión ${shortId(sessionId)}: ${error instanceof Error ? error.message : String(error)}`,
          sessionId
        )
      }
    },
    [appendActivity, client]
  )

  const loadStatus = useCallback(async () => {
    const nextStatus = await client.status()
    setStatus(nextStatus)
    setConnected(true)
  }, [client])

  const loadSnapshot = useCallback(async (): Promise<BootState> => {
    const [nextStatus, nextSessions, latest, nextProjects, nextApprovals, nextSettings] = await Promise.all([
      client.status(),
      client.listSessions(),
      client.getLatestSession(),
      client.listProjects(),
      client.listApprovals(),
      client.listSettings()
    ])

    const selectedId = latest.session?.id ?? nextSessions[0]?.id ?? null

    let detail: SessionDetailResponse | null = null
    if (selectedId) {
      try {
        detail = await client.getSession(selectedId)
      } catch {
        detail = null
      }
    }

    return {
      connected: true,
      status: nextStatus,
      sessions: nextSessions,
      currentSessionId: selectedId,
      currentSession: detail,
      projects: nextProjects,
      approvals: nextApprovals,
      settings: nextSettings
    }
  }, [client])

  const applySnapshot = useCallback((snapshot: BootState) => {
    setConnected(snapshot.connected)
    setStatus(snapshot.status)
    setSessions(snapshot.sessions)
    setCurrentSessionId(snapshot.currentSessionId)
    setCurrentSession(snapshot.currentSession)
    setProjects(snapshot.projects)
    setApprovals(snapshot.approvals)
    setSettings(snapshot.settings)
  }, [])

  const refreshSessionDetailIfNeeded = useCallback(async () => {
    const sessionId = currentSessionIdRef.current
    if (!sessionId) return

    try {
      const detail = await client.getSession(sessionId)
      setCurrentSession(detail)
    } catch {
      // no-op
    }
  }, [client])

  const handleDaemonEvent = useCallback(
    async (event: DaemonEvent) => {
      const short = event.sessionId ? ` (${shortId(event.sessionId)})` : ''
      appendActivity('event', `[${event.type}]${short}`, event.sessionId)

      if (event.type.startsWith('approval.')) {
        try {
          setApprovals(await client.listApprovals())
          setStatus(await client.status())
        } catch {
          // no-op
        }
      }

      if (event.type.startsWith('session.')) {
        try {
          setSessions(await client.listSessions())
          await refreshSessionDetailIfNeeded()
          setStatus(await client.status())
        } catch {
          // no-op
        }
      }

      if (event.type === 'settings.updated') {
        try {
          setSettings(await client.listSettings())
          setStatus(await client.status())
        } catch {
          // no-op
        }
      }
    },
    [appendActivity, client, refreshSessionDetailIfNeeded]
  )

  useEffect(() => {
    let cancelled = false
    let closeEvents = false

    const bootstrap = async () => {
      try {
        const snapshot = await loadSnapshot()
        if (cancelled) return
        applySnapshot(snapshot)

        appendActivity('info', `Conectado a daemon (${snapshot.status?.status ?? 'ok'})`)
      } catch (error) {
        if (cancelled) return
        setConnected(false)
        appendActivity('error', `No pude conectar daemon: ${error instanceof Error ? error.message : String(error)}`)
      }
    }

    const startEventLoop = async () => {
      while (!cancelled && !closeEvents) {
        try {
          for await (const event of client.streamEvents(lastEventIdRef.current || undefined)) {
            if (cancelled || closeEvents) break
            lastEventIdRef.current = event.id
            await handleDaemonEvent(event)
          }
        } catch (error) {
          if (cancelled || closeEvents) break
          appendActivity(
            'error',
            `Stream de eventos caído, reintentando: ${error instanceof Error ? error.message : String(error)}`
          )
          await new Promise(resolve => setTimeout(resolve, 900))
        }
      }
    }

    const interval = setInterval(() => {
      void loadStatus().catch(() => {
        setConnected(false)
      })
    }, 6000)

    void bootstrap()
    void startEventLoop()

    return () => {
      cancelled = true
      closeEvents = true
      clearInterval(interval)
    }
  }, [appendActivity, applySnapshot, client, handleDaemonEvent, loadSnapshot, loadStatus])

  const withBusy = useCallback(
    async <T,>(fn: () => Promise<T>): Promise<T | null> => {
      if (busy) return null
      setBusy(true)
      try {
        return await fn()
      } finally {
        setBusy(false)
      }
    },
    [busy]
  )

  const ensureSession = useCallback(async (): Promise<string | null> => {
    const existing = currentSessionIdRef.current
    if (existing) return existing

    const created = await client.createSession({ title: 'Sesión rápida', provider: 'mock' })
    setSessions(await client.listSessions())
    await setCurrentSessionSafe(created.id)
    appendActivity('info', `Sesión creada ${shortId(created.id)}`)
    return created.id
  }, [appendActivity, client, setCurrentSessionSafe])

  const handleSlashCommand = useCallback(
    async (line: string): Promise<void> => {
      const args = splitCommandArgs(line)
      const command = (args[0] ?? '').replace(/^\//, '').toLowerCase()
      const rest = args.slice(1)

      if (!command) return

      if (command === 'help') {
        appendActivity(
          'info',
          'Comandos: /new, /use <id>, /resume-latest, /project <path>, /approve <id>, /reject <id>, /set <key> <json>, /tool <...>, /action <name> <json>'
        )
        return
      }

      if (command === 'goto' && rest[0]) {
        const maybe = rest[0].toLowerCase() as ScreenId
        if (SCREEN_ORDER.some(item => item.id === maybe)) {
          setScreen(maybe)
          return
        }
      }

      if (command === 'new') {
        const title = rest.join(' ').trim() || 'Nueva sesión'
        const created = await client.createSession({ title, provider: 'mock' })
        setSessions(await client.listSessions())
        await setCurrentSessionSafe(created.id)
        setScreen('session')
        appendActivity('info', `Nueva sesión ${shortId(created.id)} · ${title}`)
        return
      }

      if (command === 'use' && rest[0]) {
        const session = resolveByPrefix(sessionsRef.current, rest[0])
        if (!session) {
          appendActivity('error', `No encontré sesión para prefijo ${rest[0]}`)
          return
        }

        await setCurrentSessionSafe(session.id)
        setScreen('session')
        appendActivity('info', `Sesión activa: ${shortId(session.id)}`)
        return
      }

      if (command === 'resume-latest') {
        const latest = await client.resumeLatestSession()
        if (!latest.session) {
          appendActivity('error', 'No hay sesiones para reanudar')
          return
        }

        setSessions(await client.listSessions())
        await setCurrentSessionSafe(latest.session.id)
        setScreen('session')
        appendActivity('info', `Reanudada ${shortId(latest.session.id)}`)
        return
      }

      if (command === 'project' && rest[0]) {
        const sessionId = await ensureSession()
        if (!sessionId) return

        const path = rest.join(' ')
        const context = await client.selectSessionProject(sessionId, { projectPath: path })
        await setCurrentSessionSafe(sessionId)
        setProjects(await client.listProjects())
        appendActivity('info', `Proyecto asociado: ${context.name ?? context.projectPath}`, sessionId)
        return
      }

      if (command === 'approve' && rest[0]) {
        const target = resolveByPrefix(approvalsRef.current, rest[0])
        if (!target) {
          appendActivity('error', `No encontré approval para prefijo ${rest[0]}`)
          return
        }

        const result = await client.approveApproval(target.id)
        setApprovals(await client.listApprovals())
        appendActivity('info', `Aprobado ${shortId(result.approval.id)} (${result.approval.name})`)
        return
      }

      if (command === 'reject' && rest[0]) {
        const target = resolveByPrefix(approvalsRef.current, rest[0])
        if (!target) {
          appendActivity('error', `No encontré approval para prefijo ${rest[0]}`)
          return
        }

        const result = await client.rejectApproval(target.id)
        setApprovals(await client.listApprovals())
        appendActivity('info', `Rechazado ${shortId(result.approval.id)} (${result.approval.name})`)
        return
      }

      if (command === 'set' && rest.length >= 2) {
        const key = rest[0]
        const raw = rest.slice(1).join(' ')
        const parsed = normalizeJsonValue(raw)
        const updated = await client.updateSetting(key, { value: parsed })
        setSettings(updated)
        appendActivity('info', `Setting actualizado: ${key}`)
        return
      }

      if (command === 'tool') {
        const sessionId = await ensureSession()
        if (!sessionId) return

        const toolName = (rest[0] ?? '').toLowerCase()

        if (toolName === 'list_dir') {
          const result = await client.runListDirTool(sessionId, { path: rest[1] ?? '.' })
          appendActivity('tool', `list_dir ${result.basePath} -> ${result.entries.length} entradas`, sessionId)
          return
        }

        if (toolName === 'read_file' && rest[1]) {
          const maxBytes = rest[2] ? Number.parseInt(rest[2], 10) : undefined
          const result = await client.runReadFileTool(sessionId, {
            path: rest[1],
            ...(Number.isFinite(maxBytes) ? { maxBytes } : {})
          })
          appendActivity('tool', `read_file ${result.path} (${result.content.length} chars)`, sessionId)
          return
        }

        if (toolName === 'search_text' && rest[1]) {
          const query = rest[1]
          const path = rest[2] ?? '.'
          const result = await client.runSearchTextTool(sessionId, { query, path, maxResults: 20 })
          appendActivity('tool', `search_text "${query}" -> ${result.hits.length} hits`, sessionId)
          return
        }

        if (toolName === 'write_file' && rest.length >= 3) {
          const path = rest[1]
          const content = rest.slice(2).join(' ')
          const result = await client.runWriteFileTool(sessionId, { path, content })
          appendActivity('tool', `write_file ${path} -> ${result.status}`, sessionId)
          setApprovals(await client.listApprovals())
          return
        }

        if (toolName === 'run' && rest.length >= 2) {
          const commandLine = rest.slice(1).join(' ')
          const result = await client.runCommandSafeTool(sessionId, { command: commandLine })
          appendActivity('tool', `run_command_safe "${commandLine}" -> ${result.status}`, sessionId)
          setApprovals(await client.listApprovals())
          return
        }

        appendActivity('error', 'Uso /tool: list_dir | read_file | search_text | write_file | run')
        return
      }

      if (command === 'action' && rest[0]) {
        const sessionId = await ensureSession()
        if (!sessionId) return

        const action = rest[0] as SystemActionName
        const payload = rest[1] ? (normalizeJsonValue(rest.slice(1).join(' ')) as Record<string, unknown>) : {}
        const result = await client.invokeSystemAction(sessionId, action, { payload })
        appendActivity('tool', `action ${action} -> ${result.status}`, sessionId)
        setApprovals(await client.listApprovals())
        return
      }

      appendActivity('error', `Comando desconocido: ${command}`)
    },
    [appendActivity, client, ensureSession, setCurrentSessionSafe]
  )

  const submitInput = useCallback(async () => {
    const line = input.trim()
    if (!line) return

    setInput('')

    await withBusy(async () => {
      if (line.startsWith('/')) {
        await handleSlashCommand(line)
        return
      }

      const sessionId = await ensureSession()
      if (!sessionId) return

      setScreen('session')
      setStreamingSessionId(sessionId)
      setStreamingText('')
      appendActivity('info', `Prompt enviado (${line.length} chars)`, sessionId)

      try {
        for await (const event of client.promptSessionStream(sessionId, { content: line })) {
          if (event.type === 'token') {
            setStreamingText(prev => prev + event.value)
          }

          if (event.type === 'error') {
            appendActivity('error', `Error streaming: ${event.message}`, sessionId)
          }

          if (event.type === 'done') {
            setStreamingText('')
            setStreamingSessionId(null)
            await setCurrentSessionSafe(sessionId)
            setSessions(await client.listSessions())
            appendActivity('stream', `Respuesta completada (${event.assistantMessage.content.length} chars)`, sessionId)
          }
        }
      } catch (error) {
        setStreamingText('')
        setStreamingSessionId(null)
        appendActivity('error', `Falló prompt: ${error instanceof Error ? error.message : String(error)}`, sessionId)
      }
    })
  }, [appendActivity, client, ensureSession, handleSlashCommand, input, setCurrentSessionSafe, withBusy])

  useInput((keyInput, key) => {
    if (key.ctrl && keyInput.toLowerCase() === 'c') {
      exit()
      return
    }

    if (key.tab) {
      setScreen(prev => {
        const index = SCREEN_ORDER.findIndex(item => item.id === prev)
        const next = (index + 1) % SCREEN_ORDER.length
        return SCREEN_ORDER[next].id
      })
      return
    }

    if (key.escape) {
      setInput('')
      return
    }

    if (key.return) {
      void submitInput()
      return
    }

    if ((key.backspace || key.delete) && input.length > 0) {
      setInput(prev => prev.slice(0, -1))
      return
    }

    if (/^[1-5]$/.test(keyInput) && input.length === 0) {
      const idx = Number.parseInt(keyInput, 10) - 1
      setScreen(SCREEN_ORDER[idx].id)
      return
    }

    if (keyInput) {
      setInput(prev => prev + keyInput)
    }
  })

  const pendingApprovals = approvals.filter(item => item.status === 'pending')
  const currentSessionRecord = currentSession?.session ?? sessions.find(item => item.id === currentSessionId) ?? null
  const currentProjectLabel = currentSessionRecord?.projectPath ?? '(sin proyecto)'
  const currentModelLabel = `${currentSessionRecord?.provider ?? status?.defaultProvider ?? 'mock'} / ${
    currentSessionRecord?.model ?? 'default'
  }`

  const recentMessages = currentSession?.messages.slice(-14) ?? []
  const recentActivity = activity.slice(-10)

  const renderMainPane = () => {
    if (screen === 'home') {
      return (
        <Box flexDirection="column" paddingX={1}>
          <Text color="cyan">Sesiones ({sessions.length})</Text>
          {sessions.length === 0 ? (
            <Text dimColor>No hay sesiones. Usá /new para crear una.</Text>
          ) : (
            sessions.slice(0, 20).map(session => (
              <Text key={session.id} color={session.id === currentSessionId ? 'green' : undefined}>
                {session.id === currentSessionId ? '▶' : '•'} {shortId(session.id)} · {readSessionTitle(session)} · {session.status}
              </Text>
            ))
          )}
        </Box>
      )
    }

    if (screen === 'projects') {
      return (
        <Box flexDirection="column" paddingX={1}>
          <Text color="cyan">Proyectos recientes ({projects.length})</Text>
          {projects.length === 0 ? (
            <Text dimColor>No hay proyectos todavía. Usá /project &lt;path&gt;.</Text>
          ) : (
            projects.slice(0, 20).map((project: Project) => (
              <Text key={project.id}>• {project.name} · {project.path}</Text>
            ))
          )}
        </Box>
      )
    }

    if (screen === 'approvals') {
      return (
        <Box flexDirection="column" paddingX={1}>
          <Text color="cyan">Approvals ({approvals.length})</Text>
          <Text dimColor>Atajos: /approve &lt;id&gt; · /reject &lt;id&gt;</Text>
          {approvals.length === 0 ? (
            <Text dimColor>No hay approvals.</Text>
          ) : (
            approvals.slice(0, 20).map((approval: Approval) => (
              <Text key={approval.id} color={approval.status === 'pending' ? 'yellow' : undefined}>
                • {shortId(approval.id)} · {approval.status} · {approval.name} · s:{shortId(approval.sessionId)}
              </Text>
            ))
          )}
        </Box>
      )
    }

    if (screen === 'settings') {
      return (
        <Box flexDirection="column" paddingX={1}>
          <Text color="cyan">Settings ({settings.items.length})</Text>
          <Text dimColor>Actualizá con: /set key valorJson</Text>
          {settings.items.map(item => (
            <Text key={item.key}>• {item.key} = {JSON.stringify(item.value)}</Text>
          ))}
        </Box>
      )
    }

    return (
      <Box flexDirection="column" paddingX={1}>
        <Text color="cyan">
          Session {currentSessionRecord ? `${shortId(currentSessionRecord.id)} · ${readSessionTitle(currentSessionRecord)}` : '(sin sesión)'}
        </Text>
        <Box flexDirection="column" borderStyle="single" paddingX={1} marginTop={1}>
          <Text color="yellow">Mensajes</Text>
          {recentMessages.length === 0 ? (
            <Text dimColor>Sin mensajes. Escribí un prompt abajo.</Text>
          ) : (
            recentMessages.map(message => (
              <Text key={message.id}>
                [{message.role}] {truncate(message.content, 130)}
              </Text>
            ))
          )}
          {streamingText ? (
            <Text color="magenta">
              [assistant-stream {shortId(streamingSessionId)}] {truncate(streamingText, 160)}
            </Text>
          ) : null}
        </Box>
        <Box flexDirection="column" borderStyle="single" paddingX={1} marginTop={1}>
          <Text color="yellow">Actividad</Text>
          {recentActivity.length === 0 ? (
            <Text dimColor>Sin actividad.</Text>
          ) : (
            recentActivity.map(item => (
              <Text key={item.id} color={item.level === 'error' ? 'red' : undefined}>
                {formatTime(item.timestamp)} · {item.level.toUpperCase()} · {truncate(item.text, 135)}
              </Text>
            ))
          )}
        </Box>
      </Box>
    )
  }

  return (
    <Box flexDirection="column">
      <Box borderStyle="round" paddingX={1} flexDirection="column">
        <Text>
          Forge TUI · {connected ? 'online' : 'offline'} · daemon {status?.status ?? 'down'} · mode {status?.currentMode ?? '-'} · busy {busy ? 'yes' : 'no'}
        </Text>
        <Text dimColor>
          session {shortId(currentSessionRecord?.id)} · model {currentModelLabel} · project {truncate(currentProjectLabel, 80)} · pending approvals {pendingApprovals.length}
        </Text>
      </Box>

      <Box marginTop={1}>
        <Box width={28} flexDirection="column" borderStyle="round" paddingX={1}>
          <Text color="cyan">Views</Text>
          {SCREEN_ORDER.map((item, index) => (
            <Text key={item.id} color={screen === item.id ? 'green' : undefined}>
              {screen === item.id ? '▶' : ' '} {index + 1}. {item.label}
            </Text>
          ))}
          <Text dimColor>Tab: cambiar vista</Text>
          <Text dimColor>Ctrl+C: salir</Text>
        </Box>

        <Box flexGrow={1} marginLeft={1} borderStyle="round" minHeight={24}>
          {renderMainPane()}
        </Box>
      </Box>

      <Box marginTop={1} borderStyle="round" flexDirection="column" paddingX={1}>
        <Text>
          {busy ? '[working]' : '[ready]'} {'>'} {input || ' '}
        </Text>
        <Text dimColor>
          Slash: /help · /new · /use · /resume-latest · /project · /approve · /reject · /set · /tool · /action
        </Text>
      </Box>
    </Box>
  )
}

render(<App />)
