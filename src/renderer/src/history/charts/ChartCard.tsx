import * as React from 'react'

/**
 * Shared section wrapper for every History chart. Owns the title + optional
 * description block above the chart body. Lives in its own file so the seven
 * sibling chart components don't have to import it from one of their peers.
 */
export interface ChartCardProps {
  title: string
  description?: string
  children: React.ReactNode
}

export function ChartCard({ title, description, children }: ChartCardProps) {
  return (
    <section className="rounded-card bg-secondary p-5 shadow-warm animate-fade-up">
      <header className="mb-3">
        <h3 className="text-lg font-bold">{title}</h3>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </header>
      {children}
    </section>
  )
}
