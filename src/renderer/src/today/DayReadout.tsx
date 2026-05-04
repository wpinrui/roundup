import { useEffect, useState } from 'react'
import type { DayRow } from '@shared/ipc'
import { cn } from '@renderer/lib/utils'

interface Props {
  row: DayRow
  onEdit: () => void
}

/**
 * Graded-state readout. Direction D vocabulary: gradient score, spring bloom
 * on first reveal, slide-in suggestions, dim-bar with weight-based prominence
 * (the highest-weighted dim's bar is wider).
 */
export function DayReadout({ row, onEdit }: Props) {
  return (
    <div className="flex flex-col gap-8 animate-fade-up" data-testid="day-readout">
      <ScoreHeadline value={row.weightedOverallScore ?? 0} />

      {row.aiNarrative && (
        <p
          className="rounded-card bg-secondary p-6 text-base leading-relaxed shadow-warm"
          data-testid="day-narrative"
        >
          {row.aiNarrative}
        </p>
      )}

      {row.scores.length > 0 && (
        <DimensionBars scores={row.scores} />
      )}

      {row.suggestions.length > 0 && <SuggestionsBlock suggestions={row.suggestions} />}

      <div>
        <button
          type="button"
          onClick={onEdit}
          className="text-sm text-warm-brown underline-offset-4 hover:underline"
          data-testid="day-edit"
        >
          Edit entry
        </button>
      </div>
    </div>
  )
}

function ScoreHeadline({ value }: { value: number }) {
  // Animate count-up from 0 to value on mount.
  const [display, setDisplay] = useState(0)
  useEffect(() => {
    const duration = 700
    const start = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplay(value * eased)
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value])

  return (
    <div className="flex flex-col items-center" data-testid="day-score-headline">
      <span
        className="text-warm-gradient text-[112px] font-bold leading-none tracking-tight animate-spring-bloom"
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        {display.toFixed(1)}
      </span>
      <span className="mt-2 text-xs uppercase tracking-widest text-muted-foreground">
        Weighted overall
      </span>
    </div>
  )
}

function DimensionBars({ scores }: { scores: DayRow['scores'] }) {
  const maxWeight = Math.max(...scores.map((s) => s.weight))
  return (
    <div className="flex flex-col gap-3" data-testid="dimension-bars">
      {scores.map((s) => {
        const widthPct = (s.score / 10) * 100
        // Weight-based visual prominence (decision Q always-on).
        const heightPx = 8 + Math.round((s.weight / maxWeight) * 8) // 8–16 px
        return (
          <div key={s.dimensionId} className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-medium">{s.dimensionName}</span>
              <span
                className="text-2xl font-bold"
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {s.score.toFixed(1)}
              </span>
            </div>
            <div
              className="w-full overflow-hidden rounded-full bg-muted"
              style={{ height: `${heightPx}px` }}
            >
              <div
                className="h-full bg-warm-gradient transition-all duration-700 ease-out"
                style={{ width: `${widthPct}%` }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function SuggestionsBlock({ suggestions }: { suggestions: DayRow['suggestions'] }) {
  const mode = suggestions[0]?.mode ?? 'fix'
  const modeLabel =
    mode === 'stretch' ? 'Tomorrow — stretch suggestions' : 'Tomorrow — fix suggestions'

  return (
    <div className="flex flex-col gap-2" data-testid="suggestions-block">
      <p
        className={cn(
          'text-xs uppercase tracking-widest',
          mode === 'stretch' ? 'text-warm-orange' : 'text-warm-brown'
        )}
        data-testid="suggestions-mode"
      >
        {modeLabel}
      </p>
      <ul className="flex flex-col gap-2">
        {suggestions.map((s, i) => (
          <li
            key={s.dimensionId}
            className={cn(
              'rounded-card border-l-4 bg-secondary p-4 shadow-warm animate-slide-in-right',
              i === 0 ? 'border-warm-pink' : i === 1 ? 'border-warm-orange' : 'border-warm-peach'
            )}
            style={{ animationDelay: `${i * 80}ms` }}
            data-testid="suggestion-item"
          >
            <div
              className={cn(
                'text-xs font-semibold uppercase tracking-wide',
                i === 0 ? 'text-warm-pink' : 'text-warm-brown'
              )}
            >
              #{s.rank} · {s.dimensionName}
            </div>
            <div className="mt-1 text-base">{s.text}</div>
          </li>
        ))}
      </ul>
    </div>
  )
}
