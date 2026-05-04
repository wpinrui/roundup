import { useEffect, useState } from 'react'
import { StepIndicator, type StepStatus } from './StepIndicator'
import { Step1ApiKey } from './Step1ApiKey'
import { Step2Dimensions } from './Step2Dimensions'
import { Step3Rubrics } from './Step3Rubrics'

type StepNum = 1 | 2 | 3

interface Props {
  /** Called once rubrics have been written and the wizard should dismiss. */
  onDone: () => void
}

/**
 * Three-step first-launch wizard.
 *
 * Resume policy (locked): if a stored API key exists at mount time, skip
 * step 1 and start at step 2. Step 2 partial state is not persisted across
 * launches — every entry restarts step 2 from a single empty card.
 */
export function Wizard({ onDone }: Props) {
  const [step, setStep] = useState<StepNum | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const existing = await window.api.getStoredApiKey()
      if (cancelled) return
      setStep(existing ? 2 : 1)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (step === null) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-background"
        data-testid="wizard-bootstrap"
      >
        <p className="text-muted-foreground">Loading…</p>
      </div>
    )
  }

  const statuses: StepStatus[] = [
    step > 1 ? 'done' : step === 1 ? 'current' : 'pending',
    step > 2 ? 'done' : step === 2 ? 'current' : 'pending',
    step === 3 ? 'current' : 'pending',
  ]
  const indicator = [
    { label: 'API Key', status: statuses[0] },
    { label: 'Dimensions', status: statuses[1] },
    { label: 'Generate Rubrics', status: statuses[2] },
  ]

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-background/95 backdrop-blur-sm"
      data-testid="wizard-overlay"
    >
      <div className="w-full max-w-2xl px-6 py-12">
        <h1 className="font-brand text-warm-gradient text-4xl mb-2 text-center">Roundup</h1>
        <p className="text-center text-muted-foreground mb-10">
          Let&apos;s set up the dimensions you want to track each day.
        </p>

        <div className="mb-10">
          <StepIndicator steps={indicator} />
        </div>

        <div className="rounded-card bg-secondary p-8 shadow-warm">
          {step === 1 && <Step1ApiKey onComplete={() => setStep(2)} />}
          {step === 2 && <Step2Dimensions onComplete={() => setStep(3)} />}
          {step === 3 && <Step3Rubrics onComplete={onDone} />}
        </div>
      </div>
    </div>
  )
}
