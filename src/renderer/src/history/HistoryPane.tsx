import { useEffect, useMemo, useState } from 'react'
import type { DayRow, VizToggleState } from '@shared/ipc'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@renderer/components/ui/tabs'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { todayLocalDate } from '@renderer/today/dateUtils'
import { daysAgo, daysBetween, formatRangeLabel } from './historyDateUtils'
import { Heatmap } from './charts/Heatmap'
import { StackedArea } from './charts/StackedArea'
import { Radar } from './charts/Radar'
import { ActivityRibbon } from './charts/ActivityRibbon'
import { GapFromGoal } from './charts/GapFromGoal'
import { StreakCounters } from './charts/StreakCounters'
import { AnomalyCards } from './charts/AnomalyCards'
import { PastDayModal } from './PastDayModal'

type TabKey = 'past7' | 'past30' | 'custom'

const CUSTOM_MIN_DAYS = 1
const CUSTOM_MAX_DAYS = 365
const CUSTOM_DEFAULT_DAYS = 30

export function HistoryPane() {
  const today = todayLocalDate()
  const [tab, setTab] = useState<TabKey>('past7')
  const [customStart, setCustomStart] = useState<string>(daysAgo(CUSTOM_DEFAULT_DAYS - 1, today))
  const [customEnd, setCustomEnd] = useState<string>(today)
  const [appliedRange, setAppliedRange] = useState<{ start: string; end: string }>({
    start: customStart,
    end: customEnd,
  })

  const { start, end, windowLength, bucketWeekly } = useMemo(() => {
    if (tab === 'past7') {
      const s = daysAgo(6, today)
      return { start: s, end: today, windowLength: 7, bucketWeekly: false }
    }
    if (tab === 'past30') {
      const s = daysAgo(29, today)
      return { start: s, end: today, windowLength: 30, bucketWeekly: true }
    }
    const len = daysBetween(appliedRange.start, appliedRange.end) + 1
    return {
      start: appliedRange.start,
      end: appliedRange.end,
      windowLength: len,
      bucketWeekly: len > 14,
    }
  }, [tab, today, appliedRange])

  const [days, setDays] = useState<DayRow[] | null>(null)
  const [toggles, setToggles] = useState<VizToggleState | null>(null)
  const [modalDate, setModalDate] = useState<string | null>(null)
  const [rangeError, setRangeError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setDays(null)
    void (async () => {
      const rows = await window.api.getDaysInRange(start, end)
      if (cancelled) return
      setDays(rows)
    })()
    return () => {
      cancelled = true
    }
  }, [start, end])

  useEffect(() => {
    void (async () => {
      const t = await window.api.getVizToggles()
      setToggles(t)
    })()
  }, [])

  function applyCustom() {
    setRangeError(null)
    if (customStart > customEnd) {
      setRangeError('Start date must be on or before end date.')
      return
    }
    const len = daysBetween(customStart, customEnd) + 1
    if (len < CUSTOM_MIN_DAYS) {
      setRangeError('Range must include at least 1 day.')
      return
    }
    if (len > CUSTOM_MAX_DAYS) {
      setRangeError(`Range capped at ${CUSTOM_MAX_DAYS} days.`)
      return
    }
    setAppliedRange({ start: customStart, end: customEnd })
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col px-8 py-10" data-testid="history-pane">
      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">History</h1>
        <p className="mt-1 text-sm text-muted-foreground">{formatRangeLabel(start, end)}</p>
      </header>

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
        <TabsList>
          <TabsTrigger value="past7" data-testid="tab-past7">
            Past 7
          </TabsTrigger>
          <TabsTrigger value="past30" data-testid="tab-past30">
            Past 30
          </TabsTrigger>
          <TabsTrigger value="custom" data-testid="tab-custom">
            Custom
          </TabsTrigger>
        </TabsList>

        <TabsContent value="past7">
          {renderViz()}
        </TabsContent>
        <TabsContent value="past30">
          {renderViz()}
        </TabsContent>
        <TabsContent value="custom">
          <div className="mb-4 flex flex-wrap items-end gap-3 rounded-card bg-secondary p-4 shadow-warm">
            <div>
              <label className="mb-1 block text-xs text-muted-foreground" htmlFor="custom-start">
                Start
              </label>
              <Input
                id="custom-start"
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                data-testid="custom-start"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground" htmlFor="custom-end">
                End
              </label>
              <Input
                id="custom-end"
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                data-testid="custom-end"
              />
            </div>
            <Button
              onClick={applyCustom}
              className="bg-warm-gradient text-white shadow-warm-glow hover:opacity-90"
              data-testid="custom-apply"
            >
              Apply
            </Button>
            {rangeError && (
              <p className="text-sm text-red-600" data-testid="custom-range-error">
                {rangeError}
              </p>
            )}
          </div>
          {renderViz()}
        </TabsContent>
      </Tabs>

      <PastDayModal date={modalDate} onClose={() => setModalDate(null)} />
    </div>
  )

  function renderViz() {
    if (days === null || toggles === null) {
      return <p className="text-sm text-muted-foreground">Loading…</p>
    }
    const blocks: JSX.Element[] = []
    if (toggles.heatmap) blocks.push(<Heatmap key="hm" days={days} onPickDate={setModalDate} />)
    if (toggles.stackedArea)
      blocks.push(<StackedArea key="sa" days={days} bucketWeekly={bucketWeekly} />)
    if (toggles.radar) blocks.push(<Radar key="rd" days={days} />)
    if (toggles.ribbon)
      blocks.push(<ActivityRibbon key="rb" days={days} onPickDate={setModalDate} />)
    if (toggles.gapFromGoal) blocks.push(<GapFromGoal key="gg" days={days} />)
    if (toggles.streaks)
      blocks.push(<StreakCounters key="st" days={days} windowLength={windowLength} />)
    if (toggles.anomaly)
      blocks.push(<AnomalyCards key="an" days={days} onPickDate={setModalDate} />)
    if (blocks.length === 0) {
      return (
        <p className="text-sm text-muted-foreground" data-testid="no-viz-enabled">
          All visualisations are turned off in Settings.
        </p>
      )
    }
    return <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">{blocks}</div>
  }
}
