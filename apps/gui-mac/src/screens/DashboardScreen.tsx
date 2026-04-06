import type { AgentRunSnapshot, DaemonEvent, DaemonStatusResponse, Session } from '@forge/shared'
import { Badge, EmptyState, StatCard } from '../components/ui'
import { formatDateTime, shortId, truncate } from '../utils'

type DashboardScreenProps = {
  connected: boolean
  status: DaemonStatusResponse | null
  currentSession: Session | null
  currentAgentActivity: AgentRunSnapshot | null
  recentDelegationEvents: DaemonEvent[]
  pendingApprovals: number
  onOpenSession: () => void
  onOpenApprovals: () => void
  onOpenProjects: () => void
  onOpenAgents: () => void
}

function agentEventTone(eventType: string): 'neutral' | 'success' | 'warning' | 'danger' | 'info' {
  if (eventType.endsWith('started')) return 'info'
  if (eventType.endsWith('updated')) return 'warning'
  if (eventType.endsWith('completed')) return 'success'
  if (eventType.endsWith('failed')) return 'danger'
  return 'neutral'
}

function agentRunTone(status: string): 'neutral' | 'success' | 'warning' | 'danger' | 'info' {
  if (status === 'completed') return 'success'
  if (status === 'failed') return 'danger'
  if (status === 'running') return 'warning'
  return 'neutral'
}

export function DashboardScreen({
  connected,
  status,
  currentSession,
  currentAgentActivity,
  recentDelegationEvents,
  pendingApprovals,
  onOpenSession,
  onOpenApprovals,
  onOpenProjects,
  onOpenAgents
}: DashboardScreenProps) {
  const provider = currentSession?.provider ?? status?.defaultProvider ?? '-'
  const model = currentSession?.model ?? 'default'
  const activeAgentRuns = status?.activeAgentRuns ?? 0
  const recentDelegations = status?.recentDelegations ?? 0
  const currentAgentSummary = currentAgentActivity?.finalSummary ?? currentAgentActivity?.goal ?? null

  return (
    <section className="screen dashboard-screen">
      <div className="section-header">
        <div>
          <p className="eyebrow">Vell control center</p>
          <h2>Dashboard</h2>
          <p className="muted">
            Vista rápida del estado local, la sesión activa y la delegación supervisada de Vell.
          </p>
        </div>

        <div className="actions-row wrap">
          <Badge tone={connected ? 'success' : 'danger'}>{connected ? 'daemon online' : 'daemon offline'}</Badge>
          <Badge tone={pendingApprovals > 0 ? 'warning' : 'success'}>
            {pendingApprovals} approvals
          </Badge>
          <Badge tone={activeAgentRuns > 0 ? 'warning' : 'neutral'}>{activeAgentRuns} agent runs</Badge>
        </div>
      </div>

      <div className="stats-grid">
        <StatCard
          title="Daemon"
          value={connected ? 'online' : 'offline'}
          caption={`status: ${status?.status ?? '-'} · uptime ${Math.round(status?.uptimeSec ?? 0)}s`}
          tone={connected ? 'success' : 'danger'}
        />

        <StatCard
          title="Current session"
          value={currentSession ? currentSession.title ?? '(sin título)' : 'sin sesión activa'}
          caption={
            currentSession
              ? `id ${shortId(currentSession.id)} · updated ${formatDateTime(currentSession.updatedAt)}`
              : 'abrí una sesión para comenzar'
          }
        />

        <StatCard
          title="Project / model"
          value={truncate(currentSession?.projectPath ?? '(sin proyecto)', 42)}
          caption={`${provider} / ${model}`}
          tone="info"
        />

        <StatCard
          title="Approvals"
          value={pendingApprovals}
          caption={`${status?.totalApprovals ?? 0} total · mode ${status?.currentMode ?? '-'}`}
          tone={pendingApprovals > 0 ? 'warning' : 'success'}
        />
      </div>

      <div className="panel-grid">
        <article className="card soft-card">
          <div className="row-space">
            <div>
              <p className="eyebrow">Multi-agent overview</p>
              <h3>Vell orchestrator</h3>
            </div>
            <button onClick={onOpenAgents}>Open Agents</button>
          </div>

          {currentAgentActivity ? (
            <>
              <div className="actions-row wrap">
                <Badge tone={agentRunTone(currentAgentActivity.status)}>
                  {currentAgentActivity.status}
                </Badge>
                <Badge tone="info">run {currentAgentActivity.runId}</Badge>
                <Badge tone="neutral">{currentAgentActivity.agents.length} subagents</Badge>
              </div>

              <p className="muted">{truncate(currentAgentSummary ?? '', 220)}</p>

              <div className="agent-grid compact">
                {currentAgentActivity.agents.map(agent => (
                  <article key={agent.id} className="agent-card">
                    <div className="row-space">
                      <strong>{agent.role}</strong>
                      <Badge tone={agentRunTone(agent.status)}>{agent.status}</Badge>
                    </div>
                    <p className="muted">{agent.specialty}</p>
                    <p className="muted">{truncate(agent.outputSummary ?? agent.error ?? '(sin output)', 180)}</p>
                  </article>
                ))}
              </div>

              <div className="stream-box subtle">
                <strong>Vell final summary</strong>
                <p>{truncate(currentAgentActivity.finalSummary ?? currentAgentActivity.goal, 320)}</p>
              </div>
            </>
          ) : (
            <EmptyState
              title="Aún sin delegación visible"
              description="Vell todavía no repartió subtareas en la sesión actual."
              action={<button onClick={onOpenSession}>Ir a la sesión</button>}
            />
          )}
        </article>

        <article className="card soft-card">
          <div className="row-space">
            <div>
              <p className="eyebrow">Delegation feed</p>
              <h3>Recent agent events</h3>
            </div>
            <button onClick={onOpenSession}>Open Session</button>
          </div>

          {recentDelegationEvents.length === 0 ? (
            <EmptyState
              title="Sin feed reciente"
              description="Los eventos de delegación aparecerán cuando Vell arranque o cierre subagentes."
              action={<button onClick={onOpenApprovals}>Ver approvals</button>}
            />
          ) : (
            <div className="timeline">
              {recentDelegationEvents.map(event => (
                <article key={event.id} className="timeline-item">
                  <div className="timeline-row">
                    <Badge tone={agentEventTone(event.type)}>{event.type}</Badge>
                    <span className="muted">#{event.id}</span>
                  </div>
                  <p className="muted">{formatDateTime(event.timestamp)}</p>
                  <p>{truncate(JSON.stringify(event.payload ?? {}, null, 0), 180)}</p>
                </article>
              ))}
            </div>
          )}

          <div className="actions-row wrap">
            <button onClick={onOpenSession}>Abrir sesión</button>
            <button onClick={onOpenAgents}>Ver agents</button>
            <button onClick={onOpenApprovals}>Ver approvals</button>
            <button onClick={onOpenProjects}>Ver proyectos</button>
          </div>
        </article>
      </div>

      <div className="stats-grid">
        <StatCard
          title="Recent delegations"
          value={recentDelegations}
          caption="conteo de delegaciones recientes expuestas por el daemon"
          tone="info"
        />
        <StatCard
          title="Workspace"
          value={truncate(currentSession?.projectPath ?? '(sin proyecto)', 40)}
          caption="contexto principal activo"
        />
      </div>
    </section>
  )
}
