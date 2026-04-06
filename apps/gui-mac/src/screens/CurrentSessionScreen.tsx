import { useMemo, useState } from 'react'
import type { AgentRunSnapshot, DaemonEvent, Session, SessionDetailResponse } from '@forge/shared'
import type { SessionUiState } from '../hooks/useForgeDaemon'
import { useVoiceInput } from '../hooks/useVoiceInput'
import { formatDateTime, shortId, summarizeUnknown, truncate } from '../utils'

type CurrentSessionScreenProps = {
  session: SessionDetailResponse | null
  sessions: Session[]
  streamingText: string
  busy: boolean
  sessionState: SessionUiState
  events: DaemonEvent[]
  agentActivity: AgentRunSnapshot | null
  onCreateSession: (title?: string) => Promise<void>
  onSwitchSession: (sessionId: string) => Promise<void>
  onSubmitPrompt: (content: string) => Promise<void>
  onResumeLatest: () => Promise<void>
  onRefresh: () => Promise<void>
  onOpenAgents: () => void
}

const MAX_MESSAGES = 28
const MAX_EVENTS = 18

function sessionStateClass(state: SessionUiState): string {
  if (state === 'error') return 'badge error'
  if (state === 'waiting_approval') return 'badge warn'
  if (state === 'thinking') return 'badge info'
  return 'badge ok'
}

function agentStatusClass(status: string): string {
  if (status === 'completed') return 'badge ok'
  if (status === 'failed') return 'badge error'
  if (status === 'running') return 'badge warn'
  return 'badge'
}

export function CurrentSessionScreen({
  session,
  sessions,
  streamingText,
  busy,
  sessionState,
  events,
  agentActivity,
  onCreateSession,
  onSwitchSession,
  onSubmitPrompt,
  onResumeLatest,
  onRefresh,
  onOpenAgents
}: CurrentSessionScreenProps) {
  const [input, setInput] = useState('')
  const [newSessionTitle, setNewSessionTitle] = useState('')
  const [commandFeedback, setCommandFeedback] = useState<string | null>(null)

  const recentMessages = useMemo(() => session?.messages.slice(-MAX_MESSAGES) ?? [], [session?.messages])

  const relevantEvents = useMemo(() => {
    const sessionId = session?.session.id
    if (!sessionId) return events.slice(-MAX_EVENTS)

    const scoped = events.filter(event => event.sessionId === sessionId)
    return scoped.slice(-MAX_EVENTS)
  }, [events, session?.session.id])

  const handleSlashCommand = async (raw: string): Promise<boolean> => {
    const normalized = raw.trim()
    if (!normalized.startsWith('/')) return false

    const [command, ...args] = normalized.slice(1).split(' ')
    const argument = args.join(' ').trim()

    if (command === 'help') {
      setCommandFeedback('Commands: /new [title], /resume, /refresh, /agents, /help')
      return true
    }

    if (command === 'new') {
      await onCreateSession(argument.length > 0 ? argument : undefined)
      setCommandFeedback('Nueva sesión creada')
      return true
    }

    if (command === 'resume') {
      await onResumeLatest()
      setCommandFeedback('Sesión más reciente reanudada')
      return true
    }

    if (command === 'refresh') {
      await onRefresh()
      setCommandFeedback('Snapshot actualizado')
      return true
    }

    if (command === 'agents') {
      onOpenAgents()
      setCommandFeedback('Abriendo vista Agents')
      return true
    }

    setCommandFeedback(`Comando no reconocido: /${command}`)
    return true
  }

  const handleSubmit = async (): Promise<void> => {
    const content = input.trim()
    if (!content) return

    setInput('')
    setCommandFeedback(null)

    if (await handleSlashCommand(content)) {
      return
    }

    await onSubmitPrompt(content)
  }

  const {
    supported: voiceSupported,
    state: voiceState,
    error: voiceError,
    startListening,
    stopListening,
    clearError: clearVoiceError
  } = useVoiceInput({
    disabled: busy,
    onTranscript: async transcript => {
      setCommandFeedback(`Voice transcript: ${truncate(transcript, 96)}`)
      await onSubmitPrompt(transcript)
    }
  })

  return (
    <section className="screen session-screen">
      <div className="section-header">
        <div>
          <h2>Current Session</h2>
          <p className="muted">Conversás con Vell. Vell puede delegar a subagentes y consolidar.</p>
        </div>
        <div className="actions-row">
          <span className={sessionStateClass(sessionState)}>{sessionState}</span>
          <button onClick={() => void onResumeLatest()} disabled={busy}>
            Reanudar latest
          </button>
          <button onClick={() => void onRefresh()} disabled={busy}>
            Refresh
          </button>
        </div>
      </div>

      <div className="card session-meta">
        <div className="actions-row wrap">
          <label>
            Session
            <select
              value={session?.session.id ?? ''}
              onChange={event => {
                const value = event.target.value
                if (!value) return
                void onSwitchSession(value)
              }}
              disabled={busy || sessions.length === 0}
            >
              <option value="" disabled>
                {sessions.length === 0 ? 'Sin sesiones' : 'Seleccionar sesión'}
              </option>
              {sessions.map(item => (
                <option key={item.id} value={item.id}>
                  {shortId(item.id)} · {item.title ?? '(sin título)'}
                </option>
              ))}
            </select>
          </label>

          <input
            type="text"
            value={newSessionTitle}
            onChange={event => setNewSessionTitle(event.target.value)}
            placeholder="Título nueva sesión"
          />

          <button
            onClick={() => {
              const title = newSessionTitle.trim()
              void onCreateSession(title.length > 0 ? title : undefined)
              setNewSessionTitle('')
            }}
            disabled={busy}
          >
            Nueva sesión
          </button>
        </div>

        {session ? (
          <div className="meta-grid">
            <p>
              <strong>ID:</strong> {shortId(session.session.id)}
            </p>
            <p>
              <strong>Title:</strong> {session.session.title ?? '(sin título)'}
            </p>
            <p>
              <strong>Project:</strong> {session.session.projectPath ?? '(sin proyecto)'}
            </p>
            <p>
              <strong>Model:</strong> {session.session.provider ?? '-'} / {session.session.model ?? 'default'}
            </p>
          </div>
        ) : (
          <p className="muted">No hay sesión activa. Enviá un prompt para crear una sesión rápida.</p>
        )}
      </div>

      <div className="grid-two session-content-grid">
        <article className="card scrollable conversation-pane">
          <h3>Conversation</h3>
          {recentMessages.length === 0 ? (
            <p className="muted">Sin mensajes todavía.</p>
          ) : (
            <ul className="list-clean">
              {recentMessages.map(message => (
                <li key={message.id} className="message-item">
                  <p>
                    <strong>[{message.role}]</strong> {truncate(message.content, 380)}
                  </p>
                  <p className="muted">{formatDateTime(message.createdAt)}</p>
                </li>
              ))}
            </ul>
          )}

          {streamingText ? (
            <div className="stream-box">
              <strong>Streaming</strong>
              <p>{streamingText}</p>
            </div>
          ) : null}
        </article>

        <div className="list-stack">
          <article className="card scrollable">
            <div className="row-space">
              <h3>Agent Activity</h3>
              <button onClick={onOpenAgents}>Open Agents</button>
            </div>

            {!agentActivity ? (
              <p className="muted">Sin delegación registrada en esta sesión.</p>
            ) : (
              <>
                <p>
                  <strong>Vell run:</strong> {agentActivity.runId} ·{' '}
                  <span className={agentStatusClass(agentActivity.status)}>{agentActivity.status}</span>
                </p>
                <p className="muted">{truncate(agentActivity.goal, 200)}</p>

                <ul className="list-clean">
                  {agentActivity.agents.map(agent => (
                    <li key={agent.id} className="message-item">
                      <div className="row-space">
                        <strong>{agent.role}</strong>
                        <span className={agentStatusClass(agent.status)}>{agent.status}</span>
                      </div>
                      <p className="muted">{agent.specialty}</p>
                      <p className="muted">{truncate(agent.outputSummary ?? agent.error ?? '(sin output)', 220)}</p>
                    </li>
                  ))}
                </ul>

                {agentActivity.finalSummary ? (
                  <div className="stream-box">
                    <strong>Vell summary</strong>
                    <p>{truncate(agentActivity.finalSummary, 300)}</p>
                  </div>
                ) : null}
              </>
            )}
          </article>

          <article className="card scrollable">
            <h3>Tools / Events</h3>
            {relevantEvents.length === 0 ? (
              <p className="muted">Sin eventos recientes.</p>
            ) : (
              <ul className="list-clean">
                {relevantEvents.map(event => (
                  <li key={event.id} className="message-item">
                    <p>
                      <strong>{event.type}</strong>
                    </p>
                    <p className="muted">
                      #{event.id} · {formatDateTime(event.timestamp)}
                    </p>
                    <p className="muted">{summarizeUnknown(event.payload)}</p>
                  </li>
                ))}
              </ul>
            )}
          </article>
        </div>
      </div>

      <div className="card input-bar">
        <div className="row-space">
          <strong>Command Bar</strong>
          <span className="muted">Slash commands: /new /resume /refresh /agents /help</span>
        </div>

        <textarea
          placeholder="Escribí prompt para Vell..."
          value={input}
          onChange={event => setInput(event.target.value)}
          rows={3}
          disabled={busy}
        />

        <div className="actions-row wrap">
          <button onClick={() => void handleSubmit()} disabled={busy || input.trim().length === 0}>
            {busy ? 'Enviando...' : 'Enviar prompt'}
          </button>

          <button
            className={voiceState === 'listening' ? 'voice-button listening' : 'voice-button'}
            disabled={!voiceSupported || busy || voiceState === 'sending' || voiceState === 'transcribing'}
            onMouseDown={startListening}
            onMouseUp={stopListening}
            onMouseLeave={stopListening}
            onTouchStart={startListening}
            onTouchEnd={stopListening}
          >
            {voiceSupported ? '🎙️ Push to talk' : '🎙️ Voice unavailable'}
          </button>

          <span className="badge info">voice: {voiceState}</span>

          {voiceError ? (
            <>
              <span className="error">{voiceError}</span>
              <button onClick={clearVoiceError}>Clear voice error</button>
            </>
          ) : null}
        </div>

        {commandFeedback ? <p className="muted">{commandFeedback}</p> : null}
      </div>
    </section>
  )
}
