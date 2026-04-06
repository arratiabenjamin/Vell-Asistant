import { useEffect, useMemo, useRef, useState } from 'react'
import type { AgentRunSnapshot, DaemonEvent, Session, SessionDetailResponse } from '@forge/shared'
import type { SessionUiState } from '../hooks/useForgeDaemon'
import { useSpeechOutput } from '../hooks/useSpeechOutput'
import { useVoiceInput } from '../hooks/useVoiceInput'
import { Badge, EmptyState, StatCard } from '../components/ui'
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
  onCreateRealSession: (title?: string) => Promise<void>
  onSwitchSession: (sessionId: string) => Promise<void>
  onSubmitPrompt: (content: string) => Promise<void>
  onResumeLatest: () => Promise<void>
  onRefresh: () => Promise<void>
  onOpenAgents: () => void
}

const MAX_EVENTS = 18

function sessionStateTone(state: SessionUiState): 'neutral' | 'success' | 'warning' | 'danger' | 'info' {
  if (state === 'error') return 'danger'
  if (state === 'waiting_approval') return 'warning'
  if (state === 'thinking') return 'info'
  return 'success'
}

function agentStatusTone(status: string): 'neutral' | 'success' | 'warning' | 'danger' | 'info' {
  if (status === 'completed') return 'success'
  if (status === 'failed') return 'danger'
  if (status === 'running') return 'warning'
  return 'neutral'
}

function voiceTone(state: string): 'neutral' | 'success' | 'warning' | 'danger' | 'info' {
  if (state === 'listening') return 'info'
  if (state === 'sending' || state === 'transcribing') return 'warning'
  if (state === 'error') return 'danger'
  if (state === 'unsupported') return 'neutral'
  return 'success'
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
  onCreateRealSession,
  onSwitchSession,
  onSubmitPrompt,
  onResumeLatest,
  onRefresh,
  onOpenAgents
}: CurrentSessionScreenProps) {
  const [input, setInput] = useState('')
  const [newSessionTitle, setNewSessionTitle] = useState('')
  const [commandFeedback, setCommandFeedback] = useState<string | null>(null)
  const conversationEndRef = useRef<HTMLDivElement | null>(null)

  const recentMessages = useMemo(() => session?.messages ?? [], [session?.messages])

  const assistantResponse = useMemo(() => {
    const latestAssistantMessage = [...recentMessages].reverse().find(message => message.role === 'assistant')
    return streamingText.trim() || latestAssistantMessage?.content?.trim() || ''
  }, [recentMessages, streamingText])

  const relevantEvents = useMemo(() => {
    const sessionId = session?.session.id
    if (!sessionId) return events.slice(-MAX_EVENTS)

    const scoped = events.filter(event => event.sessionId === sessionId)
    return scoped.slice(-MAX_EVENTS)
  }, [events, session?.session.id])

  const agentEvents = useMemo(() => relevantEvents.filter(event => event.type.startsWith('agent.')), [relevantEvents])
  const sessionProvider = session?.session.provider ?? null
  const isMockSession = sessionProvider === 'mock'

  useEffect(() => {
    conversationEndRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' })
  }, [recentMessages.length, streamingText])

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
    hint: voiceHint,
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

  const {
    supported: speechSupported,
    state: speechState,
    error: speechError,
    hint: speechHint,
    speak,
    cancel: stopSpeech,
    clearError: clearSpeechError
  } = useSpeechOutput()

  return (
    <section className="screen session-screen">
      <div className="section-header">
        <div>
          <p className="eyebrow">Live coordination</p>
          <h2>Current Session</h2>
          <p className="muted">Conversás con Vell. La sesión mantiene streaming, tools y delegación supervisada.</p>
        </div>

        <div className="actions-row wrap">
          <Badge tone={sessionStateTone(sessionState)}>{sessionState}</Badge>
          <Badge tone={voiceTone(voiceState)}>voice: {voiceState}</Badge>
          <Badge tone={voiceTone(speechState)}>tts: {speechState}</Badge>
          <button onClick={() => void onResumeLatest()} disabled={busy}>
            Reanudar latest
          </button>
          <button onClick={() => void onRefresh()} disabled={busy}>
            Refresh
          </button>
        </div>
      </div>

      <div className="stats-grid">
        <StatCard
          title="Session"
          value={session ? shortId(session.session.id) : '—'}
          caption={session?.session.title ?? 'sin sesión activa'}
          tone="info"
        />
        <StatCard
          title="Project / model"
          value={truncate(session?.session.projectPath ?? '(sin proyecto)', 40)}
          caption={`${sessionProvider ?? '-'} / ${session?.session.model ?? 'default'}`}
          tone={isMockSession ? 'warning' : 'neutral'}
        />
        <StatCard
          title="Execution"
          value={sessionState}
          caption={`messages ${recentMessages.length} · events ${relevantEvents.length}`}
          tone={sessionStateTone(sessionState)}
        />
        <StatCard
          title="Delegation"
          value={agentActivity ? `${agentActivity.agents.length} subagents` : 'sin run'}
          caption={agentActivity?.status ?? 'idle'}
          tone={agentActivity ? agentStatusTone(agentActivity.status) : 'neutral'}
        />
      </div>

      {isMockSession ? (
        <div className="callout warning">
          <div>
            <p className="eyebrow">Mock provider active</p>
            <strong>Esta sesión responde como simulación o eco.</strong>
            <p className="muted">
              Creá una sesión real para hablar con un provider productivo. Si el provider default está en mock,
              usaremos <code>openai-chatgpt</code>.
            </p>
          </div>
          <div className="actions-row wrap">
            <button onClick={() => void onCreateRealSession('Sesión real')} disabled={busy}>
              Crear sesión real
            </button>
          </div>
        </div>
      ) : null}

      <div className="card soft-card">
        <div className="actions-row wrap">
          <label className="field-inline">
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

          <label className="field-inline grow">
            Nueva sesión
            <input
              type="text"
              value={newSessionTitle}
              onChange={event => setNewSessionTitle(event.target.value)}
              placeholder="Título para nueva sesión"
            />
          </label>

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
          <EmptyState
            title="No hay sesión activa"
            description="Enviá un prompt o creá una sesión para empezar a coordinar con Vell."
          />
        )}
      </div>

      <div className="grid-two session-content-grid">
        <article className="card soft-card scrollable conversation-pane">
          <div className="row-space">
            <div>
              <p className="eyebrow">Conversation</p>
              <h3>Transcript</h3>
            </div>

            <div className="actions-row wrap">
              <Badge tone="neutral">{recentMessages.length} msgs</Badge>
              {assistantResponse ? (
                <button
                  onClick={() => speak(assistantResponse)}
                  disabled={!speechSupported || assistantResponse.length === 0 || speechState === 'speaking'}
                >
                  🔊 Leer respuesta
                </button>
              ) : null}
              {speechState === 'speaking' ? <button onClick={stopSpeech}>Stop reading</button> : null}
            </div>
          </div>

          {recentMessages.length === 0 ? (
            <EmptyState
              title="Sin mensajes todavía"
              description="La conversación aparecerá acá cuando Vell reciba prompts y responda."
            />
          ) : (
            <ul className="list-clean">
              {recentMessages.map(message => (
                <li key={message.id} className="message-item">
                  <div className="row-space">
                    <Badge tone={message.role === 'assistant' ? 'success' : message.role === 'user' ? 'info' : 'neutral'}>
                      {message.role}
                    </Badge>
                    <span className="muted">{formatDateTime(message.createdAt)}</span>
                  </div>
                  <p>{truncate(message.content, 380)}</p>
                </li>
              ))}
            </ul>
          )}

          {streamingText ? (
            <div className="stream-box">
              <div className="row-space">
                <strong>Streaming</strong>
                <Badge tone="info">live</Badge>
              </div>
              <p>{streamingText}</p>
            </div>
          ) : null}

          <div ref={conversationEndRef} />
        </article>

        <div className="list-stack">
          <article className="card soft-card scrollable">
            <div className="row-space">
              <div>
                <p className="eyebrow">Agent Activity</p>
                <h3>Vell orchestrator</h3>
              </div>
              <button onClick={onOpenAgents}>Open Agents</button>
            </div>

            {!agentActivity ? (
              <EmptyState
                title="Sin delegación registrada"
                description="Vell todavía no delegó subtareas en esta sesión."
                action={<button onClick={onOpenAgents}>Ver catálogo</button>}
              />
            ) : (
              <>
                <div className="actions-row wrap">
                  <Badge tone={agentStatusTone(agentActivity.status)}>{agentActivity.status}</Badge>
                  <Badge tone="info">run {agentActivity.runId}</Badge>
                  <Badge tone="neutral">{agentActivity.agents.length} subagents</Badge>
                </div>
                <p className="muted">{truncate(agentActivity.goal, 220)}</p>

                <div className="agent-grid compact">
                  {agentActivity.agents.map(agent => (
                    <article key={agent.id} className="agent-card">
                      <div className="row-space">
                        <strong>{agent.role}</strong>
                        <Badge tone={agentStatusTone(agent.status)}>{agent.status}</Badge>
                      </div>
                      <p className="muted">{agent.specialty}</p>
                      <p className="muted">{truncate(agent.outputSummary ?? agent.error ?? '(sin output)', 180)}</p>
                    </article>
                  ))}
                </div>

                {agentActivity.finalSummary ? (
                  <div className="stream-box subtle">
                    <strong>Vell summary</strong>
                    <p>{truncate(agentActivity.finalSummary, 320)}</p>
                  </div>
                ) : null}
              </>
            )}
          </article>

          <article className="card soft-card scrollable">
            <div className="row-space">
              <div>
                <p className="eyebrow">Delegation timeline</p>
                <h3>Recent events</h3>
              </div>
              <Badge tone="neutral">{agentEvents.length} events</Badge>
            </div>

            {agentEvents.length === 0 ? (
              <EmptyState title="Sin eventos recientes" description="Los eventos de delegación aparecerán acá." />
            ) : (
              <div className="timeline">
                {agentEvents.map(event => (
                  <article key={event.id} className="timeline-item">
                    <div className="timeline-row">
                      <Badge tone={event.type.endsWith('failed') ? 'danger' : event.type.endsWith('completed') ? 'success' : 'info'}>
                        {event.type}
                      </Badge>
                      <span className="muted">#{shortId(String(event.id))}</span>
                    </div>
                    <p className="muted">{formatDateTime(event.timestamp)}</p>
                    <p className="muted">{summarizeUnknown(event.payload)}</p>
                  </article>
                ))}
              </div>
            )}
          </article>

          <article className="card soft-card scrollable">
            <div className="row-space">
              <div>
                <p className="eyebrow">Tools / Events</p>
                <h3>Runtime feed</h3>
              </div>
              <Badge tone="neutral">{relevantEvents.length} total</Badge>
            </div>

            {relevantEvents.length === 0 ? (
              <EmptyState title="Sin eventos recientes" description="Las herramientas y eventos del daemon aparecerán aquí." />
            ) : (
              <ul className="list-clean">
                {relevantEvents.map(event => (
                  <li key={event.id} className="message-item">
                    <div className="row-space">
                      <Badge tone="neutral">{event.type}</Badge>
                      <span className="muted">{formatDateTime(event.timestamp)}</span>
                    </div>
                    <p className="muted">#{event.id}</p>
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

          {isMockSession ? (
            <button className="primary" onClick={() => void onCreateRealSession('Sesión real')} disabled={busy}>
              Crear sesión real
            </button>
          ) : null}

          <button
            className={voiceState === 'listening' ? 'voice-button listening' : 'voice-button'}
            disabled={!voiceSupported || busy || voiceState === 'sending' || voiceState === 'transcribing'}
            onPointerDown={startListening}
            onPointerUp={stopListening}
            onPointerCancel={stopListening}
            onPointerLeave={stopListening}
          >
            {voiceSupported ? '🎙️ Push to talk' : '🎙️ Voice unavailable'}
          </button>

          <span className="badge info">voice: {voiceState}</span>
          <span className="badge info">tts: {speechState}</span>

          {voiceError ? (
            <>
              <span className="error">{voiceError}</span>
              {voiceHint ? <span className="muted">{voiceHint}</span> : null}
              <button onClick={clearVoiceError}>Clear voice error</button>
            </>
          ) : null}
          {!voiceSupported && voiceHint ? <span className="muted">{voiceHint}</span> : null}

          {speechError ? (
            <>
              <span className="error">{speechError}</span>
              {speechHint ? <span className="muted">{speechHint}</span> : null}
              <button onClick={clearSpeechError}>Clear tts error</button>
            </>
          ) : null}
          {!speechSupported && speechHint ? <span className="muted">{speechHint}</span> : null}
        </div>

        {commandFeedback ? <p className="muted">{commandFeedback}</p> : null}
      </div>
    </section>
  )
}
