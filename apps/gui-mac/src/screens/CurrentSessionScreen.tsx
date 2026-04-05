import { useMemo, useState } from 'react'
import type { DaemonEvent, Session, SessionDetailResponse } from '@forge/shared'
import type { SessionUiState } from '../hooks/useForgeDaemon'
import { formatDateTime, shortId, summarizeUnknown, truncate } from '../utils'

type CurrentSessionScreenProps = {
  session: SessionDetailResponse | null
  sessions: Session[]
  streamingText: string
  busy: boolean
  sessionState: SessionUiState
  events: DaemonEvent[]
  onCreateSession: (title?: string) => Promise<void>
  onSwitchSession: (sessionId: string) => Promise<void>
  onSubmitPrompt: (content: string) => Promise<void>
  onResumeLatest: () => Promise<void>
  onRefresh: () => Promise<void>
}

const MAX_MESSAGES = 24
const MAX_EVENTS = 14

export function CurrentSessionScreen({
  session,
  sessions,
  streamingText,
  busy,
  sessionState,
  events,
  onCreateSession,
  onSwitchSession,
  onSubmitPrompt,
  onResumeLatest,
  onRefresh
}: CurrentSessionScreenProps) {
  const [input, setInput] = useState('')
  const [newSessionTitle, setNewSessionTitle] = useState('')

  const recentMessages = useMemo(() => session?.messages.slice(-MAX_MESSAGES) ?? [], [session?.messages])

  const relevantEvents = useMemo(() => {
    const sessionId = session?.session.id
    if (!sessionId) return events.slice(-MAX_EVENTS)

    const scoped = events.filter(event => event.sessionId === sessionId)
    return scoped.slice(-MAX_EVENTS)
  }, [events, session?.session.id])

  const handleSubmit = async (): Promise<void> => {
    const content = input.trim()
    if (!content) return

    setInput('')
    await onSubmitPrompt(content)
  }

  const stateLabel =
    sessionState === 'thinking'
      ? 'thinking'
      : sessionState === 'waiting_approval'
        ? 'waiting approval'
        : sessionState === 'error'
          ? 'error'
          : 'idle'

  return (
    <section className="screen session-screen">
      <div className="section-header">
        <h2>Current Session</h2>
        <div className="actions-row">
          <button onClick={() => void onResumeLatest()} disabled={busy}>
            Reanudar latest
          </button>
          <button onClick={() => void onRefresh()} disabled={busy}>
            Refresh
          </button>
        </div>
      </div>

      <div className="session-meta card">
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
          <>
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
            <p>
              <strong>State:</strong> {stateLabel}
            </p>
          </>
        ) : (
          <p className="muted">No hay sesión activa. Enviá un prompt para crear una sesión rápida.</p>
        )}
      </div>

      <div className="grid-two">
        <article className="card scrollable">
          <h3>Conversation</h3>
          {recentMessages.length === 0 ? (
            <p className="muted">Sin mensajes.</p>
          ) : (
            <ul className="list-clean">
              {recentMessages.map(message => (
                <li key={message.id}>
                  <p>
                    <strong>[{message.role}]</strong> {truncate(message.content, 320)}
                  </p>
                  <p className="muted">{formatDateTime(message.createdAt)}</p>
                </li>
              ))}
            </ul>
          )}

          {streamingText ? (
            <div className="stream-box">
              <strong>Streaming:</strong>
              <p>{streamingText}</p>
            </div>
          ) : null}
        </article>

        <article className="card scrollable">
          <h3>Tools / Events</h3>
          {relevantEvents.length === 0 ? (
            <p className="muted">Sin eventos recientes.</p>
          ) : (
            <ul className="list-clean">
              {relevantEvents.map(event => (
                <li key={event.id}>
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

      <div className="card input-bar">
        <textarea
          placeholder="Escribí prompt para la sesión actual..."
          value={input}
          onChange={event => setInput(event.target.value)}
          rows={3}
          disabled={busy}
        />
        <div className="actions-row">
          <button onClick={() => void handleSubmit()} disabled={busy || input.trim().length === 0}>
            {busy ? 'Enviando...' : 'Enviar prompt'}
          </button>
        </div>
      </div>
    </section>
  )
}
