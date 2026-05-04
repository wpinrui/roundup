import * as React from 'react'
import { cn } from '@renderer/lib/utils'

export interface SliderProps {
  value: number
  onChange: (next: number) => void
  min?: number
  max?: number
  step?: number
  className?: string
  'aria-label'?: string
  disabled?: boolean
}

/**
 * Minimal slider styled for Direction D. Built on the native range input so
 * we don't pull in another Radix dep for one knob; track and thumb are
 * styled via CSS custom properties applied inline.
 */
const Slider = React.forwardRef<HTMLInputElement, SliderProps>(
  ({ value, onChange, min = 1, max = 10, step = 1, className, disabled, ...rest }, ref) => (
    <input
      ref={ref}
      type="range"
      value={value}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      aria-label={rest['aria-label']}
      onChange={(e) => onChange(Number(e.currentTarget.value))}
      className={cn(
        'h-2 w-full cursor-pointer appearance-none rounded-full bg-muted',
        '[&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none',
        '[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-warm-orange',
        '[&::-webkit-slider-thumb]:shadow-warm-glow',
        '[&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full',
        '[&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-warm-orange',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
    />
  )
)
Slider.displayName = 'Slider'

export { Slider }
