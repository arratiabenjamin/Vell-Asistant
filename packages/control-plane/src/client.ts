import {
  ApprovalListResponseSchema,
  ApprovalResolutionResponseSchema,
  AgentRunResponseSchema,
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
  PromptStreamEventSchema,
  ReadFileToolRequestSchema,
  ReadFileToolResponseSchema,
  SearchTextToolRequestSchema,
  SearchTextToolResponseSchema,
  SelectProjectRequestSchema,
  SetOpenAIApiKeyRequestSchema,
  SetOpenAIAuthModeRequestSchema,
  LatestSessionResponseSchema,
  RunCommandSafeToolInvokeResponseSchema,
  RunCommandSafeToolRequestSchema,
  WriteFileToolInvokeResponseSchema,
  WriteFileToolRequestSchema,
  SessionDetailResponseSchema,
  SessionListResponseSchema,
  SessionSchema,
  SettingsResponseSchema,
  SystemActionInvokeRequestSchema,
  SystemActionInvokeResponseSchema,
  SystemActionListResponseSchema,
  UpdateSettingRequestSchema,
  type ApprovalListResponse,
  type ApprovalResolutionResponse,
  type AgentRunResponse,
  type CreateSessionRequest,
  type DaemonEvent,
  type DaemonStatusResponse,
  type GenericOkResponse,
  type HealthResponse,
  type ListDirToolRequest,
  type ListDirToolResponse,
  type OpenAIAuthMode,
  type OpenAIAuthStatusResponse,
  type OpenAIApiKeyVerifyResponse,
  type ProjectListResponse,
  type ProjectContextResponse,
  type PromptSessionRequest,
  type PromptSessionResponse,
  type PromptStreamEvent,
  type ReadFileToolRequest,
  type ReadFileToolResponse,
  type SearchTextToolRequest,
  type SearchTextToolResponse,
  type SelectProjectRequest,
  type SetOpenAIApiKeyRequest,
  type LatestSessionResponse,
  type Session,
  type SessionDetailResponse,
  type SessionListResponse,
  type SettingsResponse,
  type RunCommandSafeToolInvokeResponse,
  type RunCommandSafeToolRequest,
  type SystemActionInvokeRequest,
  type SystemActionInvokeResponse,
  type SystemActionListResponse,
  type SystemActionName,
  type UpdateSettingRequest,
  type WriteFileToolInvokeResponse,
  type WriteFileToolRequest
} from '@forge/shared'
import { ROUTES } from './routes.js'

export type DaemonClientOptions = {
  token?: string
}

export class DaemonClient {
  private readonly authToken: string | null

  constructor(
    private readonly baseUrl: string,
    options: DaemonClientOptions = {}
  ) {
    this.authToken = options.token?.trim() || null
  }

  private withAuth(init: RequestInit): RequestInit {
    const headers = new Headers(init.headers ?? {})
    if (this.authToken) {
      headers.set('x-forge-token', this.authToken)
    }

    return { ...init, headers }
  }

  private async request<T>(path: string, init: RequestInit, parse: (payload: unknown) => T): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, this.withAuth(init))
    if (!response.ok) {
      throw new Error(`Request failed: ${response.status} ${response.statusText}`)
    }

    const payload = await response.json()
    return parse(payload)
  }

  async health(): Promise<HealthResponse> {
    return this.request(ROUTES.health, { method: 'GET' }, payload => HealthResponseSchema.parse(payload))
  }

  async status(): Promise<DaemonStatusResponse> {
    return this.request(ROUTES.status, { method: 'GET' }, payload => DaemonStatusResponseSchema.parse(payload))
  }

  async getOpenAIAuthStatus(): Promise<OpenAIAuthStatusResponse> {
    return this.request(ROUTES.openaiAuthStatus, { method: 'GET' }, payload =>
      OpenAIAuthStatusResponseSchema.parse(payload)
    )
  }

  async setOpenAIAuthMode(mode: OpenAIAuthMode): Promise<GenericOkResponse> {
    const payload = SetOpenAIAuthModeRequestSchema.parse({ mode })
    return this.request(
      ROUTES.openaiAuthMode,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload)
      },
      body => GenericOkResponseSchema.parse(body)
    )
  }

  async setOpenAIApiKey(input: SetOpenAIApiKeyRequest): Promise<GenericOkResponse> {
    const payload = SetOpenAIApiKeyRequestSchema.parse(input)
    return this.request(
      ROUTES.openaiAuthApiKey,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload)
      },
      body => GenericOkResponseSchema.parse(body)
    )
  }

  async activateOpenAIChatGPTOAuth(): Promise<GenericOkResponse> {
    return this.request(
      ROUTES.openaiAuthChatGPTActivate,
      { method: 'POST' },
      body => GenericOkResponseSchema.parse(body)
    )
  }

  async verifyOpenAIApiKey(): Promise<OpenAIApiKeyVerifyResponse> {
    return this.request(
      ROUTES.openaiAuthApiKeyVerify,
      { method: 'POST' },
      body => OpenAIApiKeyVerifyResponseSchema.parse(body)
    )
  }

  async listSessions(): Promise<SessionListResponse> {
    return this.request(ROUTES.sessions, { method: 'GET' }, payload => SessionListResponseSchema.parse(payload))
  }

  async getLatestSession(): Promise<LatestSessionResponse> {
    return this.request(ROUTES.sessionsLatest, { method: 'GET' }, payload =>
      LatestSessionResponseSchema.parse(payload)
    )
  }

  async resumeLatestSession(): Promise<LatestSessionResponse> {
    return this.request(ROUTES.sessionsLatestResume, { method: 'POST' }, payload =>
      LatestSessionResponseSchema.parse(payload)
    )
  }

  async createSession(input: CreateSessionRequest = {}): Promise<Session> {
    const payload = CreateSessionRequestSchema.parse(input)
    return this.request(
      ROUTES.sessions,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload)
      },
      body => SessionSchema.parse(body)
    )
  }

  async getSession(sessionId: string): Promise<SessionDetailResponse> {
    return this.request(ROUTES.sessionById(sessionId), { method: 'GET' }, payload =>
      SessionDetailResponseSchema.parse(payload)
    )
  }

  async getSessionAgentActivity(sessionId: string): Promise<AgentRunResponse> {
    return this.request(ROUTES.sessionAgentActivity(sessionId), { method: 'GET' }, payload =>
      AgentRunResponseSchema.parse(payload)
    )
  }

  async resumeSession(sessionId: string): Promise<Session> {
    return this.request(ROUTES.sessionResume(sessionId), { method: 'POST' }, payload =>
      SessionSchema.parse(payload)
    )
  }

  async promptSession(sessionId: string, input: PromptSessionRequest): Promise<PromptSessionResponse> {
    const payload = PromptSessionRequestSchema.parse(input)
    return this.request(
      ROUTES.sessionPrompt(sessionId),
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload)
      },
      body => PromptSessionResponseSchema.parse(body)
    )
  }

  async *promptSessionStream(
    sessionId: string,
    input: PromptSessionRequest
  ): AsyncGenerator<PromptStreamEvent> {
    const payload = PromptSessionRequestSchema.parse(input)
    const response = await fetch(`${this.baseUrl}${ROUTES.sessionPromptStream(sessionId)}`, {
      method: 'POST',
      headers: this.withAuth({ headers: { 'content-type': 'application/json' } }).headers,
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      throw new Error(`Request failed: ${response.status} ${response.statusText}`)
    }

    if (!response.body) {
      throw new Error('Empty response stream')
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { value, done } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const frames = buffer.split('\n\n')
      buffer = frames.pop() ?? ''

      for (const frame of frames) {
        const line = frame
          .split('\n')
          .map(current => current.trim())
          .find(current => current.startsWith('data:'))

        if (!line) continue
        const raw = line.slice('data:'.length).trim()
        if (!raw) continue

        const parsed = PromptStreamEventSchema.parse(JSON.parse(raw) as unknown)
        yield parsed
      }
    }
  }

  async *streamEvents(sinceId?: number): AsyncGenerator<DaemonEvent> {
    const url = new URL(`${this.baseUrl}${ROUTES.eventsStream}`)
    if (typeof sinceId === 'number' && Number.isFinite(sinceId) && sinceId > 0) {
      url.searchParams.set('since', String(Math.floor(sinceId)))
    }

    const response = await fetch(url.toString(), this.withAuth({ method: 'GET' }))
    if (!response.ok) {
      throw new Error(`Request failed: ${response.status} ${response.statusText}`)
    }
    if (!response.body) {
      throw new Error('Empty response stream')
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { value, done } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const frames = buffer.split('\n\n')
      buffer = frames.pop() ?? ''

      for (const frame of frames) {
        const line = frame
          .split('\n')
          .map(current => current.trim())
          .find(current => current.startsWith('data:'))

        if (!line) continue
        const raw = line.slice('data:'.length).trim()
        if (!raw) continue

        const parsed = DaemonEventSchema.parse(JSON.parse(raw) as unknown)
        yield parsed
      }
    }
  }

  async selectSessionProject(
    sessionId: string,
    input: SelectProjectRequest
  ): Promise<ProjectContextResponse> {
    const payload = SelectProjectRequestSchema.parse(input)
    return this.request(
      ROUTES.sessionProjectSelect(sessionId),
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload)
      },
      body => ProjectContextResponseSchema.parse(body)
    )
  }

  async getSessionProjectContext(sessionId: string): Promise<ProjectContextResponse> {
    return this.request(ROUTES.sessionProjectContext(sessionId), { method: 'GET' }, body =>
      ProjectContextResponseSchema.parse(body)
    )
  }

  async listProjects(): Promise<ProjectListResponse> {
    return this.request(ROUTES.projects, { method: 'GET' }, body => ProjectListResponseSchema.parse(body))
  }

  async listSettings(): Promise<SettingsResponse> {
    return this.request(ROUTES.settings, { method: 'GET' }, body => SettingsResponseSchema.parse(body))
  }

  async updateSetting(key: string, input: UpdateSettingRequest): Promise<SettingsResponse> {
    const payload = UpdateSettingRequestSchema.parse(input)
    return this.request(
      ROUTES.settingByKey(key),
      {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload)
      },
      body => SettingsResponseSchema.parse(body)
    )
  }

  async listSystemActions(): Promise<SystemActionListResponse> {
    return this.request(ROUTES.systemActions, { method: 'GET' }, body =>
      SystemActionListResponseSchema.parse(body)
    )
  }

  async invokeSystemAction(
    sessionId: string,
    action: SystemActionName,
    input: SystemActionInvokeRequest = {}
  ): Promise<SystemActionInvokeResponse> {
    const payload = SystemActionInvokeRequestSchema.parse(input)
    return this.request(
      ROUTES.sessionSystemAction(sessionId, action),
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload)
      },
      body => SystemActionInvokeResponseSchema.parse(body)
    )
  }

  async runListDirTool(sessionId: string, input: ListDirToolRequest = {}): Promise<ListDirToolResponse> {
    const payload = ListDirToolRequestSchema.parse(input)
    return this.request(
      ROUTES.sessionToolListDir(sessionId),
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload)
      },
      body => ListDirToolResponseSchema.parse(body)
    )
  }

  async runReadFileTool(sessionId: string, input: ReadFileToolRequest): Promise<ReadFileToolResponse> {
    const payload = ReadFileToolRequestSchema.parse(input)
    return this.request(
      ROUTES.sessionToolReadFile(sessionId),
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload)
      },
      body => ReadFileToolResponseSchema.parse(body)
    )
  }

  async runSearchTextTool(
    sessionId: string,
    input: SearchTextToolRequest
  ): Promise<SearchTextToolResponse> {
    const payload = SearchTextToolRequestSchema.parse(input)
    return this.request(
      ROUTES.sessionToolSearchText(sessionId),
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload)
      },
      body => SearchTextToolResponseSchema.parse(body)
    )
  }

  async runWriteFileTool(
    sessionId: string,
    input: WriteFileToolRequest
  ): Promise<WriteFileToolInvokeResponse> {
    const payload = WriteFileToolRequestSchema.parse(input)
    return this.request(
      ROUTES.sessionToolWriteFile(sessionId),
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload)
      },
      body => WriteFileToolInvokeResponseSchema.parse(body)
    )
  }

  async runCommandSafeTool(
    sessionId: string,
    input: RunCommandSafeToolRequest
  ): Promise<RunCommandSafeToolInvokeResponse> {
    const payload = RunCommandSafeToolRequestSchema.parse(input)
    return this.request(
      ROUTES.sessionToolRunCommandSafe(sessionId),
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload)
      },
      body => RunCommandSafeToolInvokeResponseSchema.parse(body)
    )
  }

  async listApprovals(): Promise<ApprovalListResponse> {
    return this.request(ROUTES.approvals, { method: 'GET' }, payload => ApprovalListResponseSchema.parse(payload))
  }

  async approveApproval(approvalId: string): Promise<ApprovalResolutionResponse> {
    return this.request(ROUTES.approvalApprove(approvalId), { method: 'POST' }, payload =>
      ApprovalResolutionResponseSchema.parse(payload)
    )
  }

  async rejectApproval(approvalId: string): Promise<ApprovalResolutionResponse> {
    return this.request(ROUTES.approvalReject(approvalId), { method: 'POST' }, payload =>
      ApprovalResolutionResponseSchema.parse(payload)
    )
  }
}
