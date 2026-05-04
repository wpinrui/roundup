import type { DayRow } from '@shared/ipc'
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar as RechartsRadar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import { ChartCard } from './Heatmap'

interface Props {
  days: DayRow[]
}

/**
 * Per-dim window-average rendered as a radar polygon. N axes for N dims (3–8
 * per decision N). Returns null when ≤ 2 dims so the chart is hidden, not
 * collapsed to a degenerate triangle.
 */
export function Radar({ days }: Props) {
  const data = computeAverages(days)
  if (data.length <= 2) return null

  return (
    <ChartCard title="Radar" description="Window average per dimension.">
      <div className="h-72 w-full" data-testid="chart-radar">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
            <PolarGrid stroke="rgba(0,0,0,0.1)" />
            <PolarAngleAxis dataKey="dim" tick={{ fontSize: 11 }} />
            <PolarRadiusAxis angle={90} domain={[0, 10]} tick={{ fontSize: 10 }} />
            <Tooltip />
            <RechartsRadar
              name="Average"
              dataKey="avg"
              stroke="#FF9644"
              fill="url(#warmGradient)"
              fillOpacity={0.55}
            />
            <defs>
              <linearGradient id="warmGradient" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#FF9644" />
                <stop offset="50%" stopColor="#FFCE99" />
                <stop offset="100%" stopColor="#FFB3C6" />
              </linearGradient>
            </defs>
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  )
}

function computeAverages(days: DayRow[]): Array<{ dim: string; avg: number }> {
  const acc = new Map<number, { name: string; sum: number; n: number }>()
  for (const day of days) {
    for (const s of day.scores) {
      const cur = acc.get(s.dimensionId) ?? { name: s.dimensionName, sum: 0, n: 0 }
      cur.sum += s.score
      cur.n += 1
      acc.set(s.dimensionId, cur)
    }
  }
  return [...acc.values()].map((r) => ({ dim: r.name, avg: r.n === 0 ? 0 : r.sum / r.n }))
}
