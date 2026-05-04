import type { DayRow } from '@shared/ipc'
import { cn } from '@renderer/lib/utils'

interface Props {
  days: DayRow[]
  onPickDate: (date: string) => void
}

/**
 * GitHub-style intensity grid. Rows = dimensions (weight-desc per decision Q),
 * columns = days in the range. Cell colour interpolates orange→pink across
 * the Direction D gradient at score-proportional opacity. Empty cells (no
 * grade) render as a faint placeholder.
 */
export function Heatmap({ days, onPickDate }: Props) {
  const dims = collectDimensions(days)
  if (dims.length === 0 || days.length === 0) {
    return <EmptyState message="No graded days in this range yet." />
  }

  return (
    <ChartCard title="Heatmap" description="Intensity = score. Click a cell to open the day.">
      <div className="overflow-x-auto" data-testid="chart-heatmap">
        <div className="inline-block">
          {dims.map((d) => (
            <div key={d.id} className="flex items-center gap-2 mb-1">
              <span
                className="w-24 shrink-0 truncate text-xs text-muted-foreground"
                title={d.name}
              >
                {d.name}
              </span>
              <div className="flex gap-0.5">
                {days.map((day) => {
                  const score = scoreFor(day, d.id)
                  return (
                    <button
                      key={day.date}
                      type="button"
                      title={`${day.date}${score === null ? ' — no grade' : ` — ${score.toFixed(1)}`}`}
                      onClick={() => onPickDate(day.date)}
                      data-testid="heatmap-cell"
                      data-date={day.date}
                      className={cn(
                        'h-4 w-4 rounded-sm transition-transform hover:scale-125',
                        score === null && 'bg-muted/50'
                      )}
                      style={
                        score === null
                          ? undefined
                          : { backgroundColor: scoreToColour(score) }
                      }
                    />
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

interface DimMeta {
  id: number
  name: string
  weight: number
}

function collectDimensions(days: DayRow[]): DimMeta[] {
  const m = new Map<number, DimMeta>()
  for (const d of days) {
    for (const s of d.scores) {
      if (!m.has(s.dimensionId)) {
        m.set(s.dimensionId, { id: s.dimensionId, name: s.dimensionName, weight: s.weight })
      }
    }
  }
  return [...m.values()].sort((a, b) => b.weight - a.weight)
}

function scoreFor(day: DayRow, dimId: number): number | null {
  const s = day.scores.find((x) => x.dimensionId === dimId)
  return s?.score ?? null
}

/** Direction D gradient endpoints: orange #FF9644 → peach #FFCE99 → pink #FFB3C6. */
function scoreToColour(score: number): string {
  const t = Math.max(0, Math.min(1, score / 10))
  // Two-stop interpolation: 0..0.5 = orange→peach; 0.5..1 = peach→pink.
  const orange = [255, 150, 68]
  const peach = [255, 206, 153]
  const pink = [255, 179, 198]
  const stops = t < 0.5 ? [orange, peach, t / 0.5] : [peach, pink, (t - 0.5) / 0.5]
  const a = stops[0] as number[]
  const b = stops[1] as number[]
  const k = stops[2] as number
  const r = Math.round(a[0] + (b[0] - a[0]) * k)
  const g = Math.round(a[1] + (b[1] - a[1]) * k)
  const bl = Math.round(a[2] + (b[2] - a[2]) * k)
  return `rgb(${r}, ${g}, ${bl})`
}

export function ChartCard({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-card bg-secondary p-5 shadow-warm animate-fade-up">
      <header className="mb-3">
        <h3 className="text-lg font-bold">{title}</h3>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </header>
      {children}
    </section>
  )
}

export function EmptyState({ message }: { message: string }) {
  return (
    <ChartCard title="">
      <p className="text-sm text-muted-foreground">{message}</p>
    </ChartCard>
  )
}
