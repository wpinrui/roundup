import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { DayRow, DaySummary } from '@shared/ipc'
import { DayHeader } from './DayHeader'
import { DayInputForm } from './DayInputForm'
import { DayReadout } from './DayReadout'
import { buildDateBounds, isValidIsoDate, neighborDates, todayLocalDate } from './dateUtils'

type ViewMode = 'view' | 'edit'

/**
 * Date-parameterised day view. URL: /day/:date.
 *
 * State machine (driven by the day row + viewMode):
 *  - no row, viewMode any → empty input form
 *  - row + ungraded, viewMode any → editable input + Save + Grade buttons
 *  - row + graded, viewMode='view' → readout + "Edit entry" link
 *  - row + graded, viewMode='edit' → editable input + Save + Re-grade
 */
export function TodayPane() {
  const navigate = useNavigate()
  const { date: paramDate } = useParams<{ date: string }>()
  const today = todayLocalDate()
  const date = paramDate ?? today

  const [row, setRow] = useState<DayRow | null>(null)
  const [bounds, setBounds] = useState<string[]>([today])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [grading, setGrading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('view')

  // Validate the URL date and bounce to today if it's malformed.
  useEffect(() => {
    if (!isValidIsoDate(date)) {
      navigate(`/day/${today}`, { replace: true })
    }
  }, [date, today, navigate])

  const refreshBounds = useCallback(async () => {
    const summaries: DaySummary[] = await window.api.listDays()
    setBounds(buildDateBounds(summaries.map((s) => s.date), today))
  }, [today])

  const reloadDay = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const r = await window.api.getDay(date)
      setRow(r)
      // Whenever we land on a freshly-loaded day, default back to view mode.
      setViewMode('view')
    } finally {
      setLoading(false)
    }
  }, [date])

  useEffect(() => {
    void reloadDay()
    void refreshBounds()
  }, [reloadDay, refreshBounds])

  const handleSave = useCallback(
    async (text: string) => {
      if (!isValidIsoDate(date)) return
      setSaving(true)
      setError(null)
      try {
        const updated = await window.api.saveDayText(date, text)
        setRow(updated)
        await refreshBounds()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save.')
      } finally {
        setSaving(false)
      }
    },
    [date, refreshBounds]
  )

  const handleGrade = useCallback(async () => {
    if (!isValidIsoDate(date)) return
    setGrading(true)
    setError(null)
    try {
      const graded = await window.api.gradeDay(date)
      setRow(graded)
      setViewMode('view')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Grading failed.')
    } finally {
      setGrading(false)
    }
  }, [date])

  const { prev, next } = neighborDates(date, bounds)

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        Loading…
      </div>
    )
  }

  const showReadout = row && row.gradedAt && viewMode === 'view'

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col px-8 py-10">
      <DayHeader
        date={date}
        today={today}
        prevDate={prev}
        nextDate={next}
        gradedAt={row?.gradedAt ?? null}
      />

      {showReadout ? (
        <DayReadout row={row} onEdit={() => setViewMode('edit')} />
      ) : (
        <DayInputForm
          initialText={row?.rawEntry ?? ''}
          hasRow={row !== null}
          isGraded={Boolean(row?.gradedAt)}
          saving={saving}
          grading={grading}
          onSave={handleSave}
          onGrade={handleGrade}
          onCancel={
            row?.gradedAt && viewMode === 'edit' ? () => setViewMode('view') : undefined
          }
          error={error}
        />
      )}
    </div>
  )
}
