import { contextBridge, ipcRenderer } from 'electron'
import type { DimensionInput, DimensionUpdate, RoundupAPI, VizToggleKey } from '@shared/ipc'

const api: RoundupAPI = {
  getAppInfo: () => ipcRenderer.invoke('get-app-info'),
  verifyApiKey: (key: string) => ipcRenderer.invoke('verify-api-key', key),
  saveApiKey: (key: string) => ipcRenderer.invoke('save-api-key', key),
  getStoredApiKey: () => ipcRenderer.invoke('get-stored-api-key'),
  updateApiKey: (key: string) => ipcRenderer.invoke('update-api-key', key),
  saveDimensions: (inputs: DimensionInput[]) =>
    ipcRenderer.invoke('save-dimensions', inputs),
  generateRubrics: () => ipcRenderer.invoke('generate-rubrics'),
  isSetupComplete: () => ipcRenderer.invoke('is-setup-complete'),

  // Day & grading
  getDay: (date: string) => ipcRenderer.invoke('get-day', date),
  listDays: () => ipcRenderer.invoke('list-days'),
  saveDayText: (date: string, text: string) =>
    ipcRenderer.invoke('save-day-text', date, text),
  gradeDay: (date: string) => ipcRenderer.invoke('grade-day', date),
  getDaysInRange: (start: string, end: string) =>
    ipcRenderer.invoke('get-days-in-range', start, end),

  // Settings
  listDimensions: () => ipcRenderer.invoke('list-dimensions'),
  updateDimensions: (inputs: DimensionUpdate[]) =>
    ipcRenderer.invoke('update-dimensions', inputs),
  openRubricsFolder: () => ipcRenderer.invoke('open-rubrics-folder'),
  openRubricsFile: () => ipcRenderer.invoke('open-rubrics-file'),
  getVizToggles: () => ipcRenderer.invoke('get-viz-toggles'),
  setVizToggle: (key: VizToggleKey, on: boolean) =>
    ipcRenderer.invoke('set-viz-toggle', key, on),
}

contextBridge.exposeInMainWorld('api', api)
