import { useCallback, useEffect, useState } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { NavRail } from '@renderer/components/NavRail'
import { Wizard } from '@renderer/wizard/Wizard'
import { TodayPane } from '@renderer/today/TodayPane'
import { SettingsPane } from '@renderer/settings/SettingsPane'
import { todayLocalDate } from '@renderer/today/dateUtils'
import type { AppInfo } from '@shared/ipc'

function HistoryPane() {
  return (
    <div className="flex h-full items-center justify-center text-muted-foreground">
      History — coming soon
    </div>
  )
}

type GateState = 'loading' | 'wizard' | 'app'

export function App() {
  const [gate, setGate] = useState<GateState>('loading')
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null)

  const refreshGate = useCallback(async () => {
    const complete = await window.api.isSetupComplete()
    setGate(complete ? 'app' : 'wizard')
  }, [])

  // Stable identity — Wizard passes this through to Step3Rubrics as a
  // useEffect dep; an inline lambda would re-fire the effect on every App
  // re-render and double-call generateRubrics().
  const onWizardDone = useCallback(() => {
    void refreshGate()
  }, [refreshGate])

  useEffect(() => {
    void refreshGate()
    void window.api.getAppInfo().then(setAppInfo)
  }, [refreshGate])

  if (gate === 'loading') {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background text-muted-foreground">
        Loading…
      </div>
    )
  }

  if (gate === 'wizard') {
    return <Wizard onDone={onWizardDone} />
  }

  return (
    <HashRouter>
      <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
        <NavRail />
        <main className="flex-1 overflow-auto">
          <Routes>
            <Route path="/" element={<Navigate to={`/day/${todayLocalDate()}`} replace />} />
            <Route path="/day/:date" element={<TodayPane />} />
            <Route path="/history" element={<HistoryPane />} />
            <Route path="/settings" element={<SettingsPane />} />
          </Routes>
        </main>
        {appInfo && (
          <div className="fixed bottom-2 right-2 text-xs text-muted-foreground opacity-50">
            v{appInfo.version}
          </div>
        )}
      </div>
    </HashRouter>
  )
}
