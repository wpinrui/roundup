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

export interface RoundupAPI {
  /** Returns basic app metadata — used to verify the IPC bridge is working. */
  getAppInfo: () => Promise<AppInfo>
}
