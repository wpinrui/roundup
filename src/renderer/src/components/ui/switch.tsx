import * as React from 'react'
import { cn } from '@renderer/lib/utils'

export interface SwitchProps {
  checked: boolean
  onCheckedChange: (next: boolean) => void
  id?: string
  disabled?: boolean
  'aria-label'?: string
  className?: string
}

/**
 * Direction D toggle. Pure CSS — no Radix. Built on a real <button role="switch">
 * for accessibility; the visual track + thumb live in two divs.
 */
export const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(function Switch(
  { checked, onCheckedChange, id, disabled, className, ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={rest['aria-label']}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'bg-warm-gradient shadow-warm-glow' : 'bg-muted',
        className
      )}
    >
      <span
        aria-hidden
        className={cn(
          'pointer-events-none inline-block h-5 w-5 translate-x-0 transform rounded-full bg-white shadow-md ring-0 transition-transform duration-200',
          checked ? 'translate-x-5' : 'translate-x-0.5',
          'mt-0.5'
        )}
      />
    </button>
  )
})
