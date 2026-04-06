export type ViewId = 'dashboard' | 'session' | 'agents' | 'approvals' | 'projects' | 'settings'

const ITEMS: Array<{ id: ViewId; label: string; hint: string }> = [
  { id: 'dashboard', label: 'Dashboard', hint: 'overview' },
  { id: 'session', label: 'Current Session', hint: 'chat + tools' },
  { id: 'agents', label: 'Agents', hint: 'Vell orchestration' },
  { id: 'approvals', label: 'Approvals', hint: 'pending actions' },
  { id: 'projects', label: 'Projects', hint: 'context roots' },
  { id: 'settings', label: 'Settings', hint: 'provider + policy' }
]

type SidebarProps = {
  current: ViewId
  onChange: (view: ViewId) => void
}

export function Sidebar({ current, onChange }: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="brand-block">
        <p className="brand-kicker">Vell Assistant</p>
        <h1>Forge GUI</h1>
        <p className="muted">terminal-first engine • mac shell</p>
      </div>
      <nav>
        {ITEMS.map(item => (
          <button
            key={item.id}
            className={current === item.id ? 'nav-item active' : 'nav-item'}
            onClick={() => onChange(item.id)}
          >
            <span>{item.label}</span>
            <small className="muted">{item.hint}</small>
          </button>
        ))}
      </nav>
    </aside>
  )
}
