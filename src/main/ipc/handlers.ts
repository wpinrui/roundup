import { ipcMain, app, shell } from 'electron'
import type {
  AppInfo,
  DayRow,
  DaySummary,
  DimensionInput,
  DimensionRow,
  DimensionUpdate,
  GenerateRubricsResult,
  UpdateApiKeyResult,
  VerifyResult,
  VizToggleKey,
  VizToggleState,
} from '@shared/ipc'
import type { DrizzleClient } from '../db/client'
import { verifyKey } from '../ai/verify'
import { saveApiKey, getStoredApiKey } from '../api-key'
import { isSetupComplete, rubricsPath } from '../setup'
import { saveDimensions, generateAndPersistRubrics } from '../wizard'
import { getDay, listDays, saveDayText, gradeDay } from '../day'
import { listDimensions, updateDimensions } from '../dimensions'
import { getVizToggles, setVizToggle, updateApiKey } from '../settings'

/**
 * Registers all IPC handlers for the main process. Must be called after
 * `app.whenReady()`. Pass `null` for `db` only when the database failed to
 * initialise — DB-touching handlers will throw a clear error in that case.
 */
export function registerIpcHandlers(db: DrizzleClient | null): void {
  ipcMain.handle('get-app-info', (): AppInfo => ({
    version: app.getVersion(),
    userDataPath: app.getPath('userData'),
    platform: process.platform,
  }))

  ipcMain.handle(
    'verify-api-key',
    async (_evt, key: string): Promise<VerifyResult> => verifyKey(key)
  )

  ipcMain.handle('save-api-key', async (_evt, key: string): Promise<void> => {
    saveApiKey(app.getPath('userData'), key)
  })

  ipcMain.handle('get-stored-api-key', async (): Promise<string | null> =>
    getStoredApiKey(app.getPath('userData'))
  )

  ipcMain.handle(
    'update-api-key',
    async (_evt, key: string): Promise<UpdateApiKeyResult> =>
      updateApiKey(key, verifyKey, (k) => saveApiKey(app.getPath('userData'), k))
  )

  ipcMain.handle(
    'save-dimensions',
    async (_evt, inputs: DimensionInput[]): Promise<void> => {
      if (!db) throw new Error('Database is not available.')
      await saveDimensions(db, inputs)
    }
  )

  ipcMain.handle('generate-rubrics', async (): Promise<GenerateRubricsResult> => {
    if (!db) throw new Error('Database is not available.')
    const userDataDir = app.getPath('userData')
    const apiKey = getStoredApiKey(userDataDir)
    if (!apiKey) {
      throw new Error('No API key stored. Complete step 1 of the wizard first.')
    }
    const markdown = await generateAndPersistRubrics(db, apiKey, userDataDir)
    return { markdown }
  })

  ipcMain.handle('is-setup-complete', async (): Promise<boolean> =>
    isSetupComplete(app.getPath('userData'))
  )

  // ── Day & grading ─────────────────────────────────────────────────────

  ipcMain.handle(
    'get-day',
    async (_evt, date: string): Promise<DayRow | null> => {
      if (!db) throw new Error('Database is not available.')
      return getDay(db, date)
    }
  )

  ipcMain.handle('list-days', async (): Promise<DaySummary[]> => {
    if (!db) throw new Error('Database is not available.')
    return listDays(db)
  })

  ipcMain.handle(
    'save-day-text',
    async (_evt, date: string, text: string): Promise<DayRow> => {
      if (!db) throw new Error('Database is not available.')
      return saveDayText(db, date, text)
    }
  )

  ipcMain.handle(
    'grade-day',
    async (_evt, date: string): Promise<DayRow> => {
      if (!db) throw new Error('Database is not available.')
      const userDataDir = app.getPath('userData')
      const apiKey = getStoredApiKey(userDataDir)
      if (!apiKey) {
        throw new Error('No API key stored. Set one in Settings first.')
      }
      return gradeDay(db, apiKey, userDataDir, date)
    }
  )

  // ── Settings ──────────────────────────────────────────────────────────

  ipcMain.handle('list-dimensions', async (): Promise<DimensionRow[]> => {
    if (!db) throw new Error('Database is not available.')
    return listDimensions(db)
  })

  ipcMain.handle(
    'update-dimensions',
    async (_evt, inputs: DimensionUpdate[]): Promise<DimensionRow[]> => {
      if (!db) throw new Error('Database is not available.')
      return updateDimensions(db, inputs)
    }
  )

  ipcMain.handle('open-rubrics-folder', async (): Promise<void> => {
    await shell.openPath(app.getPath('userData'))
  })

  ipcMain.handle('open-rubrics-file', async (): Promise<void> => {
    await shell.openPath(rubricsPath(app.getPath('userData')))
  })

  ipcMain.handle('get-viz-toggles', async (): Promise<VizToggleState> => {
    if (!db) throw new Error('Database is not available.')
    return getVizToggles(db)
  })

  ipcMain.handle(
    'set-viz-toggle',
    async (_evt, key: VizToggleKey, on: boolean): Promise<void> => {
      if (!db) throw new Error('Database is not available.')
      await setVizToggle(db, key, on)
    }
  )
}
