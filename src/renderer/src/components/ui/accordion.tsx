import * as React from 'react'
import { cn } from '@renderer/lib/utils'

interface AccordionContextValue {
  openId: string | null
  setOpenId: (id: string | null) => void
}
const AccordionContext = React.createContext<AccordionContextValue | null>(null)

export interface AccordionProps {
  /** Controlled: id of the currently expanded item (decision O — only one at a time). */
  value: string | null
  onValueChange: (next: string | null) => void
  children: React.ReactNode
  className?: string
}

export function Accordion({ value, onValueChange, children, className }: AccordionProps) {
  return (
    <AccordionContext.Provider value={{ openId: value, setOpenId: onValueChange }}>
      <div className={cn('flex flex-col gap-3', className)}>{children}</div>
    </AccordionContext.Provider>
  )
}

export interface AccordionItemProps {
  id: string
  children: React.ReactNode
  className?: string
}

const ItemContext = React.createContext<{ id: string } | null>(null)

export function AccordionItem({ id, children, className }: AccordionItemProps) {
  return (
    <ItemContext.Provider value={{ id }}>
      <div
        className={cn(
          'overflow-hidden rounded-card bg-secondary shadow-warm transition-shadow',
          className
        )}
      >
        {children}
      </div>
    </ItemContext.Provider>
  )
}

export interface AccordionTriggerProps {
  children: React.ReactNode
  className?: string
}

export function AccordionTrigger({ children, className }: AccordionTriggerProps) {
  const ctx = React.useContext(AccordionContext)
  const item = React.useContext(ItemContext)
  if (!ctx || !item) throw new Error('AccordionTrigger must be inside Accordion + AccordionItem')
  const isOpen = ctx.openId === item.id
  return (
    <button
      type="button"
      aria-expanded={isOpen}
      onClick={() => ctx.setOpenId(isOpen ? null : item.id)}
      className={cn(
        'flex w-full items-center justify-between px-5 py-4 text-left',
        'hover:bg-accent/30 transition-colors',
        className
      )}
    >
      <span className="flex-1">{children}</span>
      <span
        className={cn(
          'ml-3 text-warm-orange transition-transform duration-200',
          isOpen ? 'rotate-180' : 'rotate-0'
        )}
        aria-hidden
      >
        ▾
      </span>
    </button>
  )
}

export interface AccordionContentProps {
  children: React.ReactNode
  className?: string
}

export function AccordionContent({ children, className }: AccordionContentProps) {
  const ctx = React.useContext(AccordionContext)
  const item = React.useContext(ItemContext)
  if (!ctx || !item) throw new Error('AccordionContent must be inside Accordion + AccordionItem')
  const isOpen = ctx.openId === item.id
  if (!isOpen) return null
  return <div className={cn('animate-fade-up px-5 pb-5', className)}>{children}</div>
}
