import { NavLink, useLocation } from 'react-router-dom'
import { Calendar, History, Settings } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { todayLocalDate } from '@renderer/today/dateUtils'

export function NavRail() {
  const { pathname } = useLocation()
  const today = todayLocalDate()
  const todayActive = pathname === '/' || pathname.startsWith('/day')

  const items = [
    { to: `/day/${today}`, label: 'Today', icon: Calendar, isActive: todayActive },
    { to: '/history', label: 'History', icon: History, isActive: pathname.startsWith('/history') },
    { to: '/settings', label: 'Settings', icon: Settings, isActive: pathname.startsWith('/settings') },
  ]

  return (
    <nav
      data-testid="nav-rail"
      className="flex h-full w-16 flex-col items-center gap-2 border-r border-border bg-background py-4"
    >
      {items.map(({ to, label, icon: Icon, isActive }) => (
        <NavLink
          key={label}
          to={to}
          className={cn(
            'flex flex-col items-center gap-1 rounded-lg p-2 text-xs transition-colors',
            isActive
              ? 'bg-primary/10 text-primary'
              : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
          )}
          aria-label={label}
        >
          <Icon size={20} />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
