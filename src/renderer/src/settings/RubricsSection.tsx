import { useState } from 'react'
import { Button } from '@renderer/components/ui/button'

export function RubricsSection() {
  const [error, setError] = useState<string | null>(null)

  async function open(fn: () => Promise<void>) {
    setError(null)
    try {
      await fn()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open.')
    }
  }

  return (
    <section className="flex flex-col gap-3" data-testid="settings-rubrics">
      <header>
        <h2 className="text-2xl font-bold">Rubrics</h2>
        <p className="text-sm text-muted-foreground">
          Each dimension has a rubric that describes what scores 0–10 mean in your own
          terms. Edit the file directly to change them.
        </p>
      </header>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          onClick={() => void open(window.api.openRubricsFile)}
          data-testid="open-rubrics-file"
        >
          Open rubrics.md
        </Button>
        <Button
          variant="outline"
          onClick={() => void open(window.api.openRubricsFolder)}
          data-testid="open-rubrics-folder"
        >
          Open folder
        </Button>
      </div>
      {error && (
        <p className="text-sm text-red-600" data-testid="rubrics-error">
          {error}
        </p>
      )}
    </section>
  )
}
