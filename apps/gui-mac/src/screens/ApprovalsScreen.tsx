import type { Approval } from '@forge/shared'
import { formatDateTime, shortId, summarizeUnknown } from '../utils'
import { Badge, EmptyState } from '../components/ui'

type ApprovalsScreenProps = {
  approvals: Approval[]
  busy: boolean
  onApprove: (approvalId: string) => Promise<void>
  onReject: (approvalId: string) => Promise<void>
  onRefresh: () => Promise<void>
}

export function ApprovalsScreen({ approvals, busy, onApprove, onReject, onRefresh }: ApprovalsScreenProps) {
  const pending = approvals.filter(item => item.status === 'pending')

  return (
    <section className="screen">
      <div className="section-header">
        <div>
          <h2>Approvals</h2>
          <p className="muted">Acciones sensibles pendientes de confirmación.</p>
        </div>
        <div className="actions-row wrap">
          <Badge tone={pending.length > 0 ? 'warning' : 'success'}>{pending.length} pending</Badge>
          <button onClick={() => void onRefresh()} disabled={busy}>
            Refresh
          </button>
        </div>
      </div>

      {pending.length === 0 ? (
        <EmptyState title="Todo al día" description="No hay approvals pendientes." />
      ) : (
        <div className="list-stack">
          {pending.map(approval => (
            <article key={approval.id} className="card">
              <div className="card-title-row wrap">
                <p>
                  <strong>{approval.name}</strong> · {approval.kind}
                </p>
                <Badge tone="warning">pending</Badge>
              </div>

              <p className="muted">
                id {shortId(approval.id)} · session {shortId(approval.sessionId)} · {formatDateTime(approval.createdAt)}
              </p>
              <p className="muted">payload: {summarizeUnknown(approval.payload, 260)}</p>

              <div className="actions-row wrap">
                <button onClick={() => void onApprove(approval.id)} disabled={busy}>
                  Approve
                </button>
                <button className="danger" onClick={() => void onReject(approval.id)} disabled={busy}>
                  Reject
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
