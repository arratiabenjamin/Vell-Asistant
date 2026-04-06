import { useMemo, useState } from 'react'
import { Sidebar, type ViewId } from './components/Sidebar'
import { useForgeDaemon } from './hooks/useForgeDaemon'
import { AgentsScreen } from './screens/AgentsScreen'
import { ApprovalsScreen } from './screens/ApprovalsScreen'
import { CurrentSessionScreen } from './screens/CurrentSessionScreen'
import { DashboardScreen } from './screens/DashboardScreen'
import { ProjectsScreen } from './screens/ProjectsScreen'
import { SettingsScreen } from './screens/SettingsScreen'
import { shortId, truncate } from './utils'

function statusClass(connected: boolean): string {
  return connected ? 'badge ok' : 'badge error'
}

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
    openAIAuthStatus,
    events,
    currentSessionAgentActivity,
    activeAgentRuns,
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
    updateSetting,
    setOpenAIApiKey,
    setOpenAIAuthMode,
    verifyOpenAIApiKey
  } = useForgeDaemon()

  const headerModel = `${currentSessionRecord?.provider ?? status?.defaultProvider ?? '-'} / ${
    currentSessionRecord?.model ?? 'default'
  }`

  const recentDelegationEvents = useMemo(
    () =>
      events
        .filter(event => event.type.startsWith('agent.') && event.sessionId === currentSessionRecord?.id)
        .slice(-8),
    [currentSessionRecord?.id, events]
  )

  const pendingCount = pendingApprovals.length

  const currentScreen = useMemo(() => {
    if (view === 'dashboard') {
      return (
        <DashboardScreen
          connected={connected}
          status={status}
          currentSession={currentSessionRecord}
          currentAgentActivity={currentSessionAgentActivity}
          recentDelegationEvents={recentDelegationEvents}
          pendingApprovals={pendingCount}
          onOpenSession={() => setView('session')}
          onOpenApprovals={() => setView('approvals')}
          onOpenProjects={() => setView('projects')}
          onOpenAgents={() => setView('agents')}
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
          agentActivity={currentSessionAgentActivity}
          onCreateSession={createSession}
          onSwitchSession={setCurrentSessionById}
          onSubmitPrompt={submitPrompt}
          onResumeLatest={resumeLatestSession}
          onRefresh={refreshSnapshot}
          onOpenAgents={() => setView('agents')}
        />
      )
    }

    if (view === 'agents') {
      return (
        <AgentsScreen
          currentSession={currentSessionRecord}
          snapshot={currentSessionAgentActivity}
          activeAgentRuns={activeAgentRuns}
          busy={busy}
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
        openAIAuthStatus={openAIAuthStatus}
        currentSession={currentSessionRecord}
        sessionState={sessionState}
        busy={busy}
        onRefresh={refreshSnapshot}
        onUpdateSetting={updateSetting}
        onSetOpenAIApiKey={setOpenAIApiKey}
        onSetOpenAIAuthMode={setOpenAIAuthMode}
        onVerifyOpenAIApiKey={verifyOpenAIApiKey}
      />
    )
  }, [
    activeAgentRuns,
    approvals,
    approve,
    busy,
    connected,
    createSession,
    currentSession,
    currentSessionAgentActivity,
    currentSessionRecord,
    events,
    recentDelegationEvents,
    openProject,
    openAIAuthStatus,
    pendingCount,
    projects,
    refreshSnapshot,
    reject,
    resumeLatestSession,
    sessions,
    sessionState,
    setCurrentSessionById,
    setOpenAIApiKey,
    setOpenAIAuthMode,
    settingMap,
    status,
    streamingText,
    submitPrompt,
    updateSetting,
    verifyOpenAIApiKey,
    view
  ])

  return (
    <div className="app-shell">
      <Sidebar current={view} onChange={setView} />

      <main className="main-area">
        <header className="top-header vell-header">
          <div>
            <p className="eyebrow">Daemon</p>
            <p>
              <span className={statusClass(connected)}>{connected ? 'online' : 'offline'}</span>{' '}
              <span className="badge info">uptime {Math.round(status?.uptimeSec ?? 0)}s</span>
            </p>
            <p className="muted">{daemonUrl}</p>
          </div>

          <div>
            <p className="eyebrow">Session</p>
            <p>
              <strong>{shortId(currentSessionRecord?.id)}</strong>{' '}
              <span className="badge neutral">{currentSessionRecord?.title ?? 'sin sesión activa'}</span>
            </p>
            <p className="muted">Current orchestration entrypoint</p>
          </div>

          <div>
            <p className="eyebrow">Project</p>
            <p>
              <strong>{truncate(currentSessionRecord?.projectPath ?? '(sin proyecto)', 56)}</strong>
            </p>
            <p className="muted">Model: {headerModel}</p>
          </div>

          <div>
            <p className="eyebrow">Approvals / Agents</p>
            <p>
              <span className={`badge ${pendingCount > 0 ? 'warn' : 'ok'}`}>approvals: {pendingCount}</span>
              <span className={`badge ${activeAgentRuns > 0 ? 'warn' : 'ok'}`}>agents: {activeAgentRuns}</span>
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
