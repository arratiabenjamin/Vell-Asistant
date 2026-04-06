import type { AgentRunSnapshot, Session, SubAgentRole } from '@forge/shared'
import { Badge, EmptyState, StatCard } from '../components/ui'
import { formatDateTime, shortId, truncate } from '../utils'

const AGENT_CATALOG: Array<{ role: SubAgentRole; specialty: string; scope: string }> = [
  {
    role: 'planning-agent',
    specialty: 'descomposición de objetivos y estrategia de ejecución',
    scope: 'divide el problema antes de actuar'
  },
  {
    role: 'research-agent',
    specialty: 'investigación, contraste y señales de mercado',
    scope: 'reúne evidencia y riesgos'
  },
  {
    role: 'documentation-agent',
    specialty: 'síntesis técnica y documentación accionable',
    scope: 'ordena hallazgos y decisiones'
  },
  {
    role: 'marketing-agent',
    specialty: 'análisis comercial, posicionamiento y GTM',
    scope: 'convierte el trabajo en propuesta de valor'
  },
  {
    role: 'coding-agent',
    specialty: 'implementación técnica, debugging y calidad',
    scope: 'traduce análisis en ejecución'
  }
]

type AgentsScreenProps = {
  currentSession: Session | null
  snapshot: AgentRunSnapshot | null
  activeAgentRuns: number
  busy: boolean
  onRefresh: () => Promise<void>
}

function agentStatusTone(status: string): 'neutral' | 'success' | 'warning' | 'danger' | 'info' {
  if (status === 'completed') return 'success'
  if (status === 'failed') return 'danger'
  if (status === 'running') return 'warning'
  if (status === 'idle') return 'neutral'
  return 'info'
}

export function AgentsScreen({ currentSession, snapshot, activeAgentRuns, busy, onRefresh }: AgentsScreenProps) {
  return (
    <section className="screen">
      <div className="section-header">
        <div>
          <p className="eyebrow">Delegation workspace</p>
          <h2>Agents</h2>
          <p className="muted">
            Vell sigue siendo el orquestador central. Esta vista muestra la base de multi-agentes supervisados.
          </p>
        </div>

        <div className="actions-row wrap">
          <Badge tone="info">orchestrator: Vell</Badge>
          <Badge tone={activeAgentRuns > 0 ? 'warning' : 'success'}>{activeAgentRuns} active runs</Badge>
          <button onClick={() => void onRefresh()} disabled={busy}>
            Refresh
          </button>
        </div>
      </div>

      <div className="stats-grid">
        <StatCard
          title="Orchestrator"
          value="Vell"
          caption="coordina, delega, espera y consolida"
          tone="info"
        />
        <StatCard
          title="Active runs"
          value={activeAgentRuns}
          caption="delegaciones en ejecución"
          tone={activeAgentRuns > 0 ? 'warning' : 'success'}
        />
      </div>

      <article className="card soft-card">
        <div className="row-space">
          <div>
            <p className="eyebrow">Agent catalog</p>
            <h3>Specialized roles</h3>
          </div>
          <Badge tone="neutral">{AGENT_CATALOG.length} roles</Badge>
        </div>

        <div className="agent-grid catalog">
          {AGENT_CATALOG.map(agent => (
            <article className="agent-card catalog-card" key={agent.role}>
              <div className="row-space">
                <strong>{agent.role}</strong>
                <Badge tone="info">available</Badge>
              </div>
              <p className="muted">{agent.specialty}</p>
              <p className="muted">{agent.scope}</p>
            </article>
          ))}
        </div>
      </article>

      <article className="card soft-card">
        <div className="row-space">
          <div>
            <p className="eyebrow">Current session</p>
            <h3>Delegation run</h3>
          </div>
          {currentSession ? <Badge tone="neutral">{shortId(currentSession.id)}</Badge> : <Badge tone="neutral">no session</Badge>}
        </div>

        {!currentSession ? (
          <EmptyState title="No hay sesión activa" description="Abrí o creá una sesión para ver actividad multi-agente." />
        ) : !snapshot ? (
          <EmptyState
            title="Sin delegación todavía"
            description="Vell no arrancó un run de multi-agente en la sesión actual."
          />
        ) : (
          <>
            <div className="actions-row wrap">
              <Badge tone={agentStatusTone(snapshot.status)}>{snapshot.status}</Badge>
              <Badge tone="info">run {snapshot.runId}</Badge>
              <Badge tone="neutral">{snapshot.agents.length} subagents</Badge>
            </div>

            <p className="muted">{truncate(snapshot.goal, 320)}</p>

            <div className="list-stack">
              {snapshot.agents.map(agent => (
                <article key={agent.id} className="agent-card nested">
                  <div className="row-space">
                    <strong>{agent.role}</strong>
                    <Badge tone={agentStatusTone(agent.status)}>{agent.status}</Badge>
                  </div>
                  <p className="muted">{agent.specialty}</p>
                  <p>
                    <strong>Input</strong>
                  </p>
                  <p className="muted">{truncate(agent.inputSummary || '(sin input)', 200)}</p>
                  <p>
                    <strong>Output</strong>
                  </p>
                  <p className="muted">{agent.outputSummary ? truncate(agent.outputSummary, 280) : '(sin output)'}</p>
                  {agent.error ? <p className="error">{agent.error}</p> : null}
                  <p className="muted">
                    start: {agent.startedAt ? formatDateTime(agent.startedAt) : '-'} · finish:{' '}
                    {agent.finishedAt ? formatDateTime(agent.finishedAt) : '-'}
                  </p>
                </article>
              ))}
            </div>

            {snapshot.finalSummary ? (
              <div className="stream-box subtle">
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
