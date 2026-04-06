import { useEffect, useState } from 'react'
import type { DaemonStatusResponse, OpenAIAuthMode, OpenAIAuthStatusResponse, Session } from '@forge/shared'
import type { SessionUiState } from '../hooks/useForgeDaemon'
import { asStringValue } from '../utils'
import { Badge } from '../components/ui'

type SettingsScreenProps = {
  settingMap: Record<string, unknown>
  status: DaemonStatusResponse | null
  openAIAuthStatus: OpenAIAuthStatusResponse | null
  currentSession: Session | null
  sessionState: SessionUiState
  busy: boolean
  onRefresh: () => Promise<void>
  onUpdateSetting: (key: string, value: unknown) => Promise<void>
  onSetOpenAIApiKey: (apiKey: string) => Promise<void>
  onSetOpenAIAuthMode: (mode: OpenAIAuthMode) => Promise<void>
  onVerifyOpenAIApiKey: () => Promise<{ ok: boolean; statusCode: number | null; message: string }>
}

const PROVIDER_OPTIONS = ['mock', 'codex', 'openai', 'openai-compatible', 'openai-chatgpt'] as const
const MODE_OPTIONS = ['standard', 'strict', 'dev-relaxed'] as const
const OPENAI_AUTH_MODE_OPTIONS: OpenAIAuthMode[] = ['api_key', 'chatgpt_oauth']

export function SettingsScreen({
  settingMap,
  status,
  openAIAuthStatus,
  currentSession,
  sessionState,
  busy,
  onRefresh,
  onUpdateSetting,
  onSetOpenAIApiKey,
  onSetOpenAIAuthMode,
  onVerifyOpenAIApiKey
}: SettingsScreenProps) {
  const [policyMode, setPolicyMode] = useState<string>(asStringValue(settingMap['policy.mode'], 'standard'))
  const [defaultProvider, setDefaultProvider] = useState<string>(
    asStringValue(settingMap['default.provider'], status?.defaultProvider ?? 'mock')
  )
  const [openAIApiKey, setOpenAIApiKey] = useState('')
  const [openAIAuthMode, setOpenAIAuthMode] = useState<OpenAIAuthMode>(openAIAuthStatus?.mode ?? 'api_key')
  const [verifyMessage, setVerifyMessage] = useState<string | null>(null)

  useEffect(() => {
    setPolicyMode(asStringValue(settingMap['policy.mode'], 'standard'))
    setDefaultProvider(asStringValue(settingMap['default.provider'], status?.defaultProvider ?? 'mock'))
    setOpenAIAuthMode(openAIAuthStatus?.mode ?? 'api_key')
  }, [settingMap, status?.defaultProvider, openAIAuthStatus?.mode])

  return (
    <section className="screen">
      <div className="section-header">
        <div>
          <h2>Settings</h2>
          <p className="muted">Configuración local de runtime, provider y seguridad.</p>
        </div>
        <div className="actions-row wrap">
          <Badge tone="info">session: {sessionState}</Badge>
          <button onClick={() => void onRefresh()} disabled={busy}>
            Refresh
          </button>
        </div>
      </div>

      <div className="card">
        <h3>Daemon</h3>
        <p>status: {status?.status ?? '-'}</p>
        <p>event subscribers: {status?.eventSubscribers ?? '-'}</p>
        <p>active sessions: {status?.activeSessions ?? '-'}</p>
        <p>active agent runs: {status?.activeAgentRuns ?? 0}</p>
      </div>

      <div className="card">
        <h3>Provider / Model</h3>
        <p>
          sesión actual: {currentSession?.provider ?? '-'} / {currentSession?.model ?? 'default'}
        </p>

        <div className="actions-row wrap">
          <label>
            Default provider
            <select
              value={defaultProvider}
              onChange={event => setDefaultProvider(event.target.value)}
              disabled={busy}
            >
              {PROVIDER_OPTIONS.map(option => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <button onClick={() => void onUpdateSetting('default.provider', defaultProvider)} disabled={busy}>
            Guardar provider
          </button>
        </div>
      </div>

      <div className="card">
        <h3>OpenAI auth</h3>
        <p>mode actual: {openAIAuthStatus?.mode ?? '-'}</p>
        <p>api key configurada: {openAIAuthStatus?.apiKeyConfigured ? 'sí' : 'no'}</p>
        <p>codex login: {openAIAuthStatus?.codexLoggedIn ? 'sí' : 'no'}</p>
        <p>provider activo: {openAIAuthStatus?.activeProvider ?? '-'}</p>

        <div className="actions-row wrap">
          <label>
            Auth mode
            <select value={openAIAuthMode} onChange={event => setOpenAIAuthMode(event.target.value as OpenAIAuthMode)}>
              {OPENAI_AUTH_MODE_OPTIONS.map(option => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <button onClick={() => void onSetOpenAIAuthMode(openAIAuthMode)} disabled={busy}>
            Guardar auth mode
          </button>
        </div>

        <div className="actions-row wrap">
          <label style={{ minWidth: 320 }}>
            OpenAI API key
            <input
              type="password"
              value={openAIApiKey}
              placeholder="sk-..."
              onChange={event => setOpenAIApiKey(event.target.value)}
              disabled={busy}
            />
          </label>
          <button
            onClick={() =>
              void onSetOpenAIApiKey(openAIApiKey).then(() => {
                setOpenAIApiKey('')
                setVerifyMessage('API key guardada')
              })
            }
            disabled={busy}
          >
            Guardar API key
          </button>
          <button
            onClick={() =>
              void onVerifyOpenAIApiKey().then(result => {
                setVerifyMessage(`${result.ok ? '✅' : '❌'} ${result.message}`)
              })
            }
            disabled={busy}
          >
            Verificar API key
          </button>
        </div>

        {verifyMessage ? <p className="muted">{verifyMessage}</p> : null}
      </div>

      <div className="card">
        <h3>Permission mode</h3>
        <div className="actions-row wrap">
          <label>
            Policy mode
            <select value={policyMode} onChange={event => setPolicyMode(event.target.value)} disabled={busy}>
              {MODE_OPTIONS.map(option => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <button onClick={() => void onUpdateSetting('policy.mode', policyMode)} disabled={busy}>
            Guardar modo
          </button>
        </div>
      </div>

      <div className="card">
        <h3>Raw settings</h3>
        <pre>{JSON.stringify(settingMap, null, 2)}</pre>
      </div>
    </section>
  )
}
