import { NavLink } from 'react-router-dom'
import { Calendar, History, Settings } from 'lucide-react'
import { cn } from '@renderer/lib/utils'

const navItems = [
  { to: '/', label: 'Today', icon: Calendar },
  { to: '/history', label: 'History', icon: History },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export function NavRail() {
  return (
    <nav
      data-testid="nav-rail"
      className="flex h-full w-16 flex-col items-center gap-2 border-r border-border bg-background py-4"
    >
      {navItems.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className={({ isActive }) =>
            cn(
              'flex flex-col items-center gap-1 rounded-lg p-2 text-xs transition-colors',
              isActive
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            )
          }
          aria-label={label}
        >
          <Icon size={20} />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
