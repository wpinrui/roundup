import { useEffect, useState } from 'react'
import { Button } from '@renderer/components/ui/button'
import { Progress } from '@renderer/components/ui/progress'

interface Props {
  onComplete: () => void
}

type Phase = 'generating' | 'done' | 'error'

export function Step3Rubrics({ onComplete }: Props) {
  const [phase, setPhase] = useState<Phase>('generating')
  const [error, setError] = useState<string | null>(null)
  const [pct, setPct] = useState(0)
  const [attempt, setAttempt] = useState(0)

  // Cosmetic indeterminate progress — Sonnet doesn't expose per-dimension
  // events, so we drive an asymptotic bar that caps at ~92% until the call
  // resolves, then snaps to 100% on success.
  useEffect(() => {
    if (phase !== 'generating') return
    const startedAt = Date.now()
    const tick = setInterval(() => {
      const elapsed = Date.now() - startedAt
      setPct(92 - 92 * Math.exp(-elapsed / 12000))
    }, 200)
    return () => clearInterval(tick)
  }, [phase, attempt])

  useEffect(() => {
    let cancelled = false
    setPhase('generating')
    setError(null)
    setPct(0)

    void (async () => {
      try {
        await window.api.generateRubrics()
        if (cancelled) return
        setPct(100)
        setPhase('done')
        setTimeout(onComplete, 700)
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Generation failed.')
        setPhase('error')
      }
    })()

    return () => {
      cancelled = true
    }
  }, [attempt, onComplete])

  return (
    <div
      className="flex flex-col gap-6 items-center text-center animate-fade-up"
      data-testid="wizard-step-3"
    >
      <div>
        <h2 className="text-2xl font-bold mb-2">Generating your rubrics…</h2>
        <p className="text-muted-foreground max-w-md">
          Sonnet is reading your goals and building personalised scoring rubrics. This usually
          takes 30–60 seconds.
        </p>
      </div>

      <div className="w-full max-w-md flex flex-col gap-3">
        <Progress value={pct} />
        <p className="text-sm text-muted-foreground">
          {phase === 'generating' && 'Reading your goals…'}
          {phase === 'done' && '✓ Rubrics ready.'}
          {phase === 'error' && 'Something went wrong.'}
        </p>
      </div>

      {phase === 'error' && (
        <div className="flex flex-col items-center gap-3">
          <p className="text-sm text-red-600 max-w-md" data-testid="step-3-error">
            {error}
          </p>
          <Button
            onClick={() => setAttempt((a) => a + 1)}
            className="bg-warm-gradient text-white shadow-warm-glow hover:opacity-90"
          >
            Try again
          </Button>
        </div>
      )}
    </div>
  )
}
