/**
 * Settings module — viz toggle persistence + verify-then-replace API key flow.
 *
 * Viz toggles live in the `app_settings` key/value table; values are
 * JSON-serialised text. Defaults: every toggle on (per the brief). The set of
 * keys is the `VIZ_TOGGLE_KEYS` array in `@shared/ipc.ts`; the `VizToggleKey`
 * union derives from it, so adding a viz is a one-place edit there.
 */

import type {
  UpdateApiKeyResult,
  VerifyResult,
  VizToggleKey,
  VizToggleState,
} from '@shared/ipc'
import { VIZ_TOGGLE_KEYS } from '@shared/ipc'
import type { DrizzleClient } from './db/client'
import { appSettings } from './db/schema'

const TOGGLE_PREFIX = 'viz.'

export async function getVizToggles(db: DrizzleClient): Promise<VizToggleState> {
  const rows = await db.select().from(appSettings)
  const stored = new Map(rows.map((r) => [r.key, r.value]))
  const out = {} as VizToggleState
  for (const key of VIZ_TOGGLE_KEYS) {
    const raw = stored.get(TOGGLE_PREFIX + key)
    out[key] = raw === null || raw === undefined ? true : parseBool(raw, true)
  }
  return out
}

export async function setVizToggle(
  db: DrizzleClient,
  key: VizToggleKey,
  on: boolean
): Promise<void> {
  if (!VIZ_TOGGLE_KEYS.includes(key)) {
    throw new Error(`Unknown viz toggle key: ${key}`)
  }
  const fullKey = TOGGLE_PREFIX + key
  const value = JSON.stringify(on)
  await db
    .insert(appSettings)
    .values({ key: fullKey, value })
    .onConflictDoUpdate({ target: appSettings.key, set: { value } })
}

/**
 * Verify-then-replace. The injected `verify` and `persist` functions keep this
 * module testable without pulling in safeStorage. On verify failure the
 * previously-stored key is left untouched.
 */
export async function updateApiKey(
  newKey: string,
  verify: (key: string) => Promise<VerifyResult>,
  persist: (key: string) => void | Promise<void>
): Promise<UpdateApiKeyResult> {
  if (!newKey || newKey.trim().length === 0) {
    return { ok: false, error: 'API key is empty.' }
  }
  const result = await verify(newKey)
  if (!result.ok) {
    return { ok: false, error: result.error ?? 'Verification failed.' }
  }
  await persist(newKey)
  return { ok: true }
}

function parseBool(raw: string, fallback: boolean): boolean {
  try {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed === 'boolean') return parsed
    return fallback
  } catch {
    return fallback
  }
}
