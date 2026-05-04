import { useEffect, useState } from 'react'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'

type Phase =
  | { kind: 'view'; stored: boolean }
  | { kind: 'edit'; stored: boolean; verifying: boolean; error: string | null }
  | { kind: 'success'; stored: true }

export function ApiKeySection() {
  const [phase, setPhase] = useState<Phase>({ kind: 'view', stored: false })
  const [draftKey, setDraftKey] = useState('')

  useEffect(() => {
    void (async () => {
      const stored = await window.api.getStoredApiKey()
      setPhase({ kind: 'view', stored: stored !== null })
    })()
  }, [])

  function startEdit() {
    setDraftKey('')
    setPhase((prev) => ({ kind: 'edit', stored: prev.stored, verifying: false, error: null }))
  }

  function cancelEdit() {
    setDraftKey('')
    setPhase((prev) => ({ kind: 'view', stored: prev.stored }))
  }

  async function submit() {
    if (phase.kind !== 'edit') return
    if (!draftKey.trim()) {
      setPhase({ ...phase, error: 'Please enter an API key.' })
      return
    }
    setPhase({ ...phase, verifying: true, error: null })
    const result = await window.api.updateApiKey(draftKey)
    if (!result.ok) {
      setPhase({ kind: 'edit', stored: phase.stored, verifying: false, error: result.error ?? 'Failed.' })
      return
    }
    setPhase({ kind: 'success', stored: true })
    setDraftKey('')
    setTimeout(() => setPhase({ kind: 'view', stored: true }), 1500)
  }

  const stored = phase.stored

  return (
    <section className="flex flex-col gap-3" data-testid="settings-api-key">
      <header>
        <h2 className="text-2xl font-bold">Anthropic API key</h2>
        <p className="text-sm text-muted-foreground">
          Status: {stored ? <span className="text-warm-orange font-medium">Stored</span> : <span className="text-muted-foreground">Not set</span>}.
          The key is encrypted on this device only.
        </p>
      </header>

      {phase.kind === 'view' && (
        <div>
          <Button variant="outline" onClick={startEdit} data-testid="api-key-update">
            {stored ? 'Update key' : 'Set key'}
          </Button>
        </div>
      )}

      {phase.kind === 'edit' && (
        <div className="flex flex-col gap-3">
          <div>
            <label className="text-sm font-medium block mb-1" htmlFor="settings-api-key-input">
              New API key
            </label>
            <Input
              id="settings-api-key-input"
              value={draftKey}
              onChange={(e) => setDraftKey(e.target.value)}
              placeholder="sk-ant-..."
              type="text"
              spellCheck={false}
              autoFocus
              disabled={phase.verifying}
              data-testid="api-key-input"
            />
            {phase.error && (
              <p className="text-sm text-red-600 mt-1" data-testid="api-key-error">
                {phase.error}
              </p>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={cancelEdit} disabled={phase.verifying}>
              Cancel
            </Button>
            <Button
              onClick={submit}
              disabled={phase.verifying}
              className="bg-warm-gradient text-white shadow-warm-glow hover:opacity-90"
              data-testid="api-key-verify"
            >
              {phase.verifying ? 'Verifying…' : 'Verify & save'}
            </Button>
          </div>
        </div>
      )}

      {phase.kind === 'success' && (
        <p className="text-sm text-warm-orange font-medium animate-spring-bloom">
          ✓ Key updated.
        </p>
      )}
    </section>
  )
}
