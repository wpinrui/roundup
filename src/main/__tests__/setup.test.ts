import { describe, it, expect, beforeEach } from 'vitest'
import { mkdtempSync, writeFileSync } from 'fs'
import path from 'path'
import os from 'os'
import { isSetupComplete, rubricsPath } from '../setup'

describe('first-launch detection', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(path.join(os.tmpdir(), 'roundup-setup-'))
  })

  it('returns false when rubrics.md does not exist', () => {
    expect(isSetupComplete(dir)).toBe(false)
  })

  it('returns true once rubrics.md is written', () => {
    writeFileSync(rubricsPath(dir), '## Work\n\n| Score | Descriptor |\n', 'utf8')
    expect(isSetupComplete(dir)).toBe(true)
  })
})
