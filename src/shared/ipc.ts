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

/** Shape of a dimension as collected from the wizard form (no id, no createdAt). */
export interface DimensionInput {
  name: string
  weight: number // 1–10 (DB CHECK enforces)
  successText: string
  constraintsText: string
  antiGoalsText: string
  additionalInfo: string | null
}

export interface VerifyResult {
  ok: boolean
  error?: string
}

export interface GenerateRubricsResult {
  markdown: string
}

export interface RoundupAPI {
  /** Returns basic app metadata — used to verify the IPC bridge is working. */
  getAppInfo: () => Promise<AppInfo>

  /** Live-pings Anthropic to confirm the key works. ok:false on 401/403/network. */
  verifyApiKey: (key: string) => Promise<VerifyResult>

  /** Encrypts via safeStorage and persists to userData/api-key.bin. */
  saveApiKey: (key: string) => Promise<void>

  /** Returns the stored key plaintext, or null if not set. Used at launch. */
  getStoredApiKey: () => Promise<string | null>

  /** Persists all dimensions to the DB in a single transaction. */
  saveDimensions: (dimensions: DimensionInput[]) => Promise<void>

  /** Reads dimensions from DB, calls Sonnet, writes rubrics.md, returns content. */
  generateRubrics: () => Promise<GenerateRubricsResult>

  /** True when rubrics.md exists in userData (the gate signal). */
  isSetupComplete: () => Promise<boolean>
}
