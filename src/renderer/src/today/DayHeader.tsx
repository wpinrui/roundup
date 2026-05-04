import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { formatDateLabel } from './dateUtils'

interface Props {
  date: string
  today: string
  prevDate: string | null
  nextDate: string | null
  gradedAt: string | null
}

export function DayHeader({ date, today, prevDate, nextDate, gradedAt }: Props) {
  const navigate = useNavigate()
  const label = formatDateLabel(date, today)

  return (
    <div className="flex items-center justify-between mb-8" data-testid="day-header">
      <button
        type="button"
        onClick={() => prevDate && navigate(`/day/${prevDate}`)}
        disabled={!prevDate}
        aria-label="Previous day"
        className={cn(
          'flex h-10 w-10 items-center justify-center rounded-full text-warm-brown transition-colors',
          'hover:bg-warm-peach/40 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent'
        )}
        data-testid="day-prev"
      >
        <ChevronLeft size={22} />
      </button>

      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight" data-testid="day-label">
          {label}
        </h1>
        {gradedAt && (
          <p className="mt-1 text-xs uppercase tracking-wider text-warm-orange">Graded</p>
        )}
      </div>

      <button
        type="button"
        onClick={() => nextDate && navigate(`/day/${nextDate}`)}
        disabled={!nextDate}
        aria-label="Next day"
        className={cn(
          'flex h-10 w-10 items-center justify-center rounded-full text-warm-brown transition-colors',
          'hover:bg-warm-peach/40 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent'
        )}
        data-testid="day-next"
      >
        <ChevronRight size={22} />
      </button>
    </div>
  )
}
