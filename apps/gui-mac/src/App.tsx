import { useMemo, useState } from 'react'
import { Sidebar, type ViewId } from './components/Sidebar'
import { useForgeDaemon } from './hooks/useForgeDaemon'
import { ApprovalsScreen } from './screens/ApprovalsScreen'
import { CurrentSessionScreen } from './screens/CurrentSessionScreen'
import { DashboardScreen } from './screens/DashboardScreen'
import { ProjectsScreen } from './screens/ProjectsScreen'
import { SettingsScreen } from './screens/SettingsScreen'
import { shortId, truncate } from './utils'

export default function App() {
  const [view, setView] = useState<ViewId>('dashboard')

  const {
    daemonUrl,
    connected,
    status,
    sessions,
    currentSession,
    currentSessionRecord,
    projects,
    approvals,
    pendingApprovals,
    settingMap,
    events,
    streamingText,
    sessionState,
    error,
    busy,
    clearError,
    refreshSnapshot,
    setCurrentSessionById,
    resumeLatestSession,
    createSession,
    submitPrompt,
    approve,
    reject,
    openProject,
    updateSetting
  } = useForgeDaemon()

  const headerModel = `${currentSessionRecord?.provider ?? status?.defaultProvider ?? '-'} / ${
    currentSessionRecord?.model ?? 'default'
  }`

  const pendingCount = pendingApprovals.length

  const currentScreen = useMemo(() => {
    if (view === 'dashboard') {
      return (
        <DashboardScreen
          connected={connected}
          status={status}
          currentSession={currentSessionRecord}
          pendingApprovals={pendingCount}
          onOpenSession={() => setView('session')}
          onOpenApprovals={() => setView('approvals')}
          onOpenProjects={() => setView('projects')}
        />
      )
    }

    if (view === 'session') {
      return (
        <CurrentSessionScreen
          session={currentSession}
          sessions={sessions}
          streamingText={streamingText}
          busy={busy}
          sessionState={sessionState}
          events={events}
          onCreateSession={createSession}
          onSwitchSession={setCurrentSessionById}
          onSubmitPrompt={submitPrompt}
          onResumeLatest={resumeLatestSession}
          onRefresh={refreshSnapshot}
        />
      )
    }

    if (view === 'approvals') {
      return (
        <ApprovalsScreen
          approvals={approvals}
          busy={busy}
          onApprove={approve}
          onReject={reject}
          onRefresh={refreshSnapshot}
        />
      )
    }

    if (view === 'projects') {
      return (
        <ProjectsScreen
          projects={projects}
          currentSession={currentSessionRecord}
          busy={busy}
          onRefresh={refreshSnapshot}
          onOpenProject={openProject}
        />
      )
    }

    return (
      <SettingsScreen
        settingMap={settingMap}
        status={status}
        currentSession={currentSessionRecord}
        sessionState={sessionState}
        busy={busy}
        onRefresh={refreshSnapshot}
        onUpdateSetting={updateSetting}
      />
    )
  }, [
    approvals,
    approve,
    busy,
    connected,
    currentSession,
    currentSessionRecord,
    events,
    openProject,
    pendingCount,
    projects,
    refreshSnapshot,
    reject,
    resumeLatestSession,
    sessions,
    sessionState,
    setCurrentSessionById,
    settingMap,
    status,
    streamingText,
    createSession,
    submitPrompt,
    updateSetting,
    view
  ])

  return (
    <div className="app-shell">
      <Sidebar current={view} onChange={setView} />

      <main className="main-area">
        <header className="top-header">
          <div>
            <p>
              Daemon: <strong className={connected ? 'ok' : 'error'}>{connected ? 'online' : 'offline'}</strong>
            </p>
            <p className="muted">{daemonUrl}</p>
          </div>

          <div>
            <p>
              Session: <strong>{shortId(currentSessionRecord?.id)}</strong>
            </p>
            <p className="muted">{currentSessionRecord?.title ?? '(sin sesión activa)'}</p>
          </div>

          <div>
            <p>
              Project: <strong>{truncate(currentSessionRecord?.projectPath ?? '(sin proyecto)', 56)}</strong>
            </p>
            <p className="muted">Model: {headerModel}</p>
          </div>

          <div>
            <p>
              Pending approvals: <strong className={pendingCount > 0 ? 'warn' : 'ok'}>{pendingCount}</strong>
            </p>
            <p className="muted">Mode: {status?.currentMode ?? '-'}</p>
          </div>
        </header>

        {error ? (
          <div className="error-banner">
            <p>{error}</p>
            <button onClick={clearError}>Dismiss</button>
          </div>
        ) : null}

        {currentScreen}
      </main>
    </div>
  )
}
