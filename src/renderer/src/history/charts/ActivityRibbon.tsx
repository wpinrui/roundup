import type { DayRow } from '@shared/ipc'
import { cn } from '@renderer/lib/utils'
import { ChartCard } from './ChartCard'

interface Props {
  days: DayRow[]
  onPickDate: (date: string) => void
}

const TITLE = 'Activity ribbon'
const DESCRIPTION = 'Bar length = score; click for the day.'

/**
 * Horizontal bars across days, one row per dim (weight-desc). Bar width
 * within its cell is score / 10. Click a bar → past-day modal.
 */
export function ActivityRibbon({ days, onPickDate }: Props) {
  const dims = collectDims(days)
  if (dims.length === 0 || days.length === 0) {
    return (
      <ChartCard title={TITLE} description={DESCRIPTION}>
        <p className="text-sm text-muted-foreground">No graded days in this range yet.</p>
      </ChartCard>
    )
  }

  return (
    <ChartCard title={TITLE} description={DESCRIPTION}>
      <div className="overflow-x-auto" data-testid="chart-ribbon">
        <div className="inline-block">
          {dims.map((d) => (
            <div key={d.id} className="flex items-center gap-2 mb-1.5">
              <span
                className="w-24 shrink-0 truncate text-xs text-muted-foreground"
                title={d.name}
              >
                {d.name}
              </span>
              <div className="flex gap-0.5">
                {days.map((day) => {
                  const score = day.scores.find((s) => s.dimensionId === d.id)?.score ?? null
                  const pct = score === null ? 0 : (score / 10) * 100
                  return (
                    <button
                      key={day.date}
                      type="button"
                      title={`${day.date}${score === null ? ' — no grade' : ` — ${score.toFixed(1)}`}`}
                      onClick={() => onPickDate(day.date)}
                      data-testid="ribbon-bar"
                      data-date={day.date}
                      className={cn(
                        'relative h-4 w-6 rounded-sm bg-muted/40 overflow-hidden transition-transform hover:scale-110'
                      )}
                    >
                      {score !== null && (
                        <span
                          className="absolute inset-y-0 left-0 bg-warm-gradient"
                          style={{ width: `${pct}%` }}
                        />
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </ChartCard>
  )
}

function collectDims(days: DayRow[]): Array<{ id: number; name: string; weight: number }> {
  const m = new Map<number, { id: number; name: string; weight: number }>()
  for (const day of days) {
    for (const s of day.scores) {
      if (!m.has(s.dimensionId)) m.set(s.dimensionId, { id: s.dimensionId, name: s.dimensionName, weight: s.weight })
    }
  }
  return [...m.values()].sort((a, b) => b.weight - a.weight)
}
