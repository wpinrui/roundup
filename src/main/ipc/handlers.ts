import { ipcMain, app } from 'electron'
import type { AppInfo, DimensionInput, GenerateRubricsResult, VerifyResult } from '@shared/ipc'
import type { DrizzleClient } from '../db/client'
import { verifyKey } from '../ai/verify'
import { saveApiKey, getStoredApiKey } from '../api-key'
import { isSetupComplete } from '../setup'
import { saveDimensions, generateAndPersistRubrics } from '../wizard'

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
}
