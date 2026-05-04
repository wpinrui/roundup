import type { DayRow } from '@shared/ipc'
import { computeStreaks } from '@shared/streaks'
import { ChartCard } from './Heatmap'

interface Props {
  days: DayRow[]
  windowLength: number
}

/**
 * "X of last N" per dim. N is the configured window length (7 / 30 / custom),
 * not the number of graded days — so a sparse 30-day window still reads as
 * "out of 30." Sorted by hit ratio desc (computeStreaks).
 */
export function StreakCounters({ days, windowLength }: Props) {
  const streaks = computeStreaks(days)
  if (streaks.length === 0) {
    return (
      <ChartCard title="Streak counters" description="Days at-or-above 5/10 in the window.">
        <p className="text-sm text-muted-foreground">No graded days in this range yet.</p>
      </ChartCard>
    )
  }

  return (
    <ChartCard title="Streak counters" description="Days at-or-above 5/10 in the window.">
      <div
        className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
        data-testid="chart-streaks"
      >
        {streaks.map((s) => {
          const pct = s.total === 0 ? 0 : (s.hits / s.total) * 100
          return (
            <div
              key={s.dimId}
              className="rounded-card border border-border/60 p-3 text-center"
              data-testid="streak-card"
            >
              <div
                className="text-warm-gradient text-3xl font-bold leading-none"
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {s.hits}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                of last {windowLength} · {s.dimName}
              </div>
              <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-warm-gradient transition-all duration-700"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </ChartCard>
  )
}
