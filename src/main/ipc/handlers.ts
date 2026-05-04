import { ipcMain, app } from 'electron'
import type { AppInfo } from '@shared/ipc'

/**
 * Registers all IPC handlers for the main process.
 * Must be called after the app 'ready' event.
 */
export function registerIpcHandlers(): void {
  ipcMain.handle('get-app-info', (): AppInfo => ({
    version: app.getVersion(),
    userDataPath: app.getPath('userData'),
    platform: process.platform,
  }))
}
