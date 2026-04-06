import type { AgentRunSnapshot, SubAgentRole } from '@forge/shared'
import type { Session } from '@forge/shared'
import { formatDateTime, shortId, truncate } from '../utils'

const AGENT_CATALOG: Array<{ role: SubAgentRole; specialty: string }> = [
  { role: 'planning-agent', specialty: 'descomposición de objetivos y estrategia de ejecución' },
  { role: 'research-agent', specialty: 'investigación, contraste y señales de mercado' },
  { role: 'documentation-agent', specialty: 'síntesis técnica y documentación accionable' },
  { role: 'marketing-agent', specialty: 'análisis comercial, posicionamiento y GTM' },
  { role: 'coding-agent', specialty: 'implementación técnica, debugging y calidad' }
]

type AgentsScreenProps = {
  currentSession: Session | null
  snapshot: AgentRunSnapshot | null
  activeAgentRuns: number
  busy: boolean
  onRefresh: () => Promise<void>
}

function agentStatusClass(status: string): string {
  if (status === 'completed') return 'badge ok'
  if (status === 'failed') return 'badge error'
  if (status === 'running') return 'badge warn'
  return 'badge'
}

export function AgentsScreen({
  currentSession,
  snapshot,
  activeAgentRuns,
  busy,
  onRefresh
}: AgentsScreenProps) {
  return (
    <section className="screen">
      <div className="section-header">
        <h2>Agents</h2>
        <div className="actions-row">
          <button onClick={() => void onRefresh()} disabled={busy}>
            Refresh
          </button>
        </div>
      </div>

      <div className="stats-grid">
        <article className="card compact">
          <h3>Orchestrator</h3>
          <p className="value">Vell</p>
          <p className="muted">Entidad principal de coordinación</p>
        </article>

        <article className="card compact">
          <h3>Active runs</h3>
          <p className={`value ${activeAgentRuns > 0 ? 'warn' : 'ok'}`}>{activeAgentRuns}</p>
          <p className="muted">delegaciones en ejecución</p>
        </article>
      </div>

      <article className="card">
        <h3>Agent catalog</h3>
        <div className="list-stack">
          {AGENT_CATALOG.map(agent => (
            <div className="row-space" key={agent.role}>
              <div>
                <strong>{agent.role}</strong>
                <p className="muted">{agent.specialty}</p>
              </div>
              <span className="badge">available</span>
            </div>
          ))}
        </div>
      </article>

      <article className="card">
        <h3>Current session run</h3>
        {!currentSession ? (
          <p className="muted">No hay sesión activa.</p>
        ) : !snapshot ? (
          <p className="muted">Aún no hubo delegación en esta sesión.</p>
        ) : (
          <>
            <p>
              <strong>Session:</strong> {shortId(currentSession.id)} · {currentSession.title ?? '(sin título)'}
            </p>
            <p>
              <strong>Run:</strong> {snapshot.runId} · <span className={agentStatusClass(snapshot.status)}>{snapshot.status}</span>
            </p>
            <p className="muted">{truncate(snapshot.goal, 320)}</p>

            <div className="list-stack">
              {snapshot.agents.map(agent => (
                <article key={agent.id} className="card nested">
                  <div className="row-space">
                    <strong>{agent.role}</strong>
                    <span className={agentStatusClass(agent.status)}>{agent.status}</span>
                  </div>
                  <p className="muted">{agent.specialty}</p>
                  <p>
                    <strong>Input:</strong> {truncate(agent.inputSummary, 180)}
                  </p>
                  <p>
                    <strong>Output:</strong> {agent.outputSummary ? truncate(agent.outputSummary, 260) : '(sin output)'}
                  </p>
                  {agent.error ? <p className="error">{agent.error}</p> : null}
                  <p className="muted">
                    start: {agent.startedAt ? formatDateTime(agent.startedAt) : '-'} · finish:{' '}
                    {agent.finishedAt ? formatDateTime(agent.finishedAt) : '-'}
                  </p>
                </article>
              ))}
            </div>

            {snapshot.finalSummary ? (
              <div className="stream-box">
                <strong>Vell final summary</strong>
                <p>{truncate(snapshot.finalSummary, 360)}</p>
              </div>
            ) : null}
          </>
        )}
      </article>
    </section>
  )
}
