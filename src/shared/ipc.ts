/**
 * Typed RPC surface exposed from main to renderer via contextBridge.
 * All methods return Promises — ipcRenderer.invoke is always async.
 * No 'any' allowed in this surface.
 */

export interface AppInfo {
  version: string
  userDataPath: string
  platform: NodeJS.Platform
}

/**
 * Bounds on the number of dimensions a user may track. Single source of truth
 * across both processes — DB layer, settings update, wizard UI, settings UI.
 */
export const DIMENSION_COUNT_MIN = 1
export const DIMENSION_COUNT_MAX = 8

/** Shape of a dimension as collected from the wizard form (no id, no createdAt). */
export interface DimensionInput {
  name: string
  weight: number // 1–10 (DB CHECK enforces)
  successText: string
  constraintsText: string
  antiGoalsText: string
  additionalInfo: string | null
}

/** A persisted dimension as read from the DB. */
export interface DimensionRow extends DimensionInput {
  id: number
  createdAt: string
}

/**
 * Settings-side update payload. `id: null` for a new dimension; `id: number`
 * targets an existing row by id. The handler diffs against the current set:
 * unmentioned existing rows are deleted.
 */
export interface DimensionUpdate extends DimensionInput {
  id: number | null
}

export interface VerifyResult {
  ok: boolean
  error?: string
}

export interface UpdateApiKeyResult {
  ok: boolean
  error?: string
}

export interface GenerateRubricsResult {
  markdown: string
}

/** A single dimension's grade for one day, joined with dimension metadata. */
export interface DayScore {
  dimensionId: number
  dimensionName: string
  weight: number
  score: number
  hoursEstimated: number | null
}

/** A ranked tomorrow-suggestion attached to a graded day. */
export interface DaySuggestion {
  dimensionId: number
  dimensionName: string
  rank: number
  text: string
  mode: 'fix' | 'stretch'
}

/** Everything the renderer needs to paint a day-view in any state. */
export interface DayRow {
  date: string
  rawEntry: string
  createdAt: string
  gradedAt: string | null
  aiNarrative: string | null
  weightedOverallScore: number | null
  /** Empty array if the day has not been graded. */
  scores: DayScore[]
  /** Empty array if the day has not been graded. Already ranked top 1–3. */
  suggestions: DaySuggestion[]
}

/** Lightweight row used by prev/next nav to know which days exist. */
export interface DaySummary {
  date: string
  gradedAt: string | null
}

/**
 * The 7 viz toggles the Settings page surfaces (decision Q removed
 * weight-based). The const list is the source of truth — main process uses it
 * for default + validation, renderer iterates it for UI order. The union type
 * is derived from it so adding a viz means changing exactly one place.
 */
export const VIZ_TOGGLE_KEYS = [
  'heatmap',
  'stackedArea',
  'radar',
  'ribbon',
  'gapFromGoal',
  'streaks',
  'anomaly',
] as const

export type VizToggleKey = (typeof VIZ_TOGGLE_KEYS)[number]

export type VizToggleState = Record<VizToggleKey, boolean>

export interface RoundupAPI {
  /** Returns basic app metadata — used to verify the IPC bridge is working. */
  getAppInfo: () => Promise<AppInfo>

  /** Live-pings Anthropic to confirm the key works. ok:false on 401/403/network. */
  verifyApiKey: (key: string) => Promise<VerifyResult>

  /** Encrypts via safeStorage and persists to userData/api-key.bin. */
  saveApiKey: (key: string) => Promise<void>

  /** Returns the stored key plaintext, or null if not set. Used at launch. */
  getStoredApiKey: () => Promise<string | null>

  /**
   * Settings update path: verify-then-replace. On verify failure the previous
   * stored key is left untouched and the error is returned.
   */
  updateApiKey: (key: string) => Promise<UpdateApiKeyResult>

  /** Persists all dimensions to the DB in a single transaction (wizard step 2). */
  saveDimensions: (dimensions: DimensionInput[]) => Promise<void>

  /** Reads dimensions from DB, calls Sonnet, writes rubrics.md, returns content. */
  generateRubrics: () => Promise<GenerateRubricsResult>

  /** True when rubrics.md exists in userData (the gate signal). */
  isSetupComplete: () => Promise<boolean>

  // ── Day & grading ─────────────────────────────────────────────────────
  /** Load a day by ISO date `YYYY-MM-DD`; returns null when no row exists. */
  getDay: (date: string) => Promise<DayRow | null>

  /** Minimum metadata for every day with a row — used by prev/next nav bounds. */
  listDays: () => Promise<DaySummary[]>

  /**
   * Upsert the day's text. Creates the row when missing; updates rawEntry when
   * present. Never touches grade fields. Returns the resulting row.
   */
  saveDayText: (date: string, text: string) => Promise<DayRow>

  /**
   * Calls grade.ts + ranker, persists narrative + scores + suggestions for the
   * day. Overwrites any previous grade in place (decision B1). Returns the
   * freshly-graded row with everything joined.
   */
  gradeDay: (date: string) => Promise<DayRow>

  // ── Settings ──────────────────────────────────────────────────────────
  /** All persisted dimensions, ordered by id. */
  listDimensions: () => Promise<DimensionRow[]>

  /**
   * Replace-set update: payload entries with `id` are updated in place; entries
   * with `id: null` are inserted; existing rows missing from the payload are
   * deleted. Enforces the 1–8 bound. Deletion fails (FK) if the dimension has
   * referencing scores or suggestions — that protects historical grades.
   */
  updateDimensions: (inputs: DimensionUpdate[]) => Promise<DimensionRow[]>

  /** Opens userData (the folder containing rubrics.md) in the OS file browser. */
  openRubricsFolder: () => Promise<void>

  /** Opens rubrics.md itself in the OS default markdown editor. */
  openRubricsFile: () => Promise<void>

  /** Reads all 7 viz toggles; missing keys default to true. */
  getVizToggles: () => Promise<VizToggleState>

  /** Persist a single viz toggle. */
  setVizToggle: (key: VizToggleKey, on: boolean) => Promise<void>
}
