import { cn } from '@renderer/lib/utils'

export type StepStatus = 'done' | 'current' | 'pending'

interface Step {
  label: string
  status: StepStatus
}

export function StepIndicator({ steps }: { steps: Step[] }) {
  return (
    <div className="flex items-center justify-center gap-3" data-testid="step-indicator">
      {steps.map((s, i) => (
        <div key={s.label} className="flex items-center gap-3">
          <div className="flex flex-col items-center gap-2">
            <div
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-all',
                s.status === 'done' &&
                  'bg-warm-gradient text-white shadow-warm-glow',
                s.status === 'current' &&
                  'bg-warm-orange text-white shadow-warm-glow ring-4 ring-warm-orange/20',
                s.status === 'pending' && 'bg-muted text-muted-foreground'
              )}
              aria-label={`Step ${i + 1}: ${s.label} (${s.status})`}
            >
              {s.status === 'done' ? '✓' : i + 1}
            </div>
            <span
              className={cn(
                'text-xs font-medium',
                s.status === 'pending' ? 'text-muted-foreground' : 'text-foreground'
              )}
            >
              {s.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div
              className={cn(
                '-mt-6 h-0.5 w-12 transition-colors',
                steps[i].status === 'done' ? 'bg-warm-orange' : 'bg-muted'
              )}
              aria-hidden
            />
          )}
        </div>
      ))}
    </div>
  )
}
