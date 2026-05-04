import { useEffect, useState } from 'react'
import type { DimensionRow, DimensionUpdate } from '@shared/ipc'
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@renderer/components/ui/dialog'

const MAX_DIMS = 8

interface Draft extends DimensionUpdate {
  /** Stable client-side key; useful for dragging/keying when id is null. */
  clientKey: string
}

function rowToDraft(r: DimensionRow): Draft {
  return {
    clientKey: `db-${r.id}`,
    id: r.id,
    name: r.name,
    weight: r.weight,
    successText: r.successText,
    constraintsText: r.constraintsText,
    antiGoalsText: r.antiGoalsText,
    additionalInfo: r.additionalInfo,
  }
}

function emptyDraft(): Draft {
  return {
    clientKey: `new-${crypto.randomUUID()}`,
    id: null,
    name: '',
    weight: 5,
    successText: '',
    constraintsText: '',
    antiGoalsText: '',
    additionalInfo: null,
  }
}

function isValid(d: Draft): boolean {
  return (
    d.name.trim().length > 0 &&
    d.successText.trim().length > 0 &&
    d.weight >= 1 &&
    d.weight <= 10
  )
}

export function DimensionsSection() {
  const [drafts, setDrafts] = useState<Draft[] | null>(null)
  const [openKey, setOpenKey] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      const rows = await window.api.listDimensions()
      setDrafts(rows.map(rowToDraft))
    })()
  }, [])

  function update(key: string, patch: Partial<Draft>) {
    setDrafts((prev) => prev?.map((d) => (d.clientKey === key ? { ...d, ...patch } : d)) ?? null)
  }

  function add() {
    setDrafts((prev) => {
      if (!prev || prev.length >= MAX_DIMS) return prev
      const next = emptyDraft()
      setOpenKey(next.clientKey)
      return [...prev, next]
    })
  }

  function remove(key: string) {
    setDrafts((prev) => prev?.filter((d) => d.clientKey !== key) ?? null)
    setOpenKey((prev) => (prev === key ? null : prev))
    setConfirmDelete(null)
  }

  async function save() {
    if (!drafts) return
    setError(null)
    setSuccess(false)
    setSaving(true)
    try {
      const payload: DimensionUpdate[] = drafts.map(({ clientKey: _k, ...d }) => {
        void _k
        return d
      })
      const updated = await window.api.updateDimensions(payload)
      setDrafts(updated.map(rowToDraft))
      setSuccess(true)
      setTimeout(() => setSuccess(false), 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save dimensions.')
    } finally {
      setSaving(false)
    }
  }

  if (!drafts) {
    return <p className="text-sm text-muted-foreground">Loading dimensions…</p>
  }

  const validCount = drafts.filter(isValid).length
  const canSave = validCount === drafts.length && drafts.length >= 1 && !saving

  return (
    <section className="flex flex-col gap-4" data-testid="settings-dimensions">
      <header>
        <h2 className="text-2xl font-bold">Dimensions</h2>
        <p className="text-sm text-muted-foreground">
          Edit what gets graded each day. Changes apply going forward — past grades stay as
          they were.
        </p>
      </header>

      <Accordion value={openKey} onValueChange={setOpenKey}>
        {drafts.map((d, i) => {
          const valid = isValid(d)
          return (
            <AccordionItem key={d.clientKey} id={d.clientKey}>
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
                        onChange={(e) => update(d.clientKey, { name: e.target.value })}
                        data-testid={`dim-name-${i}`}
                      />
                    </div>
                    <div className="w-48">
                      <label className="text-sm font-medium block mb-1">
                        Weight {d.weight}/10
                      </label>
                      <Slider
                        value={d.weight}
                        onChange={(v) => update(d.clientKey, { weight: v })}
                        min={1}
                        max={10}
                        aria-label={`Weight for ${d.name || 'dimension'}`}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium block mb-1">Success looks like</label>
                    <Textarea
                      rows={2}
                      value={d.successText}
                      onChange={(e) => update(d.clientKey, { successText: e.target.value })}
                      data-testid={`dim-success-${i}`}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium block mb-1">Constraints</label>
                    <Textarea
                      rows={2}
                      value={d.constraintsText}
                      onChange={(e) => update(d.clientKey, { constraintsText: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium block mb-1">Anti-goals</label>
                    <Textarea
                      rows={2}
                      value={d.antiGoalsText}
                      onChange={(e) => update(d.clientKey, { antiGoalsText: e.target.value })}
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
                        update(d.clientKey, {
                          additionalInfo: e.target.value || null,
                        })
                      }
                    />
                  </div>
                  {drafts.length > 1 && (
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(d.clientKey)}
                        className="text-sm text-muted-foreground hover:text-red-600"
                        data-testid={`dim-delete-${i}`}
                      >
                        Delete dimension
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
          onClick={add}
          className="rounded-card border border-dashed border-muted-foreground/40 bg-secondary py-3 text-muted-foreground hover:text-warm-orange hover:border-warm-orange transition-colors"
          data-testid="dim-add"
        >
          + Add dimension
        </button>
      )}

      {error && (
        <p className="text-sm text-red-600" data-testid="dim-error">
          {error}
        </p>
      )}
      {success && (
        <p className="text-sm text-warm-orange" data-testid="dim-success">
          ✓ Dimensions saved.
        </p>
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {drafts.length} dimension{drafts.length === 1 ? '' : 's'} (max {MAX_DIMS})
        </p>
        <Button
          onClick={save}
          disabled={!canSave}
          className="bg-warm-gradient text-white shadow-warm-glow hover:opacity-90"
          data-testid="dim-save"
        >
          {saving ? 'Saving…' : 'Save changes'}
        </Button>
      </div>

      <Dialog
        open={confirmDelete !== null}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this dimension?</DialogTitle>
            <DialogDescription>
              You&apos;ll need to click &ldquo;Save changes&rdquo; to confirm. Days that have
              already been graded against this dimension can&apos;t be deleted — they keep
              their historical scores.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => confirmDelete && remove(confirmDelete)}
              className="bg-warm-gradient text-white"
              data-testid="dim-delete-confirm"
            >
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
