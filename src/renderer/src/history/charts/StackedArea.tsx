import type { DayRow } from '@shared/ipc'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ChartCard } from './Heatmap'
import { bucketByWeek } from '../historyDateUtils'

interface Props {
  days: DayRow[]
  /** Bucket dates into ISO weeks when the range is "long" (>14 days, by convention). */
  bucketWeekly?: boolean
}

/**
 * Hours per dimension over time, stacked. AI-estimated `hoursEstimated` per
 * decision M; dims with all-null hours are dropped from the chart. Weekly
 * buckets when the caller flags `bucketWeekly` (Past 30 / longer custom).
 */
export function StackedArea({ days, bucketWeekly = false }: Props) {
  const dims = collectActiveDims(days)
  if (dims.length === 0 || days.length === 0) {
    return (
      <ChartCard
        title="Stacked area"
        description="Hours per dimension over time. Hidden dims have no estimated hours yet."
      >
        <p className="text-sm text-muted-foreground">
          No hour-bearing grades in this range yet.
        </p>
      </ChartCard>
    )
  }

  const data = bucketWeekly ? buildWeekly(days, dims) : buildDaily(days, dims)

  return (
    <ChartCard
      title="Stacked area"
      description="AI-estimated hours per dimension."
    >
      <div className="h-64 w-full" data-testid="chart-stacked-area">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {dims.map((d, i) => (
              <Area
                key={d.id}
                type="monotone"
                dataKey={d.name}
                stackId="1"
                stroke={DIM_COLOURS[i % DIM_COLOURS.length]}
                fill={DIM_COLOURS[i % DIM_COLOURS.length]}
                fillOpacity={0.55}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  )
}

const DIM_COLOURS = ['#FF9644', '#FFCE99', '#FFB3C6', '#562F00', '#3A3A3A', '#FFB07A', '#E07A5F', '#9C5A3C']

interface DimMeta {
  id: number
  name: string
}

function collectActiveDims(days: DayRow[]): DimMeta[] {
  const seen = new Map<number, DimMeta>()
  const haveHours = new Set<number>()
  for (const d of days) {
    for (const s of d.scores) {
      if (!seen.has(s.dimensionId)) seen.set(s.dimensionId, { id: s.dimensionId, name: s.dimensionName })
      if (s.hoursEstimated !== null) haveHours.add(s.dimensionId)
    }
  }
  return [...seen.values()].filter((d) => haveHours.has(d.id))
}

function buildDaily(days: DayRow[], dims: DimMeta[]): Array<Record<string, string | number>> {
  return days.map((day) => {
    const row: Record<string, string | number> = { label: day.date.slice(5) } // MM-DD
    for (const d of dims) {
      const s = day.scores.find((x) => x.dimensionId === d.id)
      row[d.name] = s?.hoursEstimated ?? 0
    }
    return row
  })
}

function buildWeekly(days: DayRow[], dims: DimMeta[]): Array<Record<string, string | number>> {
  const buckets = bucketByWeek(days.map((d) => d.date))
  const dayByDate = new Map(days.map((d) => [d.date, d]))
  return buckets.map((b) => {
    const row: Record<string, string | number> = { label: b.weekStart.slice(5) }
    for (const d of dims) row[d.name] = 0
    for (const date of b.dates) {
      const day = dayByDate.get(date)
      if (!day) continue
      for (const s of day.scores) {
        if (s.hoursEstimated !== null) {
          const dimMeta = dims.find((m) => m.id === s.dimensionId)
          if (dimMeta) row[dimMeta.name] = (row[dimMeta.name] as number) + s.hoursEstimated
        }
      }
    }
    return row
  })
}
