import { contextBridge, ipcRenderer } from 'electron'
import type { DimensionInput, RoundupAPI } from '@shared/ipc'

const api: RoundupAPI = {
  getAppInfo: () => ipcRenderer.invoke('get-app-info'),
  verifyApiKey: (key: string) => ipcRenderer.invoke('verify-api-key', key),
  saveApiKey: (key: string) => ipcRenderer.invoke('save-api-key', key),
  getStoredApiKey: () => ipcRenderer.invoke('get-stored-api-key'),
  saveDimensions: (inputs: DimensionInput[]) =>
    ipcRenderer.invoke('save-dimensions', inputs),
  generateRubrics: () => ipcRenderer.invoke('generate-rubrics'),
  isSetupComplete: () => ipcRenderer.invoke('is-setup-complete'),
}

contextBridge.exposeInMainWorld('api', api)
