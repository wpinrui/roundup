import { useEffect, useState } from 'react'
import { HashRouter, Routes, Route } from 'react-router-dom'
import { NavRail } from '@renderer/components/NavRail'
import { Button } from '@renderer/components/ui/button'
import type { AppInfo } from '@shared/ipc'

function TodayPane() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 text-muted-foreground">
      <span>Today — coming soon</span>
      <Button variant="outline" disabled>
        New entry
      </Button>
    </div>
  )
}

function HistoryPane() {
  return (
    <div className="flex h-full items-center justify-center text-muted-foreground">
      History — coming soon
    </div>
  )
}

function SettingsPane() {
  return (
    <div className="flex h-full items-center justify-center text-muted-foreground">
      Settings — coming soon
    </div>
  )
}

export function App() {
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null)

  useEffect(() => {
    window.api.getAppInfo().then(setAppInfo)
  }, [])

  return (
    <HashRouter>
      <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
        <NavRail />
        <main className="flex-1 overflow-auto">
          <Routes>
            <Route path="/" element={<TodayPane />} />
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
