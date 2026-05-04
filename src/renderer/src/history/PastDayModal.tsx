import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { DayRow } from '@shared/ipc'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@renderer/components/ui/dialog'
import { Button } from '@renderer/components/ui/button'
import { formatDateLabel, todayLocalDate } from '@renderer/today/dateUtils'

interface Props {
  date: string | null
  onClose: () => void
}

/**
 * Read-only past-day detail modal (decision A1). Shows date + narrative +
 * per-dim scores (weight-desc) + weighted overall + a "Go to day" button
 * that navigates to /day/:date for the editable view.
 */
export function PastDayModal({ date, onClose }: Props) {
  const navigate = useNavigate()
  const [row, setRow] = useState<DayRow | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!date) {
      setRow(null)
      return
    }
    let cancelled = false
    setLoading(true)
    void (async () => {
      const r = await window.api.getDay(date)
      if (cancelled) return
      setRow(r)
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [date])

  function goToDay() {
    if (!date) return
    onClose()
    navigate(`/day/${date}`)
  }

  return (
    <Dialog open={date !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{date ? formatDateLabel(date, todayLocalDate()) : ''}</DialogTitle>
        </DialogHeader>

        {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {!loading && row && row.gradedAt && <GradedBody row={row} />}
        {!loading && row && !row.gradedAt && (
          <p className="text-sm text-muted-foreground" data-testid="modal-ungraded">
            This day was saved but not graded.
          </p>
        )}
        {!loading && date && !row && (
          <p className="text-sm text-muted-foreground" data-testid="modal-empty">
            No entry for this day yet.
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button
            onClick={goToDay}
            disabled={!date}
            className="bg-warm-gradient text-white shadow-warm-glow hover:opacity-90"
            data-testid="modal-go-to-day"
          >
            Go to day →
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function GradedBody({ row }: { row: DayRow }) {
  const sortedScores = [...row.scores].sort((a, b) => b.weight - a.weight)
  return (
    <div className="flex flex-col gap-4" data-testid="modal-graded">
      {row.aiNarrative && (
        <p className="text-sm leading-relaxed">{row.aiNarrative}</p>
      )}
      <div className="flex items-baseline justify-between rounded-card bg-background/40 p-3">
        <span className="text-xs uppercase tracking-widest text-muted-foreground">
          Weighted overall
        </span>
        <span
          className="text-warm-gradient text-3xl font-bold"
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {(row.weightedOverallScore ?? 0).toFixed(1)}
        </span>
      </div>
      <ul className="flex flex-col gap-2">
        {sortedScores.map((s) => (
          <li key={s.dimensionId} className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{s.dimensionName}</span>
            <span className="font-semibold" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {s.score.toFixed(1)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
