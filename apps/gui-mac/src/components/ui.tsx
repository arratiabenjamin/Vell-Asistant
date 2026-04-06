import type { ReactNode } from 'react'

type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info'

export function Badge({ tone = 'neutral', children }: { tone?: BadgeTone; children: ReactNode }) {
  return <span className={`badge badge-${tone}`}>{children}</span>
}

export function EmptyState({
  title,
  description,
  action
}: {
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="empty-state card">
      <h4>{title}</h4>
      <p className="muted">{description}</p>
      {action ? <div className="actions-row">{action}</div> : null}
    </div>
  )
}

export function StatCard({
  title,
  value,
  caption,
  tone = 'neutral',
  extra
}: {
  title: string
  value: ReactNode
  caption?: ReactNode
  tone?: BadgeTone
  extra?: ReactNode
}) {
  return (
    <article className="card stat-card">
      <div className="card-title-row">
        <h3>{title}</h3>
        {extra}
      </div>
      <p className={`value tone-${tone}`}>{value}</p>
      {caption ? <p className="muted">{caption}</p> : null}
    </article>
  )
}
