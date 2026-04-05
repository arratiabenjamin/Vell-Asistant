import { useState } from 'react'
import type { Project, Session } from '@forge/shared'
import { formatDateTime, shortId, truncate } from '../utils'

type ProjectsScreenProps = {
  projects: Project[]
  currentSession: Session | null
  busy: boolean
  onRefresh: () => Promise<void>
  onOpenProject: (projectPath: string, mode: 'current' | 'new') => Promise<void>
}

export function ProjectsScreen({
  projects,
  currentSession,
  busy,
  onRefresh,
  onOpenProject
}: ProjectsScreenProps) {
  const [manualPath, setManualPath] = useState('')

  return (
    <section className="screen">
      <div className="section-header">
        <h2>Projects</h2>
        <div className="actions-row">
          <button onClick={() => void onRefresh()} disabled={busy}>
            Refresh
          </button>
        </div>
      </div>

      <div className="card">
        <p>
          <strong>Current session:</strong> {currentSession ? `${shortId(currentSession.id)} · ${currentSession.title ?? '(sin título)'}` : 'none'}
        </p>
        <p>
          <strong>Current project:</strong> {currentSession?.projectPath ?? '(sin proyecto)'}
        </p>
      </div>

      <div className="card">
        <h3>Abrir path manual</h3>
        <div className="actions-row wrap">
          <input
            type="text"
            value={manualPath}
            onChange={event => setManualPath(event.target.value)}
            placeholder="/ruta/al/proyecto"
          />
          <button
            onClick={() => {
              const value = manualPath.trim()
              if (!value) return
              void onOpenProject(value, 'current')
            }}
            disabled={busy || manualPath.trim().length === 0}
          >
            Usar en sesión actual
          </button>
          <button
            onClick={() => {
              const value = manualPath.trim()
              if (!value) return
              void onOpenProject(value, 'new')
            }}
            disabled={busy || manualPath.trim().length === 0}
          >
            Nueva sesión + proyecto
          </button>
        </div>
      </div>

      <h3>Proyectos recientes</h3>
      {projects.length === 0 ? (
        <div className="card">
          <p className="muted">No hay proyectos recientes.</p>
        </div>
      ) : (
        <div className="list-stack">
          {projects.map(project => (
            <article key={project.id} className="card">
              <p>
                <strong>{project.name}</strong>
              </p>
              <p className="muted">{truncate(project.path, 160)}</p>
              <p className="muted">last opened: {formatDateTime(project.lastOpenedAt)}</p>
              <div className="actions-row">
                <button onClick={() => void onOpenProject(project.path, 'current')} disabled={busy}>
                  Usar en sesión actual
                </button>
                <button onClick={() => void onOpenProject(project.path, 'new')} disabled={busy}>
                  Nueva sesión
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
