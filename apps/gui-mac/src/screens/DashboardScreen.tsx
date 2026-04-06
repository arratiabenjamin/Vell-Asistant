import type { AgentRunSnapshot, DaemonStatusResponse, Session } from '@forge/shared'
import { formatDateTime, shortId, truncate } from '../utils'

type DashboardScreenProps = {
  connected: boolean
  status: DaemonStatusResponse | null
  currentSession: Session | null
  currentAgentActivity: AgentRunSnapshot | null
  pendingApprovals: number
  onOpenSession: () => void
  onOpenApprovals: () => void
  onOpenProjects: () => void
  onOpenAgents: () => void
}

function badgeClassByConnection(connected: boolean): string {
  return connected ? 'badge ok' : 'badge error'
}

export function DashboardScreen({
  connected,
  status,
  currentSession,
  currentAgentActivity,
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
    <section className="screen">
      <div className="section-header">
        <div>
          <h2>Dashboard</h2>
          <p className="muted">Vell orquesta la sesión principal y delega subtareas cuando conviene.</p>
        </div>
      </div>

      <div className="stats-grid">
        <article className="card compact">
          <h3>Daemon</h3>
          <p className="value">
            <span className={badgeClassByConnection(connected)}>{connected ? 'online' : 'offline'}</span>
          </p>
          <p className="muted">status: {status?.status ?? '-'}</p>
          <p className="muted">uptime: {Math.round(status?.uptimeSec ?? 0)}s</p>
        </article>

        <article className="card compact">
          <h3>Current Session</h3>
          {currentSession ? (
            <>
              <p className="value">{currentSession.title ?? '(sin título)'}</p>
              <p className="muted">id: {shortId(currentSession.id)}</p>
              <p className="muted">updated: {formatDateTime(currentSession.updatedAt)}</p>
            </>
          ) : (
            <p className="muted">No hay sesión activa.</p>
          )}
        </article>

        <article className="card compact">
          <h3>Project / Model</h3>
          <p className="value">{truncate(currentSession?.projectPath ?? '(sin proyecto)', 46)}</p>
          <p className="muted">
            {provider} / {model}
          </p>
        </article>

        <article className="card compact">
          <h3>Approvals</h3>
          <p className={`value ${pendingApprovals > 0 ? 'warn' : 'ok'}`}>{pendingApprovals}</p>
          <p className="muted">pendientes</p>
          <p className="muted">actives: {status?.activeSessions ?? 0}</p>
        </article>
      </div>

      <div className="stats-grid">
        <article className="card compact">
          <h3>Multi-agent activity</h3>
          <p>
            <span className={`badge ${activeAgentRuns > 0 ? 'warn' : 'ok'}`}>active runs: {activeAgentRuns}</span>
          </p>
          <p className="muted">recent delegations: {recentDelegations}</p>
        </article>

        <article className="card compact">
          <h3>Vell orchestrator</h3>
          {currentAgentActivity ? (
            <>
              <p>
                <span className="badge info">run: {currentAgentActivity.runId}</span>
                <span className={`badge ${currentAgentActivity.status === 'failed' ? 'error' : currentAgentActivity.status === 'running' ? 'warn' : 'ok'}`}>
                  {currentAgentActivity.status}
                </span>
              </p>
              <p className="muted">{truncate(currentAgentSummary ?? '', 180)}</p>
            </>
          ) : (
            <p className="muted">Aún sin delegación visible en la sesión actual.</p>
          )}
        </article>
      </div>

      <div className="actions-row wrap">
        <button onClick={onOpenSession}>Abrir sesión</button>
        <button onClick={onOpenAgents}>Ver Agents</button>
        <button onClick={onOpenApprovals}>Ver approvals</button>
        <button onClick={onOpenProjects}>Ver proyectos</button>
      </div>
    </section>
  )
}
