import { useEffect, useState } from 'react'
import { Button } from '@renderer/components/ui/button'
import { Textarea } from '@renderer/components/ui/textarea'

interface Props {
  initialText: string
  /** True when a row already exists for this day (Save just updates rawEntry). */
  hasRow: boolean
  /** True when the day has been graded — enables Re-grade vs first-time Grade language. */
  isGraded: boolean
  saving: boolean
  grading: boolean
  onSave: (text: string) => void
  onGrade: () => void
  /** Optional cancel handler — used in "Edit entry" mode to bail out without saving. */
  onCancel?: () => void
  error?: string | null
}

/**
 * Empty (no row, no text) → only Save shows. Once text is entered the Grade
 * button enables alongside Save. After save, both stay visible. After grade,
 * the parent flips to readout mode; this form is also reused inside an "Edit
 * entry" flow on the readout, where Cancel is provided to bail out.
 */
export function DayInputForm({
  initialText,
  hasRow,
  isGraded,
  saving,
  grading,
  onSave,
  onGrade,
  onCancel,
  error,
}: Props) {
  const [text, setText] = useState(initialText)
  const dirty = text !== initialText

  // Keep local state in sync if the parent reloads the day.
  useEffect(() => {
    setText(initialText)
  }, [initialText])

  const canSave = text.trim().length > 0 && (dirty || !hasRow) && !saving && !grading
  const canGrade = text.trim().length > 0 && !dirty && hasRow && !saving && !grading
  const gradeLabel = isGraded ? 'Re-grade' : 'Grade my day'

  return (
    <div className="flex flex-col gap-4 animate-fade-up" data-testid="day-input-form">
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={10}
        placeholder="Dump your day — what you did, when, for how long. Free-form is fine."
        className="text-base"
        data-testid="day-textarea"
        autoFocus
      />
      {error && (
        <p className="text-sm text-red-600" data-testid="day-form-error">
          {error}
        </p>
      )}
      <div className="flex items-center justify-between">
        <div>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="text-sm text-muted-foreground hover:text-warm-brown"
              disabled={saving || grading}
              data-testid="day-cancel"
            >
              Cancel
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => onSave(text)}
            disabled={!canSave}
            data-testid="day-save"
          >
            {saving ? 'Saving…' : 'Save'}
          </Button>
          <Button
            onClick={onGrade}
            disabled={!canGrade}
            className="bg-warm-gradient text-white shadow-warm-glow hover:opacity-90"
            data-testid="day-grade"
          >
            {grading ? 'Grading…' : gradeLabel}
          </Button>
        </div>
      </div>
      {dirty && hasRow && (
        <p className="text-xs text-muted-foreground">
          Save your edits before re-grading.
        </p>
      )}
    </div>
  )
}
