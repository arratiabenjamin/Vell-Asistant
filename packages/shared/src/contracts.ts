import { z } from 'zod'

export const ServiceStatusSchema = z.enum(['ok', 'degraded', 'down'])
export type ServiceStatus = z.infer<typeof ServiceStatusSchema>

export const PermissionModeSchema = z.enum(['standard', 'strict', 'dev-relaxed'])
export type PermissionMode = z.infer<typeof PermissionModeSchema>

export const PolicyDecisionSchema = z.enum(['ALLOW', 'CONFIRM', 'DENY'])
export type PolicyDecision = z.infer<typeof PolicyDecisionSchema>

export const HealthResponseSchema = z.object({
  status: ServiceStatusSchema,
  service: z.string(),
  version: z.string(),
  timestamp: z.string(),
  uptimeSec: z.number().nonnegative(),
  storage: z.object({
    ready: z.boolean(),
    path: z.string(),
    migrationsApplied: z.number().int().nonnegative()
  })
})

export type HealthResponse = z.infer<typeof HealthResponseSchema>

export const DaemonStatusResponseSchema = z.object({
  status: ServiceStatusSchema,
  activeSessions: z.number().int().nonnegative(),
  pendingApprovals: z.number().int().nonnegative(),
  currentMode: PermissionModeSchema,
  totalSessions: z.number().int().nonnegative(),
  totalProjects: z.number().int().nonnegative(),
  totalApprovals: z.number().int().nonnegative(),
  lastSessionUpdatedAt: z.string().nullable(),
  uptimeSec: z.number().nonnegative(),
  defaultProvider: z.string(),
  eventSubscribers: z.number().int().nonnegative()
})

export type DaemonStatusResponse = z.infer<typeof DaemonStatusResponseSchema>

export const SessionSchema = z.object({
  id: z.string(),
  type: z.string(),
  projectPath: z.string().nullable(),
  title: z.string().nullable(),
  status: z.string(),
  provider: z.string().nullable(),
  model: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string()
})

export type Session = z.infer<typeof SessionSchema>

export const SessionListResponseSchema = z.array(SessionSchema)
export type SessionListResponse = z.infer<typeof SessionListResponseSchema>

export const LatestSessionResponseSchema = z.object({
  session: SessionSchema.nullable()
})

export type LatestSessionResponse = z.infer<typeof LatestSessionResponseSchema>

export const CreateSessionRequestSchema = z.object({
  type: z.string().optional(),
  projectPath: z.string().optional(),
  title: z.string().optional(),
  provider: z.string().optional(),
  model: z.string().optional()
})

export type CreateSessionRequest = z.infer<typeof CreateSessionRequestSchema>

export const SessionMessageSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  role: z.string(),
  content: z.string(),
  createdAt: z.string()
})

export type SessionMessage = z.infer<typeof SessionMessageSchema>

export const SessionDetailResponseSchema = z.object({
  session: SessionSchema,
  messages: z.array(SessionMessageSchema)
})

export type SessionDetailResponse = z.infer<typeof SessionDetailResponseSchema>

export const PromptSessionRequestSchema = z.object({
  content: z.string().min(1)
})

export type PromptSessionRequest = z.infer<typeof PromptSessionRequestSchema>

export const PromptSessionResponseSchema = z.object({
  userMessage: SessionMessageSchema,
  assistantMessage: SessionMessageSchema
})

export type PromptSessionResponse = z.infer<typeof PromptSessionResponseSchema>

export const PromptStreamEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('token'),
    value: z.string()
  }),
  z.object({
    type: z.literal('done'),
    assistantMessage: SessionMessageSchema
  }),
  z.object({
    type: z.literal('error'),
    message: z.string()
  })
])

export type PromptStreamEvent = z.infer<typeof PromptStreamEventSchema>

export const OpenAIAuthModeSchema = z.enum(['api_key', 'chatgpt_oauth'])
export type OpenAIAuthMode = z.infer<typeof OpenAIAuthModeSchema>

export const OpenAIAuthStatusResponseSchema = z.object({
  mode: OpenAIAuthModeSchema,
  apiKeyConfigured: z.boolean(),
  codexLoggedIn: z.boolean(),
  activeProvider: z.enum(['openai-compatible', 'openai-chatgpt'])
})

export type OpenAIAuthStatusResponse = z.infer<typeof OpenAIAuthStatusResponseSchema>

export const OpenAIApiKeyVerifyResponseSchema = z.object({
  ok: z.boolean(),
  statusCode: z.number().int().nullable(),
  message: z.string()
})

export type OpenAIApiKeyVerifyResponse = z.infer<typeof OpenAIApiKeyVerifyResponseSchema>

export const SetOpenAIAuthModeRequestSchema = z.object({
  mode: OpenAIAuthModeSchema
})

export type SetOpenAIAuthModeRequest = z.infer<typeof SetOpenAIAuthModeRequestSchema>

export const SetOpenAIApiKeyRequestSchema = z.object({
  apiKey: z.string().min(1)
})

export type SetOpenAIApiKeyRequest = z.infer<typeof SetOpenAIApiKeyRequestSchema>

export const GenericOkResponseSchema = z.object({
  ok: z.literal(true),
  message: z.string()
})

export type GenericOkResponse = z.infer<typeof GenericOkResponseSchema>

export const SelectProjectRequestSchema = z.object({
  projectPath: z.string().min(1)
})

export type SelectProjectRequest = z.infer<typeof SelectProjectRequestSchema>

export const ProjectContextResponseSchema = z.object({
  projectPath: z.string(),
  name: z.string().nullable(),
  detectedStacks: z.array(z.string()),
  topLevelEntries: z.array(z.string())
})

export type ProjectContextResponse = z.infer<typeof ProjectContextResponseSchema>

export const ListDirToolRequestSchema = z.object({
  path: z.string().optional()
})

export type ListDirToolRequest = z.infer<typeof ListDirToolRequestSchema>

export const ListDirToolResponseSchema = z.object({
  basePath: z.string(),
  entries: z.array(
    z.object({
      name: z.string(),
      type: z.enum(['file', 'dir', 'symlink', 'other']),
      size: z.number().int().nonnegative().nullable()
    })
  )
})

export type ListDirToolResponse = z.infer<typeof ListDirToolResponseSchema>

export const ReadFileToolRequestSchema = z.object({
  path: z.string().min(1),
  maxBytes: z.number().int().positive().optional()
})

export type ReadFileToolRequest = z.infer<typeof ReadFileToolRequestSchema>

export const ReadFileToolResponseSchema = z.object({
  path: z.string(),
  truncated: z.boolean(),
  content: z.string()
})

export type ReadFileToolResponse = z.infer<typeof ReadFileToolResponseSchema>

export const SearchTextToolRequestSchema = z.object({
  query: z.string().min(1),
  path: z.string().optional(),
  maxResults: z.number().int().positive().optional(),
  caseSensitive: z.boolean().optional()
})

export type SearchTextToolRequest = z.infer<typeof SearchTextToolRequestSchema>

export const SearchTextToolResponseSchema = z.object({
  query: z.string(),
  hits: z.array(
    z.object({
      path: z.string(),
      line: z.number().int().positive(),
      snippet: z.string()
    })
  )
})

export type SearchTextToolResponse = z.infer<typeof SearchTextToolResponseSchema>

export const WriteFileToolRequestSchema = z.object({
  path: z.string().min(1),
  content: z.string()
})

export type WriteFileToolRequest = z.infer<typeof WriteFileToolRequestSchema>

export const WriteFileToolResponseSchema = z.object({
  path: z.string(),
  bytesWritten: z.number().int().nonnegative()
})

export type WriteFileToolResponse = z.infer<typeof WriteFileToolResponseSchema>

export const RunCommandSafeToolRequestSchema = z.object({
  command: z.string().min(1)
})

export type RunCommandSafeToolRequest = z.infer<typeof RunCommandSafeToolRequestSchema>

export const RunCommandSafeToolResponseSchema = z.object({
  command: z.string(),
  exitCode: z.number().int(),
  stdout: z.string(),
  stderr: z.string()
})

export type RunCommandSafeToolResponse = z.infer<typeof RunCommandSafeToolResponseSchema>

export const ApprovalRequiredResponseSchema = z.object({
  status: z.literal('pending_approval'),
  approvalId: z.string(),
  decision: z.literal('CONFIRM'),
  message: z.string()
})

export type ApprovalRequiredResponse = z.infer<typeof ApprovalRequiredResponseSchema>

export const WriteFileToolInvokeResponseSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('completed'),
    result: WriteFileToolResponseSchema
  }),
  ApprovalRequiredResponseSchema
])

export type WriteFileToolInvokeResponse = z.infer<typeof WriteFileToolInvokeResponseSchema>

export const RunCommandSafeToolInvokeResponseSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('completed'),
    result: RunCommandSafeToolResponseSchema
  }),
  ApprovalRequiredResponseSchema
])

export type RunCommandSafeToolInvokeResponse = z.infer<typeof RunCommandSafeToolInvokeResponseSchema>

export const ApprovalStatusSchema = z.enum(['pending', 'approved', 'rejected'])
export type ApprovalStatus = z.infer<typeof ApprovalStatusSchema>

export const ApprovalSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  kind: z.string(),
  name: z.string(),
  payload: z.unknown(),
  status: ApprovalStatusSchema,
  createdAt: z.string(),
  resolvedAt: z.string().nullable()
})

export type Approval = z.infer<typeof ApprovalSchema>

export const ApprovalListResponseSchema = z.array(ApprovalSchema)
export type ApprovalListResponse = z.infer<typeof ApprovalListResponseSchema>

export const ApprovalResolutionResponseSchema = z.object({
  ok: z.literal(true),
  approval: ApprovalSchema,
  message: z.string().optional(),
  result: z.unknown().optional()
})

export type ApprovalResolutionResponse = z.infer<typeof ApprovalResolutionResponseSchema>

export const DaemonEventSchema = z.object({
  id: z.number().int().positive(),
  type: z.string(),
  timestamp: z.string(),
  sessionId: z.string().optional(),
  payload: z.unknown().optional()
})

export type DaemonEvent = z.infer<typeof DaemonEventSchema>

export const ProjectSchema = z.object({
  id: z.string(),
  path: z.string(),
  name: z.string(),
  lastOpenedAt: z.string().nullable(),
  createdAt: z.string()
})

export type Project = z.infer<typeof ProjectSchema>

export const ProjectListResponseSchema = z.array(ProjectSchema)
export type ProjectListResponse = z.infer<typeof ProjectListResponseSchema>

export const SettingEntrySchema = z.object({
  key: z.string(),
  value: z.unknown()
})

export type SettingEntry = z.infer<typeof SettingEntrySchema>

export const SettingsResponseSchema = z.object({
  items: z.array(SettingEntrySchema)
})

export type SettingsResponse = z.infer<typeof SettingsResponseSchema>

export const UpdateSettingRequestSchema = z.object({
  value: z.unknown()
})

export type UpdateSettingRequest = z.infer<typeof UpdateSettingRequestSchema>

export const SystemActionNameSchema = z.enum([
  'open_url',
  'open_browser',
  'youtube_search',
  'open_vscode',
  'show_notification'
])

export type SystemActionName = z.infer<typeof SystemActionNameSchema>

export const SystemActionDefinitionSchema = z.object({
  name: SystemActionNameSchema,
  description: z.string(),
  defaultPolicy: PolicyDecisionSchema
})

export type SystemActionDefinition = z.infer<typeof SystemActionDefinitionSchema>

export const SystemActionListResponseSchema = z.array(SystemActionDefinitionSchema)
export type SystemActionListResponse = z.infer<typeof SystemActionListResponseSchema>

export const SystemActionInvokeRequestSchema = z.object({
  payload: z.record(z.string(), z.unknown()).optional()
})

export type SystemActionInvokeRequest = z.infer<typeof SystemActionInvokeRequestSchema>

export const SystemActionExecutionResultSchema = z.object({
  action: SystemActionNameSchema,
  ok: z.boolean(),
  message: z.string(),
  metadata: z.record(z.string(), z.unknown()).optional()
})

export type SystemActionExecutionResult = z.infer<typeof SystemActionExecutionResultSchema>

export const SystemActionInvokeResponseSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('completed'),
    result: SystemActionExecutionResultSchema
  }),
  ApprovalRequiredResponseSchema
])

export type SystemActionInvokeResponse = z.infer<typeof SystemActionInvokeResponseSchema>
