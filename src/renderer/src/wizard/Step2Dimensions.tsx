import { useState } from 'react'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Textarea } from '@renderer/components/ui/textarea'
import { Slider } from '@renderer/components/ui/slider'
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@renderer/components/ui/accordion'
import type { DimensionInput } from '@shared/ipc'

const PRESETS = ['Work', 'Health', 'Fitness', 'Sleep', 'Social', 'Learning'] as const
const MAX_DIMS = 8

interface Props {
  onComplete: () => void
}

interface DraftDimension extends DimensionInput {
  id: string // local-only id for accordion + key
}

function emptyDraft(name: string): DraftDimension {
  return {
    id: crypto.randomUUID(),
    name,
    weight: 5,
    successText: '',
    constraintsText: '',
    antiGoalsText: '',
    additionalInfo: null,
  }
}

function isValid(d: DraftDimension): boolean {
  return (
    d.name.trim().length > 0 &&
    d.successText.trim().length > 0 &&
    d.weight >= 1 &&
    d.weight <= 10
  )
}

export function Step2Dimensions({ onComplete }: Props) {
  const [drafts, setDrafts] = useState<DraftDimension[]>([emptyDraft('')])
  const [openId, setOpenId] = useState<string | null>(drafts[0]?.id ?? null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function addPreset(name: string) {
    if (drafts.length >= MAX_DIMS) return
    const next = emptyDraft(name)
    setDrafts((prev) => [...prev, next])
    setOpenId(next.id)
  }

  function addBlank() {
    if (drafts.length >= MAX_DIMS) return
    const next = emptyDraft('')
    setDrafts((prev) => [...prev, next])
    setOpenId(next.id)
  }

  function update(id: string, patch: Partial<DraftDimension>) {
    setDrafts((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)))
  }

  function remove(id: string) {
    setDrafts((prev) => prev.filter((d) => d.id !== id))
    setOpenId((prev) => (prev === id ? null : prev))
  }

  const validCount = drafts.filter(isValid).length
  const canContinue = validCount >= 1 && !saving

  async function handleContinue() {
    setError(null)
    setSaving(true)
    try {
      const valid = drafts.filter(isValid)
      // Strip local id before sending across IPC.
      const payload: DimensionInput[] = valid.map(
        ({ name, weight, successText, constraintsText, antiGoalsText, additionalInfo }) => ({
          name,
          weight,
          successText,
          constraintsText,
          antiGoalsText,
          additionalInfo: additionalInfo && additionalInfo.trim() ? additionalInfo : null,
        })
      )
      await window.api.saveDimensions(payload)
      onComplete()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save dimensions.')
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 animate-fade-up" data-testid="wizard-step-2">
      <div>
        <h2 className="text-2xl font-bold mb-2">What do you want to track?</h2>
        <p className="text-muted-foreground">
          Add up to {MAX_DIMS} dimensions. Each gets its own daily score against a rubric we
          generate from your goals. You can edit these later in Settings.
        </p>
      </div>

      <div>
        <p className="text-sm font-medium mb-2 text-muted-foreground">Quick add</p>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => addPreset(p)}
              disabled={drafts.length >= MAX_DIMS}
              className="rounded-full border border-warm-orange/40 bg-warm-cream px-3 py-1 text-sm text-warm-brown hover:bg-warm-peach/40 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              + {p}
            </button>
          ))}
        </div>
      </div>

      <Accordion value={openId} onValueChange={setOpenId}>
        {drafts.map((d, i) => {
          const valid = isValid(d)
          return (
            <AccordionItem key={d.id} id={d.id}>
              <AccordionTrigger>
                <span className="flex items-center gap-3">
                  <span className="font-semibold">{d.name || `Dimension ${i + 1}`}</span>
                  <span className="text-sm text-muted-foreground">weight {d.weight}/10</span>
                  {valid && <span className="text-sm text-warm-orange">✓</span>}
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="flex flex-col gap-4">
                  <div className="flex gap-4 items-start">
                    <div className="flex-1">
                      <label className="text-sm font-medium block mb-1">Name</label>
                      <Input
                        value={d.name}
                        onChange={(e) => update(d.id, { name: e.target.value })}
                        placeholder="e.g. Work"
                        data-testid={`dim-name-${i}`}
                      />
                    </div>
                    <div className="w-48">
                      <label className="text-sm font-medium block mb-1">
                        Weight {d.weight}/10
                      </label>
                      <Slider
                        value={d.weight}
                        onChange={(v) => update(d.id, { weight: v })}
                        min={1}
                        max={10}
                        aria-label={`Weight for ${d.name || 'dimension'}`}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium block mb-1">
                      What does success look like?
                    </label>
                    <Textarea
                      rows={2}
                      value={d.successText}
                      onChange={(e) => update(d.id, { successText: e.target.value })}
                      placeholder="e.g. Deep work sessions completed; meaningful progress on projects."
                      data-testid={`dim-success-${i}`}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium block mb-1">Constraints</label>
                    <Textarea
                      rows={2}
                      value={d.constraintsText}
                      onChange={(e) => update(d.id, { constraintsText: e.target.value })}
                      placeholder="e.g. Family evenings off-limits."
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium block mb-1">Anti-goals</label>
                    <Textarea
                      rows={2}
                      value={d.antiGoalsText}
                      onChange={(e) => update(d.id, { antiGoalsText: e.target.value })}
                      placeholder="e.g. Busywork, reactive email all day."
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium block mb-1">
                      Additional info (optional)
                    </label>
                    <Textarea
                      rows={2}
                      value={d.additionalInfo ?? ''}
                      onChange={(e) =>
                        update(d.id, { additionalInfo: e.target.value || null })
                      }
                      placeholder="Anything else the grader should know."
                    />
                  </div>
                  {drafts.length > 1 && (
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => remove(d.id)}
                        className="text-sm text-muted-foreground hover:text-red-600"
                      >
                        Remove dimension
                      </button>
                    </div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          )
        })}
      </Accordion>

      {drafts.length < MAX_DIMS && (
        <button
          type="button"
          onClick={addBlank}
          className="rounded-card border border-dashed border-muted-foreground/40 bg-secondary py-4 text-muted-foreground hover:text-warm-orange hover:border-warm-orange transition-colors"
        >
          + Add another dimension
        </button>
      )}

      {error && (
        <p className="text-sm text-red-600" data-testid="step-2-error">
          {error}
        </p>
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {validCount} of max {MAX_DIMS} valid
        </p>
        <Button
          onClick={handleContinue}
          disabled={!canContinue}
          className="bg-warm-gradient text-white shadow-warm-glow hover:opacity-90"
          data-testid="continue-button"
        >
          {saving ? 'Saving…' : 'Continue →'}
        </Button>
      </div>
    </div>
  )
}
