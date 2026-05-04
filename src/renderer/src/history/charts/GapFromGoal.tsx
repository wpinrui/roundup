import type { DayRow } from '@shared/ipc'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ChartCard } from './Heatmap'

const GOAL = 7 // brief locks universal goal=7 per dim

interface Props {
  days: DayRow[]
}

/** Horizontal bar per dim showing window-average vs. goal=7. Weight-sorted. */
export function GapFromGoal({ days }: Props) {
  const data = build(days)
  if (data.length === 0) {
    return (
      <ChartCard title="Gap from goal" description={`Goal = ${GOAL} per dimension.`}>
        <p className="text-sm text-muted-foreground">No graded days in this range yet.</p>
      </ChartCard>
    )
  }

  return (
    <ChartCard title="Gap from goal" description={`Goal = ${GOAL} per dimension. Weight-sorted.`}>
      <div className="h-64 w-full" data-testid="chart-gap">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 8, right: 16, left: 24, bottom: 8 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
            <XAxis type="number" domain={[0, 10]} tick={{ fontSize: 11 }} />
            <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={80} />
            <Tooltip />
            <ReferenceLine x={GOAL} stroke="#562F00" strokeDasharray="4 2" />
            <Bar dataKey="avg">
              {data.map((row, i) => (
                <Cell
                  key={row.name}
                  fill={row.avg >= GOAL ? '#FF9644' : '#FFCE99'}
                  fillOpacity={0.85}
                  data-index={i}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  )
}

function build(days: DayRow[]): Array<{ name: string; avg: number; weight: number }> {
  const acc = new Map<number, { name: string; weight: number; sum: number; n: number }>()
  for (const day of days) {
    for (const s of day.scores) {
      const cur = acc.get(s.dimensionId) ?? {
        name: s.dimensionName,
        weight: s.weight,
        sum: 0,
        n: 0,
      }
      cur.sum += s.score
      cur.n += 1
      acc.set(s.dimensionId, cur)
    }
  }
  return [...acc.values()]
    .map((r) => ({ name: r.name, avg: r.n === 0 ? 0 : r.sum / r.n, weight: r.weight }))
    .sort((a, b) => b.weight - a.weight)
}
