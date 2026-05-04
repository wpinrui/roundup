import * as React from 'react'
import { cn } from '@renderer/lib/utils'

/**
 * Lightweight tabs primitive — same project pattern as the custom Accordion
 * and Dialog: no Radix dep, uncontrolled value via React state at the call
 * site. The trigger is a real `<button role="tab">` so keyboard nav and
 * a11y work without extra glue.
 */

interface TabsContextValue<T extends string = string> {
  value: T
  setValue: (next: T) => void
}

const TabsContext = React.createContext<TabsContextValue | null>(null)

export interface TabsProps<T extends string> {
  value: T
  onValueChange: (next: T) => void
  children: React.ReactNode
  className?: string
}

export function Tabs<T extends string>({ value, onValueChange, children, className }: TabsProps<T>) {
  const ctx = React.useMemo<TabsContextValue<T>>(() => ({ value, setValue: onValueChange }), [
    value,
    onValueChange,
  ])
  return (
    <TabsContext.Provider value={ctx as unknown as TabsContextValue}>
      <div className={cn('flex flex-col gap-4', className)}>{children}</div>
    </TabsContext.Provider>
  )
}

export interface TabsListProps {
  children: React.ReactNode
  className?: string
}

export function TabsList({ children, className }: TabsListProps) {
  return (
    <div
      role="tablist"
      className={cn(
        'inline-flex items-center gap-1 rounded-card bg-secondary p-1 shadow-warm',
        className
      )}
    >
      {children}
    </div>
  )
}

export interface TabsTriggerProps {
  value: string
  children: React.ReactNode
  className?: string
  'data-testid'?: string
}

export function TabsTrigger({ value, children, className, ...rest }: TabsTriggerProps) {
  const ctx = React.useContext(TabsContext)
  if (!ctx) throw new Error('TabsTrigger must be inside Tabs')
  const isActive = ctx.value === value
  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      onClick={() => ctx.setValue(value)}
      data-testid={rest['data-testid']}
      className={cn(
        'rounded-md px-4 py-2 text-sm font-medium transition-all',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        isActive
          ? 'bg-warm-gradient text-white shadow-warm-glow'
          : 'text-muted-foreground hover:text-warm-brown',
        className
      )}
    >
      {children}
    </button>
  )
}

export interface TabsContentProps {
  value: string
  children: React.ReactNode
  className?: string
}

export function TabsContent({ value, children, className }: TabsContentProps) {
  const ctx = React.useContext(TabsContext)
  if (!ctx) throw new Error('TabsContent must be inside Tabs')
  if (ctx.value !== value) return null
  return (
    <div role="tabpanel" className={cn('animate-fade-up', className)}>
      {children}
    </div>
  )
}
