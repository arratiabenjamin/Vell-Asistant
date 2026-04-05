import type { Approval } from '@forge/shared'
import { formatDateTime, shortId, summarizeUnknown } from '../utils'

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
        <h2>Approvals</h2>
        <div className="actions-row">
          <button onClick={() => void onRefresh()} disabled={busy}>
            Refresh
          </button>
        </div>
      </div>

      <p className="muted">
        Pendientes: <strong>{pending.length}</strong> · Totales: <strong>{approvals.length}</strong>
      </p>

      {pending.length === 0 ? (
        <div className="card">
          <p className="muted">No hay approvals pendientes.</p>
        </div>
      ) : (
        <div className="list-stack">
          {pending.map(approval => (
            <article key={approval.id} className="card">
              <p>
                <strong>{approval.name}</strong> · {approval.kind}
              </p>
              <p className="muted">
                id {shortId(approval.id)} · session {shortId(approval.sessionId)} · {formatDateTime(approval.createdAt)}
              </p>
              <p className="muted">payload: {summarizeUnknown(approval.payload, 260)}</p>

              <div className="actions-row">
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
