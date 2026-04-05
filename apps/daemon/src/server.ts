import { createServer as createHttpServer, type IncomingMessage, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import { randomUUID, timingSafeEqual } from 'node:crypto'
import type { Logger } from '@forge/observability'
import {
  ApprovalListResponseSchema,
  ApprovalResolutionResponseSchema,
  CreateSessionRequestSchema,
  DaemonEventSchema,
  DaemonStatusResponseSchema,
  GenericOkResponseSchema,
  HealthResponseSchema,
  ListDirToolRequestSchema,
  ListDirToolResponseSchema,
  OpenAIAuthStatusResponseSchema,
  OpenAIApiKeyVerifyResponseSchema,
  ProjectListResponseSchema,
  ProjectContextResponseSchema,
  PromptSessionRequestSchema,
  PromptSessionResponseSchema,
  RunCommandSafeToolInvokeResponseSchema,
  RunCommandSafeToolRequestSchema,
  ReadFileToolRequestSchema,
  ReadFileToolResponseSchema,
  SearchTextToolRequestSchema,
  SearchTextToolResponseSchema,
  SelectProjectRequestSchema,
  SetOpenAIApiKeyRequestSchema,
  SetOpenAIAuthModeRequestSchema,
  SessionDetailResponseSchema,
  SessionListResponseSchema,
  LatestSessionResponseSchema,
  SessionSchema,
  SettingsResponseSchema,
  SystemActionInvokeRequestSchema,
  SystemActionInvokeResponseSchema,
  SystemActionListResponseSchema,
  SystemActionNameSchema,
  UpdateSettingRequestSchema,
  WriteFileToolInvokeResponseSchema,
  WriteFileToolRequestSchema,
  type Approval,
  type ApprovalResolutionResponse,
  type CreateSessionRequest,
  type DaemonStatusResponse,
  type DaemonEvent,
  type GenericOkResponse,
  type HealthResponse,
  type ListDirToolRequest,
  type ListDirToolResponse,
  type OpenAIAuthStatusResponse,
  type OpenAIApiKeyVerifyResponse,
  type ProjectListResponse,
  type ProjectContextResponse,
  type PromptSessionRequest,
  type PromptSessionResponse,
  type PromptStreamEvent,
  type RunCommandSafeToolInvokeResponse,
  type RunCommandSafeToolRequest,
  type ReadFileToolRequest,
  type ReadFileToolResponse,
  type SearchTextToolRequest,
  type SearchTextToolResponse,
  type SelectProjectRequest,
  type SetOpenAIApiKeyRequest,
  type SetOpenAIAuthModeRequest,
  type Session,
  type SessionDetailResponse,
  type LatestSessionResponse,
  type SettingsResponse,
  type SystemActionInvokeRequest,
  type SystemActionInvokeResponse,
  type SystemActionListResponse,
  type SystemActionName,
  type UpdateSettingRequest,
  type WriteFileToolInvokeResponse,
  type WriteFileToolRequest
} from '@forge/shared'

export type CreateServerOptions = {
  logger: Logger
  authToken?: string
  getHealth: () => HealthResponse
  getStatus: () => DaemonStatusResponse
  listSessions: () => Session[]
  getLatestSession: () => LatestSessionResponse
  resumeLatestSession: () => LatestSessionResponse
  createSession: (input: CreateSessionRequest) => Session
  getSessionDetail: (sessionId: string) => SessionDetailResponse | null
  resumeSession: (sessionId: string) => Session | null
  promptSession: (sessionId: string, input: PromptSessionRequest) => Promise<PromptSessionResponse | null>
  promptSessionStream: (
    sessionId: string,
    input: PromptSessionRequest
  ) => Promise<AsyncGenerator<PromptStreamEvent> | null>
  getOpenAIAuthStatus: () => Promise<OpenAIAuthStatusResponse>
  verifyOpenAIApiKey: () => Promise<OpenAIApiKeyVerifyResponse>
  setOpenAIAuthMode: (input: SetOpenAIAuthModeRequest) => Promise<GenericOkResponse>
  setOpenAIApiKey: (input: SetOpenAIApiKeyRequest) => Promise<GenericOkResponse>
  activateOpenAIChatGPTOAuth: () => Promise<GenericOkResponse>
  selectSessionProject: (
    sessionId: string,
    input: SelectProjectRequest
  ) => Promise<ProjectContextResponse | null>
  getSessionProjectContext: (sessionId: string) => Promise<ProjectContextResponse | null>
  listProjects: () => ProjectListResponse
  listSettings: () => SettingsResponse
  updateSetting: (key: string, input: UpdateSettingRequest) => Promise<SettingsResponse>
  listSystemActions: () => SystemActionListResponse
  invokeSystemAction: (
    sessionId: string,
    action: SystemActionName,
    input: SystemActionInvokeRequest
  ) => Promise<SystemActionInvokeResponse | null>
  runListDirTool: (sessionId: string, input: ListDirToolRequest) => Promise<ListDirToolResponse | null>
  runReadFileTool: (sessionId: string, input: ReadFileToolRequest) => Promise<ReadFileToolResponse | null>
  runSearchTextTool: (
    sessionId: string,
    input: SearchTextToolRequest
  ) => Promise<SearchTextToolResponse | null>
  runWriteFileTool: (
    sessionId: string,
    input: WriteFileToolRequest
  ) => Promise<WriteFileToolInvokeResponse | null>
  runCommandSafeTool: (
    sessionId: string,
    input: RunCommandSafeToolRequest
  ) => Promise<RunCommandSafeToolInvokeResponse | null>
  listApprovals: () => Approval[]
  getRecentEvents: (sinceId?: number) => DaemonEvent[]
  subscribeEvents: (listener: (event: DaemonEvent) => void) => () => void
  approveApproval: (approvalId: string) => Promise<ApprovalResolutionResponse | null>
  rejectApproval: (approvalId: string) => Promise<ApprovalResolutionResponse | null>
}

export type ForgeHttpServer = {
  listen: (params: { host: string; port: number }) => Promise<void>
  close: () => Promise<void>
}

function applyCorsHeaders(reply: ServerResponse): void {
  reply.setHeader('access-control-allow-origin', '*')
  reply.setHeader('access-control-allow-methods', 'GET,POST,PUT,OPTIONS')
  reply.setHeader('access-control-allow-headers', 'content-type,x-request-id,x-forge-token,authorization')
}

function sendJson(reply: ServerResponse, statusCode: number, payload: unknown): void {
  if (reply.writableEnded) return

  if (reply.headersSent) {
    try {
      reply.end()
    } catch {
      // no-op
    }
    return
  }

  reply.statusCode = statusCode
  applyCorsHeaders(reply)
  reply.setHeader('content-type', 'application/json; charset=utf-8')
  reply.end(JSON.stringify(payload))
}

function sendSSE(reply: ServerResponse, payload: unknown): void {
  if (reply.writableEnded) return

  if (!reply.headersSent) {
    applyCorsHeaders(reply)
  }

  try {
    reply.write(`data: ${JSON.stringify(payload)}\n\n`)
  } catch {
    // no-op
  }
}

class HttpError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
    readonly code: string
  ) {
    super(message)
  }
}

function extractSessionId(pathname: string, suffix = ''): string | null {
  const pattern = suffix
    ? new RegExp(`^/sessions/([^/]+)/${suffix}$`)
    : /^\/sessions\/([^/]+)$/

  const match = pathname.match(pattern)
  if (!match) return null
  const value = match[1]
  if (!value) return null
  return decodeURIComponent(value)
}

function extractApprovalId(pathname: string, suffix = ''): string | null {
  const pattern = suffix
    ? new RegExp(`^/approvals/([^/]+)/${suffix}$`)
    : /^\/approvals\/([^/]+)$/

  const match = pathname.match(pattern)
  if (!match) return null
  const value = match[1]
  if (!value) return null
  return decodeURIComponent(value)
}

function extractSettingKey(pathname: string): string | null {
  const match = pathname.match(/^\/settings\/(.+)$/)
  if (!match) return null
  const value = match[1]
  if (!value) return null
  return decodeURIComponent(value)
}

function extractSessionSystemAction(pathname: string): { sessionId: string; action: string } | null {
  const match = pathname.match(/^\/sessions\/([^/]+)\/system-actions\/([^/]+)$/)
  if (!match) return null
  const sessionId = match[1]
  const action = match[2]
  if (!sessionId || !action) return null

  return {
    sessionId: decodeURIComponent(sessionId),
    action: decodeURIComponent(action)
  }
}

async function readBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let buffer = ''
    request.setEncoding('utf8')
    request.on('data', chunk => {
      buffer += chunk
    })
    request.on('end', () => resolve(buffer))
    request.on('error', reject)
  })
}

async function parseJsonBody(request: IncomingMessage): Promise<unknown> {
  const raw = await readBody(request)
  if (!raw.trim()) return {}

  try {
    return JSON.parse(raw) as unknown
  } catch {
    throw new HttpError('Invalid JSON body', 400, 'invalid_json')
  }
}

async function handleRequest(
  options: CreateServerOptions,
  request: IncomingMessage,
  reply: ServerResponse
): Promise<void> {
  const method = request.method ?? 'GET'
  const url = request.url ?? '/'
  const parsedUrl = new URL(url, 'http://localhost')
  const pathname = parsedUrl.pathname

  if (method === 'OPTIONS') {
    reply.statusCode = 204
    applyCorsHeaders(reply)
    reply.end()
    return
  }

  if (options.authToken && pathname !== '/health') {
    const providedHeader = request.headers['x-forge-token']
    const providedBearer = request.headers.authorization?.startsWith('Bearer ')
      ? request.headers.authorization.slice('Bearer '.length)
      : undefined
    const provided =
      (Array.isArray(providedHeader) ? providedHeader[0] : providedHeader) ?? providedBearer ?? null

    const expected = options.authToken
    const isValid =
      typeof provided === 'string' &&
      provided.length === expected.length &&
      timingSafeEqual(Buffer.from(provided), Buffer.from(expected))

    if (!isValid) {
      sendJson(reply, 401, {
        error: 'unauthorized',
        message: 'Missing or invalid daemon token'
      })
      return
    }
  }

  if (method === 'GET' && pathname === '/health') {
    sendJson(reply, 200, HealthResponseSchema.parse(options.getHealth()))
    return
  }

  if (method === 'GET' && pathname === '/status') {
    sendJson(reply, 200, DaemonStatusResponseSchema.parse(options.getStatus()))
    return
  }

  if (method === 'GET' && pathname === '/events/stream') {
    const sinceRaw = parsedUrl.searchParams.get('since')
    const sinceId = sinceRaw && /^\d+$/.test(sinceRaw) ? Number.parseInt(sinceRaw, 10) : undefined

    reply.statusCode = 200
    applyCorsHeaders(reply)
    reply.setHeader('content-type', 'text/event-stream; charset=utf-8')
    reply.setHeader('cache-control', 'no-cache, no-transform')
    reply.setHeader('connection', 'keep-alive')

    const backlog = options.getRecentEvents(sinceId)
    for (const event of backlog) {
      sendSSE(reply, DaemonEventSchema.parse(event))
    }

    const unsubscribe = options.subscribeEvents(event => {
      sendSSE(reply, DaemonEventSchema.parse(event))
    })

    const keepAlive = setInterval(() => {
      reply.write(': keepalive\n\n')
    }, 15_000)

    await new Promise<void>(resolve => {
      let closed = false
      const cleanup = () => {
        if (closed) return
        closed = true
        clearInterval(keepAlive)
        unsubscribe()
        resolve()
      }
      request.once('close', cleanup)
      reply.once('close', cleanup)
      reply.once('finish', cleanup)
    })

    return
  }

  if (method === 'GET' && pathname === '/providers/openai/auth/status') {
    sendJson(reply, 200, OpenAIAuthStatusResponseSchema.parse(await options.getOpenAIAuthStatus()))
    return
  }

  if (method === 'POST' && pathname === '/providers/openai/auth/api-key/verify') {
    sendJson(reply, 200, OpenAIApiKeyVerifyResponseSchema.parse(await options.verifyOpenAIApiKey()))
    return
  }

  if (method === 'POST' && pathname === '/providers/openai/auth/mode') {
    const payload = await parseJsonBody(request)
    const parsed = SetOpenAIAuthModeRequestSchema.safeParse(payload)
    if (!parsed.success) {
      throw new HttpError(parsed.error.message, 400, 'invalid_payload')
    }

    sendJson(reply, 200, GenericOkResponseSchema.parse(await options.setOpenAIAuthMode(parsed.data)))
    return
  }

  if (method === 'POST' && pathname === '/providers/openai/auth/api-key') {
    const payload = await parseJsonBody(request)
    const parsed = SetOpenAIApiKeyRequestSchema.safeParse(payload)
    if (!parsed.success) {
      throw new HttpError(parsed.error.message, 400, 'invalid_payload')
    }

    sendJson(reply, 200, GenericOkResponseSchema.parse(await options.setOpenAIApiKey(parsed.data)))
    return
  }

  if (method === 'POST' && pathname === '/providers/openai/auth/chatgpt/activate') {
    sendJson(reply, 200, GenericOkResponseSchema.parse(await options.activateOpenAIChatGPTOAuth()))
    return
  }

  if (method === 'GET' && pathname === '/sessions') {
    sendJson(reply, 200, SessionListResponseSchema.parse(options.listSessions()))
    return
  }

  if (method === 'POST' && pathname === '/sessions') {
    const payload = await parseJsonBody(request)
    const parsed = CreateSessionRequestSchema.safeParse(payload)
    if (!parsed.success) {
      throw new HttpError(parsed.error.message, 400, 'invalid_payload')
    }

    sendJson(reply, 201, SessionSchema.parse(options.createSession(parsed.data)))
    return
  }

  if (method === 'GET' && pathname === '/sessions/latest') {
    sendJson(reply, 200, LatestSessionResponseSchema.parse(options.getLatestSession()))
    return
  }

  if (method === 'POST' && pathname === '/sessions/latest/resume') {
    sendJson(reply, 200, LatestSessionResponseSchema.parse(options.resumeLatestSession()))
    return
  }

  const sessionId = extractSessionId(pathname)
  if (method === 'GET' && sessionId) {
    const detail = options.getSessionDetail(sessionId)
    if (!detail) {
      sendJson(reply, 404, { error: 'not_found', message: 'Session not found' })
      return
    }

    sendJson(reply, 200, SessionDetailResponseSchema.parse(detail))
    return
  }

  const resumeSessionId = extractSessionId(pathname, 'resume')
  if (method === 'POST' && resumeSessionId) {
    const resumed = options.resumeSession(resumeSessionId)
    if (!resumed) {
      sendJson(reply, 404, { error: 'not_found', message: 'Session not found' })
      return
    }

    sendJson(reply, 200, SessionSchema.parse(resumed))
    return
  }

  const promptSessionId = extractSessionId(pathname, 'prompt')
  if (method === 'POST' && promptSessionId) {
    const payload = await parseJsonBody(request)
    const parsed = PromptSessionRequestSchema.safeParse(payload)
    if (!parsed.success) {
      throw new HttpError(parsed.error.message, 400, 'invalid_payload')
    }

    const promptResult = await options.promptSession(promptSessionId, parsed.data)
    if (!promptResult) {
      sendJson(reply, 404, { error: 'not_found', message: 'Session not found' })
      return
    }

    sendJson(reply, 200, PromptSessionResponseSchema.parse(promptResult))
    return
  }

  const promptStreamSessionId = extractSessionId(pathname, 'prompt/stream')
  if (method === 'POST' && promptStreamSessionId) {
    const payload = await parseJsonBody(request)
    const parsed = PromptSessionRequestSchema.safeParse(payload)
    if (!parsed.success) {
      throw new HttpError(parsed.error.message, 400, 'invalid_payload')
    }

    const stream = await options.promptSessionStream(promptStreamSessionId, parsed.data)
    if (!stream) {
      sendJson(reply, 404, { error: 'not_found', message: 'Session not found' })
      return
    }

    reply.statusCode = 200
    applyCorsHeaders(reply)
    reply.setHeader('content-type', 'text/event-stream; charset=utf-8')
    reply.setHeader('cache-control', 'no-cache, no-transform')
    reply.setHeader('connection', 'keep-alive')

    try {
      for await (const event of stream) {
        sendSSE(reply, event)
      }
    } catch (error) {
      sendSSE(reply, {
        type: 'error',
        message: error instanceof Error ? error.message : String(error)
      } satisfies PromptStreamEvent)
    }

    reply.end()
    return
  }

  const projectSelectSessionId = extractSessionId(pathname, 'project/select')
  if (method === 'POST' && projectSelectSessionId) {
    const payload = await parseJsonBody(request)
    const parsed = SelectProjectRequestSchema.safeParse(payload)
    if (!parsed.success) {
      throw new HttpError(parsed.error.message, 400, 'invalid_payload')
    }

    const context = await options.selectSessionProject(projectSelectSessionId, parsed.data)
    if (!context) {
      sendJson(reply, 404, { error: 'not_found', message: 'Session not found' })
      return
    }

    sendJson(reply, 200, ProjectContextResponseSchema.parse(context))
    return
  }

  const projectContextSessionId = extractSessionId(pathname, 'project/context')
  if (method === 'GET' && projectContextSessionId) {
    const context = await options.getSessionProjectContext(projectContextSessionId)
    if (!context) {
      sendJson(reply, 404, { error: 'not_found', message: 'Session/project not found' })
      return
    }

    sendJson(reply, 200, ProjectContextResponseSchema.parse(context))
    return
  }

  if (method === 'GET' && pathname === '/projects') {
    sendJson(reply, 200, ProjectListResponseSchema.parse(options.listProjects()))
    return
  }

  if (method === 'GET' && pathname === '/settings') {
    sendJson(reply, 200, SettingsResponseSchema.parse(options.listSettings()))
    return
  }

  const settingKey = extractSettingKey(pathname)
  if (method === 'PUT' && settingKey) {
    const payload = await parseJsonBody(request)
    const parsed = UpdateSettingRequestSchema.safeParse(payload)
    if (!parsed.success) {
      throw new HttpError(parsed.error.message, 400, 'invalid_payload')
    }

    let settings: SettingsResponse
    try {
      settings = await options.updateSetting(settingKey, parsed.data)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      throw new HttpError(message, 400, 'invalid_payload')
    }

    sendJson(reply, 200, SettingsResponseSchema.parse(settings))
    return
  }

  if (method === 'GET' && pathname === '/system-actions') {
    sendJson(reply, 200, SystemActionListResponseSchema.parse(options.listSystemActions()))
    return
  }

  const systemActionPath = extractSessionSystemAction(pathname)
  if (method === 'POST' && systemActionPath) {
    const payload = await parseJsonBody(request)
    const parsed = SystemActionInvokeRequestSchema.safeParse(payload)
    if (!parsed.success) {
      throw new HttpError(parsed.error.message, 400, 'invalid_payload')
    }

    const actionParsed = SystemActionNameSchema.safeParse(systemActionPath.action)
    if (!actionParsed.success) {
      throw new HttpError('Invalid system action name', 400, 'invalid_payload')
    }

    let result: SystemActionInvokeResponse | null = null
    try {
      result = await options.invokeSystemAction(systemActionPath.sessionId, actionParsed.data, parsed.data)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (message.includes('Path escapes project root')) {
        throw new HttpError(message, 400, 'invalid_payload')
      }
      throw new HttpError(message, 400, 'invalid_payload')
    }

    if (!result) {
      sendJson(reply, 404, { error: 'not_found', message: 'Session not found' })
      return
    }

    sendJson(reply, 200, SystemActionInvokeResponseSchema.parse(result))
    return
  }

  const toolListDirSessionId = extractSessionId(pathname, 'tools/list_dir')
  if (method === 'POST' && toolListDirSessionId) {
    const payload = await parseJsonBody(request)
    const parsed = ListDirToolRequestSchema.safeParse(payload)
    if (!parsed.success) {
      throw new HttpError(parsed.error.message, 400, 'invalid_payload')
    }

    let result: ListDirToolResponse | null = null
    try {
      result = await options.runListDirTool(toolListDirSessionId, parsed.data)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (message.includes('Path escapes project root')) {
        throw new HttpError(message, 400, 'invalid_payload')
      }
      throw error
    }

    if (!result) {
      sendJson(reply, 404, { error: 'not_found', message: 'Session/project not found' })
      return
    }

    sendJson(reply, 200, ListDirToolResponseSchema.parse(result))
    return
  }

  const toolReadFileSessionId = extractSessionId(pathname, 'tools/read_file')
  if (method === 'POST' && toolReadFileSessionId) {
    const payload = await parseJsonBody(request)
    const parsed = ReadFileToolRequestSchema.safeParse(payload)
    if (!parsed.success) {
      throw new HttpError(parsed.error.message, 400, 'invalid_payload')
    }

    let result: ReadFileToolResponse | null = null
    try {
      result = await options.runReadFileTool(toolReadFileSessionId, parsed.data)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (message.includes('Path escapes project root')) {
        throw new HttpError(message, 400, 'invalid_payload')
      }
      throw error
    }

    if (!result) {
      sendJson(reply, 404, { error: 'not_found', message: 'Session/project not found' })
      return
    }

    sendJson(reply, 200, ReadFileToolResponseSchema.parse(result))
    return
  }

  const toolSearchTextSessionId = extractSessionId(pathname, 'tools/search_text')
  if (method === 'POST' && toolSearchTextSessionId) {
    const payload = await parseJsonBody(request)
    const parsed = SearchTextToolRequestSchema.safeParse(payload)
    if (!parsed.success) {
      throw new HttpError(parsed.error.message, 400, 'invalid_payload')
    }

    let result: SearchTextToolResponse | null = null
    try {
      result = await options.runSearchTextTool(toolSearchTextSessionId, parsed.data)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (message.includes('Path escapes project root')) {
        throw new HttpError(message, 400, 'invalid_payload')
      }
      throw error
    }

    if (!result) {
      sendJson(reply, 404, { error: 'not_found', message: 'Session/project not found' })
      return
    }

    sendJson(reply, 200, SearchTextToolResponseSchema.parse(result))
    return
  }

  const toolWriteFileSessionId = extractSessionId(pathname, 'tools/write_file')
  if (method === 'POST' && toolWriteFileSessionId) {
    const payload = await parseJsonBody(request)
    const parsed = WriteFileToolRequestSchema.safeParse(payload)
    if (!parsed.success) {
      throw new HttpError(parsed.error.message, 400, 'invalid_payload')
    }

    let result: WriteFileToolInvokeResponse | null = null
    try {
      result = await options.runWriteFileTool(toolWriteFileSessionId, parsed.data)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (message.includes('Path escapes project root')) {
        throw new HttpError(message, 400, 'invalid_payload')
      }
      throw error
    }

    if (!result) {
      sendJson(reply, 404, { error: 'not_found', message: 'Session/project not found' })
      return
    }

    sendJson(reply, 200, WriteFileToolInvokeResponseSchema.parse(result))
    return
  }

  const toolRunCommandSafeSessionId = extractSessionId(pathname, 'tools/run_command_safe')
  if (method === 'POST' && toolRunCommandSafeSessionId) {
    const payload = await parseJsonBody(request)
    const parsed = RunCommandSafeToolRequestSchema.safeParse(payload)
    if (!parsed.success) {
      throw new HttpError(parsed.error.message, 400, 'invalid_payload')
    }

    let result: RunCommandSafeToolInvokeResponse | null = null
    try {
      result = await options.runCommandSafeTool(toolRunCommandSafeSessionId, parsed.data)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (message.includes('Command not allowed by whitelist')) {
        throw new HttpError(message, 400, 'invalid_payload')
      }
      throw error
    }

    if (!result) {
      sendJson(reply, 404, { error: 'not_found', message: 'Session/project not found' })
      return
    }

    sendJson(reply, 200, RunCommandSafeToolInvokeResponseSchema.parse(result))
    return
  }

  if (method === 'GET' && pathname === '/approvals') {
    sendJson(reply, 200, ApprovalListResponseSchema.parse(options.listApprovals()))
    return
  }

  const approveApprovalId = extractApprovalId(pathname, 'approve')
  if (method === 'POST' && approveApprovalId) {
    const result = await options.approveApproval(approveApprovalId)
    if (!result) {
      sendJson(reply, 404, { error: 'not_found', message: 'Approval not found' })
      return
    }

    sendJson(reply, 200, ApprovalResolutionResponseSchema.parse(result))
    return
  }

  const rejectApprovalId = extractApprovalId(pathname, 'reject')
  if (method === 'POST' && rejectApprovalId) {
    const result = await options.rejectApproval(rejectApprovalId)
    if (!result) {
      sendJson(reply, 404, { error: 'not_found', message: 'Approval not found' })
      return
    }

    sendJson(reply, 200, ApprovalResolutionResponseSchema.parse(result))
    return
  }

  sendJson(reply, 404, { error: 'not_found' })
}

export function createServer(options: CreateServerOptions): ForgeHttpServer {
  const httpServer = createHttpServer((request, reply) => {
    const startedAt = Date.now()
    const requestId = randomUUID().slice(0, 8)
    const method = request.method ?? 'GET'
    const path = request.url ?? '/'
    reply.setHeader('x-request-id', requestId)

    reply.once('finish', () => {
      options.logger.info(
        {
          requestId,
          method,
          path,
          statusCode: reply.statusCode,
          durationMs: Date.now() - startedAt
        },
        'HTTP request completed'
      )
    })

    void handleRequest(options, request, reply).catch((error: unknown) => {
      if (reply.writableEnded) return

      if (error instanceof HttpError) {
        if (reply.headersSent) {
          try {
            reply.end()
          } catch {
            // no-op
          }
          return
        }

        sendJson(reply, error.statusCode, {
          error: error.code,
          message: error.message
        })
        return
      }

      options.logger.error({ err: error }, 'Unhandled daemon error')

      if (reply.headersSent) {
        try {
          sendSSE(reply, {
            type: 'error',
            message: error instanceof Error ? error.message : String(error)
          })
          reply.end()
        } catch {
          // no-op
        }
        return
      }

      sendJson(reply, 500, {
        status: 'down',
        error: 'internal_error',
        message: error instanceof Error ? error.message : String(error)
      })
    })
  })

  return {
    listen: async ({ host, port }) =>
      new Promise<void>((resolve, reject) => {
        httpServer.once('error', reject)
        httpServer.listen(port, host, () => {
          httpServer.off('error', reject)
          const address = httpServer.address() as AddressInfo | null
          options.logger.info({ host: address?.address ?? host, port: address?.port ?? port }, 'HTTP server ready')
          resolve()
        })
      }),
    close: async () =>
      new Promise<void>((resolve, reject) => {
        httpServer.close(error => {
          if (error) {
            reject(error)
            return
          }
          resolve()
        })
      })
  }
}
