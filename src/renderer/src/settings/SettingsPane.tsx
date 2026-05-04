import { DimensionsSection } from './DimensionsSection'
import { RubricsSection } from './RubricsSection'
import { ApiKeySection } from './ApiKeySection'
import { VizTogglesSection } from './VizTogglesSection'

export function SettingsPane() {
  return (
    <div
      className="mx-auto flex w-full max-w-3xl flex-col gap-12 px-8 py-10"
      data-testid="settings-pane"
    >
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Tune what gets graded, where rubrics live, and how the app looks.
        </p>
      </header>

      <DimensionsSection />
      <hr className="border-border" />
      <RubricsSection />
      <hr className="border-border" />
      <ApiKeySection />
      <hr className="border-border" />
      <VizTogglesSection />
    </div>
  )
}
