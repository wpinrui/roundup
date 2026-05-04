import type { DayRow } from '@shared/ipc'
import { detectAnomalies, type Anomaly } from '@shared/anomalies'
import { cn } from '@renderer/lib/utils'
import { ChartCard } from './ChartCard'

interface Props {
  days: DayRow[]
  onPickDate: (date: string) => void
}

const TYPE_LABELS: Record<Anomaly['type'], { label: string; tone: string }> = {
  'long-gap': { label: 'Long gap', tone: 'border-warm-pink text-warm-pink' },
  unusual: { label: 'Unusual', tone: 'border-warm-orange text-warm-orange' },
  declining: { label: 'Declining', tone: 'border-warm-brown text-warm-brown' },
}

/**
 * Each detected anomaly as a card. Click → modal for the relevant date
 * (start of a range, the date itself for unusual). No-op when the anomaly
 * has no obvious anchor date.
 */
export function AnomalyCards({ days, onPickDate }: Props) {
  const anomalies = detectAnomalies(days)
  if (anomalies.length === 0) {
    return (
      <ChartCard title="Anomaly callouts" description="Long gaps, unusual scores, declining trends.">
        <p className="text-sm text-muted-foreground">Nothing unusual this range.</p>
      </ChartCard>
    )
  }

  return (
    <ChartCard title="Anomaly callouts" description="Long gaps, unusual scores, declining trends.">
      <ul className="flex flex-col gap-2" data-testid="chart-anomalies">
        {anomalies.map((a, i) => {
          const meta = TYPE_LABELS[a.type]
          const date = anchorDate(a)
          return (
            <li
              key={`${a.type}-${a.dimId}-${i}`}
              className={cn(
                'rounded-card border-l-4 bg-secondary p-3 shadow-warm animate-slide-in-right',
                meta.tone.split(' ')[0]
              )}
              style={{ animationDelay: `${i * 50}ms` }}
              data-testid="anomaly-card"
            >
              <div className="flex items-baseline justify-between">
                <div>
                  <span className={cn('text-xs font-semibold uppercase tracking-wide', meta.tone)}>
                    {meta.label}
                  </span>
                  <span className="ml-2 text-sm font-medium">{a.dimName}</span>
                </div>
                <button
                  type="button"
                  onClick={() => onPickDate(date)}
                  className="text-xs text-muted-foreground hover:text-warm-brown"
                  data-testid="anomaly-open"
                >
                  Open day →
                </button>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{describe(a)}</p>
            </li>
          )
        })}
      </ul>
    </ChartCard>
  )
}

function anchorDate(a: Anomaly): string {
  switch (a.type) {
    case 'unusual':
      return a.date
    case 'long-gap':
    case 'declining':
      return a.startDate
  }
}

function describe(a: Anomaly): string {
  switch (a.type) {
    case 'long-gap':
      return `${a.dayCount} consecutive days at ≤ 2/10 (${a.startDate} → ${a.endDate}).`
    case 'unusual':
      return `Scored ${a.score.toFixed(1)} on ${a.date} — ${
        a.deltaPts > 0 ? '+' : ''
      }${a.deltaPts.toFixed(1)} vs. recent average ${a.mean.toFixed(1)}.`
    case 'declining':
      return `7+ day decline from ${a.startDate} to ${a.endDate} (slope ${a.slopePerDay.toFixed(2)} pts/day).`
  }
}
