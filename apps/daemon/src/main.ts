import { getLogger } from '@forge/observability'
import { evaluateCapability } from '@forge/policy'
import {
  executeSystemAction,
  SYSTEM_ACTIONS,
  type SystemActionDefinition
} from '@forge/system-actions'
import {
  ProviderEngineRuntime,
  buildProjectContext,
  assertWritePathAllowed,
  createCodexCliProvider,
  createMockProvider,
  createOpenAICompatibleProvider,
  verifyOpenAICompatibleApiKey,
  isSafeCommandAllowed,
  listDirTool,
  runCommandSafeTool,
  readFileTool,
  searchTextTool,
  writeFileTool,
  type EngineProviderMessage
} from '@forge/engine'
import {
  appendSessionMessage,
  countActiveSessions,
  countApprovals,
  countProjects,
  countSessions,
  createApproval,
  closeStorage,
  createSession,
  getLatestSession,
  getLatestSessionUpdatedAt,
  getApprovalById,
  getSessionById,
  getSetting,
  getStorageHealth,
  initializeStorage,
  listProjects,
  listSettings,
  listApprovals,
  listSessionMessages,
  listSessions,
  recordToolExecution,
  resolveApproval,
  resumeSession,
  setSessionProjectPath,
  setSetting,
  upsertProject
} from '@forge/storage'
import {
  SystemActionInvokeRequestSchema,
  SystemActionNameSchema,
  type SystemActionInvokeRequest,
  type SystemActionName,
  PermissionModeSchema,
  OpenAIAuthModeSchema,
  RunCommandSafeToolRequestSchema,
  SettingsResponseSchema,
  UpdateSettingRequestSchema,
  WriteFileToolRequestSchema,
  type HealthResponse,
  type LatestSessionResponse,
  type OpenAIAuthMode,
  type DaemonEvent,
  type PermissionMode,
  type PromptSessionRequest,
  type PromptStreamEvent,
  type RunCommandSafeToolRequest,
  type RunCommandSafeToolResponse,
  type SettingsResponse,
  type SessionMessage
} from '@forge/shared'
import { execFile } from 'node:child_process'
import { stat } from 'node:fs/promises'
import { resolve } from 'node:path'
import { promisify } from 'node:util'
import { loadConfig } from './config.js'
import { createServer } from './server.js'

const execFileAsync = promisify(execFile)

const OPENAI_AUTH_MODE_KEY = 'openai.auth.mode'
const OPENAI_API_KEY_KEY = 'openai.api_key'
const POLICY_MODE_KEY = 'policy.mode'
const DEFAULT_PROVIDER_KEY = 'default.provider'
const TUI_THEME_KEY = 'tui.theme'
const LAST_ACTIVE_SESSION_KEY = 'session.last_active_id'
const MAX_EVENT_HISTORY = 300
const ALLOWED_DEFAULT_PROVIDERS = new Set([
  'mock',
  'codex',
  'openai',
  'openai-compatible',
  'openai-chatgpt'
])

const PUBLIC_SETTINGS_KEYS = [POLICY_MODE_KEY, DEFAULT_PROVIDER_KEY, TUI_THEME_KEY] as const

async function main(): Promise<void> {
  const logger = getLogger('daemon')
  const config = loadConfig()
  const startedAt = Date.now()

  const storage = initializeStorage({
    logger: getLogger('storage'),
    ...(config.dbPath ? { dbPath: config.dbPath } : {})
  })

  let eventId = 0
  const recentEvents: DaemonEvent[] = []
  const eventSubscribers = new Set<(event: DaemonEvent) => void>()

  const publishEvent = (
    type: string,
    params: {
      sessionId?: string
      payload?: unknown
    } = {}
  ): DaemonEvent => {
    const event: DaemonEvent = {
      id: ++eventId,
      type,
      timestamp: new Date().toISOString(),
      ...(params.sessionId ? { sessionId: params.sessionId } : {}),
      ...(typeof params.payload === 'undefined' ? {} : { payload: params.payload })
    }

    recentEvents.push(event)
    if (recentEvents.length > MAX_EVENT_HISTORY) {
      recentEvents.splice(0, recentEvents.length - MAX_EVENT_HISTORY)
    }

    for (const listener of eventSubscribers) {
      try {
        listener(event)
      } catch {
        // no-op
      }
    }

    return event
  }

  const getRecentEvents = (sinceId?: number): DaemonEvent[] => {
    if (typeof sinceId !== 'number' || !Number.isFinite(sinceId) || sinceId <= 0) {
      return [...recentEvents]
    }
    return recentEvents.filter(event => event.id > sinceId)
  }

  const subscribeEvents = (listener: (event: DaemonEvent) => void): (() => void) => {
    eventSubscribers.add(listener)
    return () => {
      eventSubscribers.delete(listener)
    }
  }

  const getOpenAIAuthMode = (): OpenAIAuthMode => {
    const stored = getSetting(storage, OPENAI_AUTH_MODE_KEY)
    if (!stored) return 'api_key'

    try {
      const parsed = OpenAIAuthModeSchema.safeParse(JSON.parse(stored))
      return parsed.success ? parsed.data : 'api_key'
    } catch {
      return 'api_key'
    }
  }

  const getOpenAIApiKey = (): string | undefined => {
    const stored = getSetting(storage, OPENAI_API_KEY_KEY)
    if (!stored) return process.env.FORGE_OPENAI_API_KEY

    try {
      return String(JSON.parse(stored))
    } catch {
      return process.env.FORGE_OPENAI_API_KEY
    }
  }

  const getPermissionMode = (): PermissionMode => {
    const stored = getSetting(storage, POLICY_MODE_KEY)
    if (!stored) return 'standard'

    try {
      const parsed = PermissionModeSchema.safeParse(JSON.parse(stored))
      return parsed.success ? parsed.data : 'standard'
    } catch {
      return 'standard'
    }
  }

  const getDefaultProvider = (): string => {
    const stored = getSetting(storage, DEFAULT_PROVIDER_KEY)
    if (!stored) return process.env.FORGE_DEFAULT_PROVIDER?.trim() || 'mock'

    try {
      const value = String(JSON.parse(stored)).trim()
      return value || process.env.FORGE_DEFAULT_PROVIDER?.trim() || 'mock'
    } catch {
      return process.env.FORGE_DEFAULT_PROVIDER?.trim() || 'mock'
    }
  }

  const listPublicSettings = (): SettingsResponse => {
    const settings = listSettings(storage, { includeKeys: PUBLIC_SETTINGS_KEYS })
    return SettingsResponseSchema.parse({ items: settings })
  }

  const applyPublicSetting = (key: string, value: unknown): SettingsResponse => {
    if (!PUBLIC_SETTINGS_KEYS.includes(key as (typeof PUBLIC_SETTINGS_KEYS)[number])) {
      throw new Error(`Unsupported setting key: ${key}`)
    }

    if (key === POLICY_MODE_KEY) {
      const parsed = PermissionModeSchema.safeParse(value)
      if (!parsed.success) {
        throw new Error(`Invalid value for ${POLICY_MODE_KEY}`)
      }
      setSetting(storage, key, JSON.stringify(parsed.data))
      return listPublicSettings()
    }

    if (key === DEFAULT_PROVIDER_KEY) {
      const normalized = String(value ?? '').trim()
      if (!normalized) {
        throw new Error(`Invalid value for ${DEFAULT_PROVIDER_KEY}`)
      }
      if (!ALLOWED_DEFAULT_PROVIDERS.has(normalized)) {
        throw new Error(
          `Invalid value for ${DEFAULT_PROVIDER_KEY}. Allowed: ${Array.from(ALLOWED_DEFAULT_PROVIDERS).join(', ')}`
        )
      }
      setSetting(storage, key, JSON.stringify(normalized))
      rebuildEngine()
      return listPublicSettings()
    }

    if (key === TUI_THEME_KEY) {
      const normalized = String(value ?? '').trim()
      if (!normalized) {
        throw new Error(`Invalid value for ${TUI_THEME_KEY}`)
      }
      setSetting(storage, key, JSON.stringify(normalized))
      return listPublicSettings()
    }

    throw new Error(`Unsupported setting key: ${key}`)
  }

  const getActiveOpenAIProviderName = (): 'openai-compatible' | 'openai-chatgpt' =>
    getOpenAIAuthMode() === 'chatgpt_oauth' ? 'openai-chatgpt' : 'openai-compatible'

  const normalizeProviderName = (provider: string | null | undefined): string => {
    const raw = (provider ?? '').trim()
    if (!raw) return 'mock'

    if (raw === 'openai') {
      return getActiveOpenAIProviderName()
    }

    if (raw === 'codex') {
      return 'openai-chatgpt'
    }

    return raw
  }

  const isCodexLoggedIn = async (): Promise<boolean> => {
    try {
      const { stdout, stderr } = await execFileAsync('sh', ['-lc', 'codex login status'])
      const combined = `${stdout}\n${stderr}`.toLowerCase()
      return combined.includes('logged in')
    } catch {
      return false
    }
  }

  let engine = new ProviderEngineRuntime({
    defaultProvider: normalizeProviderName(getDefaultProvider()),
    providers: [
      createMockProvider(),
      createCodexCliProvider(),
      createOpenAICompatibleProvider({
        ...(getOpenAIApiKey() ? { apiKey: getOpenAIApiKey() } : {})
      })
    ]
  })

  const rebuildEngine = (): void => {
    engine = new ProviderEngineRuntime({
      defaultProvider: normalizeProviderName(getDefaultProvider()),
      providers: [
        createMockProvider(),
        createCodexCliProvider(),
        createOpenAICompatibleProvider({
          ...(getOpenAIApiKey() ? { apiKey: getOpenAIApiKey() } : {})
        })
      ]
    })
  }

  const normalizeProjectPath = async (rawPath: string): Promise<string> => {
    const absolute = resolve(rawPath)
    const stats = await stat(absolute)
    if (!stats.isDirectory()) {
      throw new Error(`Project path is not a directory: ${absolute}`)
    }
    return absolute
  }

  const getSessionProjectPath = (sessionId: string): string | null => {
    const session = getSessionById(storage, sessionId)
    if (!session) return null
    return session.projectPath
  }

  const markLastActiveSession = (sessionId: string): void => {
    setSetting(storage, LAST_ACTIVE_SESSION_KEY, JSON.stringify(sessionId))
  }

  const resolveLatestSession = (): LatestSessionResponse => {
    const configured = getSetting(storage, LAST_ACTIVE_SESSION_KEY)
    if (configured) {
      try {
        const id = String(JSON.parse(configured))
        const session = getSessionById(storage, id)
        if (session) {
          return { session }
        }
      } catch {
        // ignore corrupted setting and fallback to db order
      }
    }

    return { session: getLatestSession(storage) }
  }

  const ensureSessionConsistencyOnResume = async (sessionId: string): Promise<void> => {
    const session = getSessionById(storage, sessionId)
    if (!session?.projectPath) return

    try {
      const projectStats = await stat(session.projectPath)
      if (!projectStats.isDirectory()) {
        throw new Error('Project path is not a directory')
      }
    } catch {
      setSessionProjectPath(storage, sessionId, null)
      const warning = `[system-warning] Project path unavailable. Project detached on resume: ${session.projectPath}`
      appendSessionMessage(storage, {
        sessionId,
        role: 'system',
        content: warning
      })
      publishEvent('session.project_detached', {
        sessionId,
        payload: { previousProjectPath: session.projectPath }
      })
    }
  }

  const formatProjectContextMessage = (context: Awaited<ReturnType<typeof buildProjectContext>>): string =>
    [
      `project_path: ${context.projectPath}`,
      `project_name: ${context.name ?? '(unknown)'}`,
      `detected_stacks: ${context.detectedStacks.join(', ') || '(none)'}`,
      `top_level_entries: ${context.topLevelEntries.join(', ') || '(none)'}`
    ].join('\n')

  const toEngineHistory = async (sessionId: string): Promise<EngineProviderMessage[]> => {
    const messages = listSessionMessages(storage, sessionId)
      .map(message => {
        if (message.role === 'user') return { role: 'user', content: message.content } as const
        if (message.role === 'assistant') return { role: 'assistant', content: message.content } as const
        if (message.role === 'system') return { role: 'system', content: message.content } as const
        return null
      })
      .filter((item): item is EngineProviderMessage => item !== null)

    const projectPath = getSessionProjectPath(sessionId)
    if (!projectPath) return messages

    try {
      const context = await buildProjectContext(projectPath)
      return [{ role: 'system', content: formatProjectContextMessage(context) }, ...messages]
    } catch {
      return messages
    }
  }

  const executeWriteFileForSession = async (
    sessionId: string,
    input: { path: string; content: string }
  ): Promise<{ path: string; bytesWritten: number }> => {
    const projectPath = getSessionProjectPath(sessionId)
    if (!projectPath) {
      throw new Error('Session has no project selected')
    }

    try {
      const result = await writeFileTool(projectPath, input.path, input.content)
      recordToolExecution(storage, {
        sessionId,
        toolName: 'write_file',
        input,
        output: result,
        status: 'success'
      })
      return result
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      recordToolExecution(storage, {
        sessionId,
        toolName: 'write_file',
        input,
        output: { error: message },
        status: 'error'
      })
      throw error
    }
  }

  const executeRunCommandSafeForSession = async (
    sessionId: string,
    input: RunCommandSafeToolRequest
  ): Promise<RunCommandSafeToolResponse> => {
    const projectPath = getSessionProjectPath(sessionId)
    if (!projectPath) {
      throw new Error('Session has no project selected')
    }

    try {
      const result = await runCommandSafeTool(projectPath, input.command)
      recordToolExecution(storage, {
        sessionId,
        toolName: 'run_command_safe',
        input,
        output: result,
        status: 'success'
      })
      return result
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      recordToolExecution(storage, {
        sessionId,
        toolName: 'run_command_safe',
        input,
        output: { error: message },
        status: 'error'
      })
      throw error
    }
  }

  const executeSystemActionForSession = async (
    sessionId: string,
    action: SystemActionName,
    payload: Record<string, unknown>
  ) => {
    const projectPath = getSessionProjectPath(sessionId)
    if (!projectPath) {
      throw new Error('Session has no project selected')
    }

    const normalizedPayload: Record<string, unknown> = { ...payload }
    if (action === 'open_vscode') {
      const requestedPath = normalizedPayload.path ? String(normalizedPayload.path) : '.'
      assertWritePathAllowed(projectPath, requestedPath)
      normalizedPayload.path = resolve(projectPath, requestedPath)
    }

    try {
      const result = await executeSystemAction(action, normalizedPayload)
      recordToolExecution(storage, {
        sessionId,
        toolName: `system_action:${action}`,
        input: normalizedPayload,
        output: result,
        status: result.ok ? 'success' : 'error'
      })
      return result
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      recordToolExecution(storage, {
        sessionId,
        toolName: `system_action:${action}`,
        input: normalizedPayload,
        output: { error: message },
        status: 'error'
      })
      throw error
    }
  }

  const createPromptStream = (
    sessionId: string,
    input: PromptSessionRequest
  ): { userMessage: SessionMessage; stream: AsyncGenerator<PromptStreamEvent> } | null => {
    const session = getSessionById(storage, sessionId)
    if (!session) return null

    markLastActiveSession(sessionId)
    publishEvent('session.prompt_started', {
      sessionId,
      payload: { contentLength: input.content.length }
    })

    const userMessage = appendSessionMessage(storage, {
      sessionId,
      role: 'user',
      content: input.content
    })

    const run = async function* () {
      let assistantContent = ''

      try {
        for await (const event of engine.runTurn({
          sessionId,
          prompt: input.content,
          provider: normalizeProviderName(
            session.provider ?? process.env.FORGE_DEFAULT_PROVIDER?.trim() ?? 'mock'
          ),
          model: session.model ?? undefined,
          history: await toEngineHistory(sessionId)
        })) {
          if (event.type === 'token') {
            assistantContent += event.value
            yield { type: 'token', value: event.value } as const
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        const assistantMessage = appendSessionMessage(storage, {
          sessionId,
          role: 'assistant',
          content: `[engine-error] ${message}`
        })

        yield { type: 'error', message } as const
        yield { type: 'done', assistantMessage } as const
        publishEvent('session.prompt_failed', {
          sessionId,
          payload: { message }
        })
        return
      }

      const assistantMessage = appendSessionMessage(storage, {
        sessionId,
        role: 'assistant',
        content: assistantContent.trim() ? assistantContent : '(empty assistant response)'
      })

      publishEvent('session.prompt_completed', {
        sessionId,
        payload: {
          assistantMessageId: assistantMessage.id,
          assistantChars: assistantMessage.content.length
        }
      })

      yield { type: 'done', assistantMessage } as const
    }

    return { userMessage, stream: run() }
  }

  const app = createServer({
    logger,
    ...(config.authToken ? { authToken: config.authToken } : {}),
    getHealth: (): HealthResponse => {
      const storageHealth = getStorageHealth(storage)
      return {
        status: storageHealth.ready ? 'ok' : 'degraded',
        service: 'forge-daemon',
        version: '0.1.0',
        timestamp: new Date().toISOString(),
        uptimeSec: Math.floor((Date.now() - startedAt) / 1000),
        storage: storageHealth
      }
    },
    getStatus: () => {
      return {
        status: 'ok',
        activeSessions: countActiveSessions(storage),
        pendingApprovals: countApprovals(storage, 'pending'),
        currentMode: getPermissionMode(),
        totalSessions: countSessions(storage),
        totalProjects: countProjects(storage),
        totalApprovals: countApprovals(storage),
        lastSessionUpdatedAt: getLatestSessionUpdatedAt(storage),
        uptimeSec: Math.floor((Date.now() - startedAt) / 1000),
        defaultProvider: getDefaultProvider(),
        eventSubscribers: eventSubscribers.size
      } as const
    },
    listSessions: () => listSessions(storage),
    getLatestSession: () => resolveLatestSession(),
    resumeLatestSession: () => {
      const latest = resolveLatestSession().session
      if (!latest) return { session: null }

      const resumed = resumeSession(storage, latest.id)
      if (!resumed) return { session: null }
      markLastActiveSession(resumed.id)
      void ensureSessionConsistencyOnResume(resumed.id)
      publishEvent('session.resumed', {
        sessionId: resumed.id,
        payload: { source: 'latest' }
      })
      return { session: resumed }
    },
    createSession: input => {
      const created = createSession(storage, {
        ...input,
        provider: normalizeProviderName(input.provider ?? getDefaultProvider())
      })

      markLastActiveSession(created.id)
      publishEvent('session.created', {
        sessionId: created.id,
        payload: {
          provider: created.provider,
          model: created.model
        }
      })
      return created
    },
    getSessionDetail: sessionId => {
      const session = getSessionById(storage, sessionId)
      if (!session) return null

      return {
        session,
        messages: listSessionMessages(storage, sessionId)
      }
    },
    resumeSession: sessionId => {
      const resumed = resumeSession(storage, sessionId)
      if (!resumed) return null

      markLastActiveSession(resumed.id)
      void ensureSessionConsistencyOnResume(resumed.id)
      publishEvent('session.resumed', {
        sessionId: resumed.id,
        payload: { source: 'by_id' }
      })
      return resumed
    },
    promptSession: async (sessionId, input: PromptSessionRequest) => {
      const prompt = createPromptStream(sessionId, input)
      if (!prompt) return null

      let assistantMessage: SessionMessage | null = null

      for await (const event of prompt.stream) {
        if (event.type === 'done') {
          assistantMessage = event.assistantMessage
        }
      }

      if (!assistantMessage) return null

      return {
        userMessage: prompt.userMessage,
        assistantMessage
      }
    },
    promptSessionStream: async (sessionId, input: PromptSessionRequest) => {
      const prompt = createPromptStream(sessionId, input)
      return prompt?.stream ?? null
    },
    getOpenAIAuthStatus: async () => {
      const mode = getOpenAIAuthMode()
      return {
        mode,
        apiKeyConfigured: Boolean(getOpenAIApiKey()),
        codexLoggedIn: await isCodexLoggedIn(),
        activeProvider: getActiveOpenAIProviderName()
      }
    },
    verifyOpenAIApiKey: async () => {
      return verifyOpenAICompatibleApiKey({
        ...(getOpenAIApiKey() ? { apiKey: getOpenAIApiKey() } : {})
      })
    },
    setOpenAIAuthMode: async input => {
      setSetting(storage, OPENAI_AUTH_MODE_KEY, JSON.stringify(input.mode))
      rebuildEngine()
      publishEvent('settings.updated', {
        payload: { key: OPENAI_AUTH_MODE_KEY, value: input.mode }
      })
      return {
        ok: true as const,
        message: `OpenAI auth mode set to ${input.mode}`
      }
    },
    setOpenAIApiKey: async input => {
      setSetting(storage, OPENAI_API_KEY_KEY, JSON.stringify(input.apiKey))
      setSetting(storage, OPENAI_AUTH_MODE_KEY, JSON.stringify('api_key'))
      rebuildEngine()
      publishEvent('settings.updated', {
        payload: { key: OPENAI_API_KEY_KEY, value: '***' }
      })
      return {
        ok: true as const,
        message: 'OpenAI API key saved and api_key mode activated'
      }
    },
    activateOpenAIChatGPTOAuth: async () => {
      const loggedIn = await isCodexLoggedIn()
      if (!loggedIn) {
        throw new Error(
          'No active Codex ChatGPT login found. Run "codex login --device-auth" in your terminal first.'
        )
      }

      setSetting(storage, OPENAI_AUTH_MODE_KEY, JSON.stringify('chatgpt_oauth'))
      rebuildEngine()
      publishEvent('settings.updated', {
        payload: { key: OPENAI_AUTH_MODE_KEY, value: 'chatgpt_oauth' }
      })
      return {
        ok: true as const,
        message: 'ChatGPT OAuth mode activated using local Codex login session'
      }
    },
    selectSessionProject: async (sessionId, input) => {
      const normalized = await normalizeProjectPath(input.projectPath)
      const updated = setSessionProjectPath(storage, sessionId, normalized)
      if (!updated) return null
      const context = await buildProjectContext(normalized)
      upsertProject(storage, {
        path: normalized,
        name: context.name ?? normalized.split('/').pop() ?? 'project',
        lastOpenedAt: new Date().toISOString()
      })
      publishEvent('session.project_selected', {
        sessionId,
        payload: { projectPath: normalized }
      })
      return context
    },
    getSessionProjectContext: async sessionId => {
      const projectPath = getSessionProjectPath(sessionId)
      if (!projectPath) return null
      return buildProjectContext(projectPath)
    },
    listProjects: () => listProjects(storage),
    listSettings: () => listPublicSettings(),
    updateSetting: async (key, input) => {
      const parsed = UpdateSettingRequestSchema.safeParse(input)
      if (!parsed.success) {
        throw new Error(parsed.error.message)
      }

      const settings = applyPublicSetting(key, parsed.data.value)
      publishEvent('settings.updated', { payload: { key, value: parsed.data.value } })
      return settings
    },
    listSystemActions: () =>
      SYSTEM_ACTIONS.map((action: SystemActionDefinition) => ({ ...action })),
    invokeSystemAction: async (sessionId, action, input: SystemActionInvokeRequest) => {
      const session = getSessionById(storage, sessionId)
      if (!session) return null

      const parsedAction = SystemActionNameSchema.safeParse(action)
      if (!parsedAction.success) {
        throw new Error('Invalid system action')
      }

      const parsedInput = SystemActionInvokeRequestSchema.safeParse(input)
      if (!parsedInput.success) {
        throw new Error(parsedInput.error.message)
      }

      const decision = evaluateCapability(parsedAction.data, getPermissionMode())
      if (decision === 'DENY') {
        throw new Error(`Capability ${parsedAction.data} denied by current permission mode`)
      }

      const payload = parsedInput.data.payload ?? {}
      if (parsedAction.data === 'open_vscode') {
        const projectPath = getSessionProjectPath(sessionId)
        if (!projectPath) {
          throw new Error('Session has no project selected')
        }
        const requestedPath = payload.path ? String(payload.path) : '.'
        assertWritePathAllowed(projectPath, requestedPath)
      }

      if (decision === 'ALLOW') {
        const result = await executeSystemActionForSession(sessionId, parsedAction.data, payload)
        publishEvent('system_action.completed', {
          sessionId,
          payload: { action: parsedAction.data, ok: result.ok }
        })
        return {
          status: 'completed' as const,
          result
        }
      }

      const approval = createApproval(storage, {
        sessionId,
        kind: 'system_action',
        name: parsedAction.data,
        payload: {
          sessionId,
          input: {
            action: parsedAction.data,
            payload
          }
        }
      })

      publishEvent('approval.created', {
        sessionId,
        payload: { approvalId: approval.id, kind: 'system_action', name: parsedAction.data }
      })

      return {
        status: 'pending_approval' as const,
        approvalId: approval.id,
        decision: 'CONFIRM' as const,
        message: `${parsedAction.data} requires approval`
      }
    },
    runListDirTool: async (sessionId, input) => {
      const projectPath = getSessionProjectPath(sessionId)
      if (!projectPath) return null

      try {
        const result = await listDirTool(projectPath, input.path)
        recordToolExecution(storage, {
          sessionId,
          toolName: 'list_dir',
          input,
          output: result,
          status: 'success'
        })
        return result
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        recordToolExecution(storage, {
          sessionId,
          toolName: 'list_dir',
          input,
          output: { error: message },
          status: 'error'
        })
        throw error
      }
    },
    runReadFileTool: async (sessionId, input) => {
      const projectPath = getSessionProjectPath(sessionId)
      if (!projectPath) return null

      try {
        const result = await readFileTool(projectPath, input.path, input.maxBytes)
        recordToolExecution(storage, {
          sessionId,
          toolName: 'read_file',
          input,
          output: result,
          status: 'success'
        })
        return result
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        recordToolExecution(storage, {
          sessionId,
          toolName: 'read_file',
          input,
          output: { error: message },
          status: 'error'
        })
        throw error
      }
    },
    runSearchTextTool: async (sessionId, input) => {
      const projectPath = getSessionProjectPath(sessionId)
      if (!projectPath) return null

      try {
        const result = await searchTextTool(
          projectPath,
          input.query,
          input.path,
          input.maxResults,
          input.caseSensitive
        )
        recordToolExecution(storage, {
          sessionId,
          toolName: 'search_text',
          input,
          output: result,
          status: 'success'
        })
        return result
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        recordToolExecution(storage, {
          sessionId,
          toolName: 'search_text',
          input,
          output: { error: message },
          status: 'error'
        })
        throw error
      }
    },
    runWriteFileTool: async (sessionId, input) => {
      const projectPath = getSessionProjectPath(sessionId)
      if (!projectPath) return null

      assertWritePathAllowed(projectPath, input.path)

      const decision = evaluateCapability('write_file', getPermissionMode())
      if (decision === 'DENY') {
        throw new Error('Capability write_file denied by current permission mode')
      }

      if (decision === 'ALLOW') {
        const result = await executeWriteFileForSession(sessionId, input)
        return { status: 'completed', result } as const
      }

      const approval = createApproval(storage, {
        sessionId,
        kind: 'tool',
        name: 'write_file',
        payload: {
          sessionId,
          input
        }
      })

      publishEvent('approval.created', {
        sessionId,
        payload: { approvalId: approval.id, kind: 'tool', name: 'write_file' }
      })

      return {
        status: 'pending_approval',
        approvalId: approval.id,
        decision: 'CONFIRM',
        message: 'write_file requires approval'
      } as const
    },
    runCommandSafeTool: async (sessionId, input) => {
      const projectPath = getSessionProjectPath(sessionId)
      if (!projectPath) return null

      if (!isSafeCommandAllowed(input.command)) {
        throw new Error(`Command not allowed by whitelist: ${input.command}`)
      }

      const decision = evaluateCapability('run_command_safe', getPermissionMode())
      if (decision === 'DENY') {
        throw new Error('Capability run_command_safe denied by current permission mode')
      }

      if (decision === 'ALLOW') {
        const result = await executeRunCommandSafeForSession(sessionId, input)
        return { status: 'completed', result } as const
      }

      const approval = createApproval(storage, {
        sessionId,
        kind: 'tool',
        name: 'run_command_safe',
        payload: {
          sessionId,
          input
        }
      })

      publishEvent('approval.created', {
        sessionId,
        payload: { approvalId: approval.id, kind: 'tool', name: 'run_command_safe' }
      })

      return {
        status: 'pending_approval',
        approvalId: approval.id,
        decision: 'CONFIRM',
        message: 'run_command_safe requires approval'
      } as const
    },
    listApprovals: () => listApprovals(storage),
    getRecentEvents: sinceId => getRecentEvents(sinceId),
    subscribeEvents: listener => subscribeEvents(listener),
    approveApproval: async approvalId => {
      const approval = getApprovalById(storage, approvalId)
      if (!approval) return null

      let result: unknown = null

      if (approval.status === 'pending') {
        if (approval.kind === 'tool') {
          if (approval.name === 'write_file') {
            const payload = approval.payload as { sessionId?: string; input?: unknown }
            const parsed = WriteFileToolRequestSchema.safeParse(payload.input)
            if (payload.sessionId && parsed.success) {
              try {
                result = await executeWriteFileForSession(payload.sessionId, parsed.data)
              } catch (error) {
                result = { error: error instanceof Error ? error.message : String(error) }
              }
            } else {
              result = { error: 'Invalid write_file approval payload' }
            }
          } else if (approval.name === 'run_command_safe') {
            const payload = approval.payload as { sessionId?: string; input?: unknown }
            const parsed = RunCommandSafeToolRequestSchema.safeParse(payload.input)
            if (payload.sessionId && parsed.success) {
              try {
                result = await executeRunCommandSafeForSession(payload.sessionId, parsed.data)
              } catch (error) {
                result = { error: error instanceof Error ? error.message : String(error) }
              }
            } else {
              result = { error: 'Invalid run_command_safe approval payload' }
            }
          } else {
            result = { warning: `Unsupported approval name: ${approval.name}` }
          }
        } else if (approval.kind === 'system_action') {
          const payload = approval.payload as {
            sessionId?: string
            input?: {
              action?: unknown
              payload?: unknown
            }
          }

          const parsedAction = SystemActionNameSchema.safeParse(payload.input?.action)
          const parsedRequest = SystemActionInvokeRequestSchema.safeParse({
            payload: payload.input?.payload
          })

          if (payload.sessionId && parsedAction.success && parsedRequest.success) {
            try {
              result = await executeSystemActionForSession(
                payload.sessionId,
                parsedAction.data,
                parsedRequest.data.payload ?? {}
              )
            } catch (error) {
              result = { error: error instanceof Error ? error.message : String(error) }
            }
          } else {
            result = { error: 'Invalid system_action approval payload' }
          }
        } else {
          result = { warning: `Unsupported approval kind: ${approval.kind}` }
        }
      }

      const resolved = resolveApproval(storage, approvalId, 'approved')
      if (!resolved) return null

      publishEvent('approval.resolved', {
        sessionId: resolved.sessionId,
        payload: { approvalId: resolved.id, status: 'approved', name: resolved.name }
      })

      return {
        ok: true as const,
        approval: resolved,
        result,
        message: 'Approval resolved as approved'
      }
    },
    rejectApproval: async approvalId => {
      const resolved = resolveApproval(storage, approvalId, 'rejected')
      if (!resolved) return null

      publishEvent('approval.resolved', {
        sessionId: resolved.sessionId,
        payload: { approvalId: resolved.id, status: 'rejected', name: resolved.name }
      })

      return {
        ok: true as const,
        approval: resolved,
        message: 'Approval resolved as rejected'
      }
    }
  })

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, 'Shutdown signal received')
    publishEvent('daemon.stopping', { payload: { signal } })
    await app.close()
    closeStorage(storage)
    process.exit(0)
  }

  process.once('SIGINT', () => {
    void shutdown('SIGINT')
  })
  process.once('SIGTERM', () => {
    void shutdown('SIGTERM')
  })

  await app.listen({ host: config.host, port: config.port })
  logger.info({ host: config.host, port: config.port, dbPath: storage.dbPath }, 'Forge daemon listening')
  publishEvent('daemon.started', {
    payload: { host: config.host, port: config.port, version: '0.1.0' }
  })
}

main().catch((error: unknown) => {
  const logger = getLogger('daemon')
  logger.fatal({ err: error }, 'Failed to start daemon')
  process.exit(1)
})
