import { useEffect, useState } from 'react'
import type { DaemonStatusResponse, Session } from '@forge/shared'
import type { SessionUiState } from '../hooks/useForgeDaemon'
import { asStringValue } from '../utils'

type SettingsScreenProps = {
  settingMap: Record<string, unknown>
  status: DaemonStatusResponse | null
  currentSession: Session | null
  sessionState: SessionUiState
  busy: boolean
  onRefresh: () => Promise<void>
  onUpdateSetting: (key: string, value: unknown) => Promise<void>
}

const PROVIDER_OPTIONS = ['mock', 'codex', 'openai', 'openai-compatible', 'openai-chatgpt'] as const
const MODE_OPTIONS = ['standard', 'strict', 'dev-relaxed'] as const

export function SettingsScreen({
  settingMap,
  status,
  currentSession,
  sessionState,
  busy,
  onRefresh,
  onUpdateSetting
}: SettingsScreenProps) {
  const [policyMode, setPolicyMode] = useState<string>(asStringValue(settingMap['policy.mode'], 'standard'))
  const [defaultProvider, setDefaultProvider] = useState<string>(
    asStringValue(settingMap['default.provider'], status?.defaultProvider ?? 'mock')
  )

  useEffect(() => {
    setPolicyMode(asStringValue(settingMap['policy.mode'], 'standard'))
    setDefaultProvider(asStringValue(settingMap['default.provider'], status?.defaultProvider ?? 'mock'))
  }, [settingMap, status?.defaultProvider])

  return (
    <section className="screen">
      <div className="section-header">
        <h2>Settings</h2>
        <div className="actions-row">
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
        <h3>Permission mode</h3>
        <p>session state: {sessionState}</p>
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
