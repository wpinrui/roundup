/**
 * First-launch detection.
 *
 * Signal: presence of `<userData>/rubrics.md`. This file is written exactly
 * once at the end of wizard step 3, after dimensions are persisted and
 * Sonnet has produced rubrics. Its presence implies the API key is also
 * stored (since rubric generation requires it) and dimensions exist (since
 * the rubrics were generated against them). One file, no false positives.
 *
 * Chosen over DB row-counts because the DB starts empty after migrations,
 * and over an explicit flag because rubrics.md is the natural artefact of
 * a successful setup — no extra state to keep in sync.
 */

import { existsSync } from 'fs'
import path from 'path'

export const RUBRICS_FILE_NAME = 'rubrics.md'

export function rubricsPath(userDataDir: string): string {
  return path.join(userDataDir, RUBRICS_FILE_NAME)
}

export function isSetupComplete(userDataDir: string): boolean {
  return existsSync(rubricsPath(userDataDir))
}
