import { useEffect, useState } from 'react'
import type { VizToggleKey, VizToggleState } from '@shared/ipc'
import { Switch } from '@renderer/components/ui/switch'

const TOGGLE_LABELS: Record<VizToggleKey, { label: string; description: string }> = {
  heatmap: {
    label: 'Heatmap',
    description: 'GitHub-style intensity grid per dimension.',
  },
  stackedArea: {
    label: 'Stacked area',
    description: 'Hours per dimension across time.',
  },
  radar: {
    label: 'Radar',
    description: 'Per-week shape across all dimensions.',
  },
  ribbon: {
    label: 'Activity ribbon',
    description: 'Horizontal bars over recent days.',
  },
  gapFromGoal: {
    label: 'Gap from goal',
    description: 'How far each dimension is from your target.',
  },
  streaks: {
    label: 'Streak counters',
    description: '"X of last 7" rather than reset-on-miss streaks.',
  },
  anomaly: {
    label: 'Anomaly callouts',
    description: 'Unusual gaps or spikes worth a second look.',
  },
}

const ORDER: readonly VizToggleKey[] = [
  'heatmap',
  'stackedArea',
  'radar',
  'ribbon',
  'gapFromGoal',
  'streaks',
  'anomaly',
] as const

export function VizTogglesSection() {
  const [state, setState] = useState<VizToggleState | null>(null)

  useEffect(() => {
    void (async () => {
      setState(await window.api.getVizToggles())
    })()
  }, [])

  async function toggle(key: VizToggleKey, on: boolean) {
    if (!state) return
    setState({ ...state, [key]: on })
    try {
      await window.api.setVizToggle(key, on)
    } catch {
      // Roll back on failure.
      setState((prev) => (prev ? { ...prev, [key]: !on } : prev))
    }
  }

  return (
    <section className="flex flex-col gap-3" data-testid="settings-viz-toggles">
      <header>
        <h2 className="text-2xl font-bold">Visualisations</h2>
        <p className="text-sm text-muted-foreground">
          Show or hide individual chart types. Settings persist across restarts.
        </p>
      </header>
      <ul className="flex flex-col gap-3">
        {ORDER.map((key) => {
          const meta = TOGGLE_LABELS[key]
          const checked = state?.[key] ?? true
          return (
            <li
              key={key}
              className="flex items-center justify-between rounded-card bg-secondary p-4 shadow-warm"
            >
              <div className="flex flex-col">
                <span className="font-medium">{meta.label}</span>
                <span className="text-sm text-muted-foreground">{meta.description}</span>
              </div>
              <Switch
                checked={checked}
                onCheckedChange={(on) => void toggle(key, on)}
                aria-label={meta.label}
              />
            </li>
          )
        })}
      </ul>
    </section>
  )
}
