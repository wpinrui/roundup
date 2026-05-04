import { useState } from 'react'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'

interface Props {
  onComplete: () => void
}

type State =
  | { kind: 'idle' }
  | { kind: 'verifying' }
  | { kind: 'error'; message: string }
  | { kind: 'success' }

export function Step1ApiKey({ onComplete }: Props) {
  const [key, setKey] = useState('')
  const [state, setState] = useState<State>({ kind: 'idle' })

  async function handleVerify() {
    if (!key.trim()) {
      setState({ kind: 'error', message: 'Please enter an API key.' })
      return
    }
    setState({ kind: 'verifying' })
    const result = await window.api.verifyApiKey(key)
    if (!result.ok) {
      setState({ kind: 'error', message: result.error ?? 'Verification failed.' })
      return
    }
    await window.api.saveApiKey(key)
    setState({ kind: 'success' })
    // Brief pause so the user sees the success state before advancing.
    setTimeout(onComplete, 600)
  }

  const isVerifying = state.kind === 'verifying'
  const isSuccess = state.kind === 'success'

  return (
    <div className="flex flex-col gap-6 animate-fade-up" data-testid="wizard-step-1">
      <div>
        <h2 className="text-2xl font-bold mb-2">Connect your Anthropic API key</h2>
        <p className="text-muted-foreground">
          Roundup uses your own Anthropic API key to grade your day. The key is stored encrypted on
          this device only — it never leaves your machine except for calls to Anthropic.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="api-key" className="text-sm font-medium">
          API key
        </label>
        <Input
          id="api-key"
          type="text"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="sk-ant-..."
          disabled={isVerifying || isSuccess}
          autoFocus
          spellCheck={false}
          data-testid="api-key-input"
        />
        {state.kind === 'error' && (
          <p className="text-sm text-red-600" data-testid="api-key-error">
            {state.message}
          </p>
        )}
        {isSuccess && (
          <p className="text-sm text-warm-orange font-medium animate-spring-bloom">
            ✓ Key verified. Moving on…
          </p>
        )}
      </div>

      <div className="flex justify-end">
        <Button
          onClick={handleVerify}
          disabled={isVerifying || isSuccess}
          className="bg-warm-gradient text-white shadow-warm-glow hover:opacity-90"
          data-testid="verify-button"
        >
          {isVerifying ? 'Verifying…' : isSuccess ? 'Verified ✓' : 'Verify →'}
        </Button>
      </div>
    </div>
  )
}
