export type ViewId = 'dashboard' | 'session' | 'approvals' | 'projects' | 'settings'

const ITEMS: Array<{ id: ViewId; label: string }> = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'session', label: 'Current Session' },
  { id: 'approvals', label: 'Approvals' },
  { id: 'projects', label: 'Projects' },
  { id: 'settings', label: 'Settings' }
]

type SidebarProps = {
  current: ViewId
  onChange: (view: ViewId) => void
}

export function Sidebar({ current, onChange }: SidebarProps) {
  return (
    <aside className="sidebar">
      <h1>Forge</h1>
      <nav>
        {ITEMS.map(item => (
          <button
            key={item.id}
            className={current === item.id ? 'nav-item active' : 'nav-item'}
            onClick={() => onChange(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>
    </aside>
  )
}
