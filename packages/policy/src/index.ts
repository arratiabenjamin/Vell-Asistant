import { type PermissionMode, type PolicyDecision } from '@forge/shared'

export type Capability =
  | 'list_dir'
  | 'read_file'
  | 'search_text'
  | 'write_file'
  | 'run_command_safe'
  | 'open_url'
  | 'open_browser'
  | 'youtube_search'
  | 'open_vscode'
  | 'show_notification'

const DEFAULT_MATRIX: Record<Capability, PolicyDecision> = {
  list_dir: 'ALLOW',
  read_file: 'ALLOW',
  search_text: 'ALLOW',
  write_file: 'CONFIRM',
  run_command_safe: 'CONFIRM',
  open_url: 'ALLOW',
  open_browser: 'ALLOW',
  youtube_search: 'ALLOW',
  open_vscode: 'CONFIRM',
  show_notification: 'ALLOW'
}

export function evaluateCapability(capability: Capability, mode: PermissionMode): PolicyDecision {
  if (mode === 'strict') {
    return DEFAULT_MATRIX[capability] === 'ALLOW' ? 'CONFIRM' : DEFAULT_MATRIX[capability]
  }

  if (mode === 'dev-relaxed') {
    if (capability === 'write_file') return 'ALLOW'
    if (capability === 'run_command_safe') return 'CONFIRM'
  }

  return DEFAULT_MATRIX[capability]
}
