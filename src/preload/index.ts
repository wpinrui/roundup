import { contextBridge, ipcRenderer } from 'electron'
import type { RoundupAPI } from '@shared/ipc'

const api: RoundupAPI = {
  getAppInfo: () => ipcRenderer.invoke('get-app-info'),
}

contextBridge.exposeInMainWorld('api', api)
