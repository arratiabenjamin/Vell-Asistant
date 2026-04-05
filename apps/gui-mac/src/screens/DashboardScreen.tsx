import type { DaemonStatusResponse, Session } from '@forge/shared'
import { formatDateTime, shortId } from '../utils'

type DashboardScreenProps = {
  connected: boolean
  status: DaemonStatusResponse | null
  currentSession: Session | null
  pendingApprovals: number
  onOpenSession: () => void
  onOpenApprovals: () => void
  onOpenProjects: () => void
}

export function DashboardScreen({
  connected,
  status,
  currentSession,
  pendingApprovals,
  onOpenSession,
  onOpenApprovals,
  onOpenProjects
}: DashboardScreenProps) {
  const provider = currentSession?.provider ?? status?.defaultProvider ?? '-'
  const model = currentSession?.model ?? 'default'

  return (
    <section className="screen">
      <h2>Dashboard</h2>

      <div className="stats-grid">
        <article className="card">
          <h3>Daemon</h3>
          <p className={`value ${connected ? 'ok' : 'error'}`}>{connected ? 'online' : 'offline'}</p>
          <p className="muted">status: {status?.status ?? '-'}</p>
          <p className="muted">uptime: {Math.round(status?.uptimeSec ?? 0)}s</p>
        </article>

        <article className="card">
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

        <article className="card">
          <h3>Project / Model</h3>
          <p className="value">{currentSession?.projectPath ?? '(sin proyecto)'}</p>
          <p className="muted">
            {provider} / {model}
          </p>
        </article>

        <article className="card">
          <h3>Approvals</h3>
          <p className={`value ${pendingApprovals > 0 ? 'warn' : 'ok'}`}>{pendingApprovals}</p>
          <p className="muted">pendientes</p>
          <p className="muted">actives: {status?.activeSessions ?? 0}</p>
        </article>
      </div>

      <div className="actions-row">
        <button onClick={onOpenSession}>Abrir sesión actual</button>
        <button onClick={onOpenApprovals}>Ver approvals</button>
        <button onClick={onOpenProjects}>Ver proyectos</button>
      </div>
    </section>
  )
}
