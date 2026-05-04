import * as React from 'react'
import { cn } from '@renderer/lib/utils'

export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number // 0–100
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value, ...props }, ref) => {
    const clamped = Math.max(0, Math.min(100, value))
    return (
      <div
        ref={ref}
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        className={cn('relative h-2 w-full overflow-hidden rounded-full bg-muted', className)}
        {...props}
      >
        <div
          className="h-full bg-warm-gradient transition-all duration-500 ease-out"
          style={{ width: `${clamped}%` }}
        />
      </div>
    )
  }
)
Progress.displayName = 'Progress'

export { Progress }
