import { app, BrowserWindow, shell } from 'electron'
import { join } from 'path'
import log from 'electron-log/main'
import { initDb } from './db/client'
import { registerIpcHandlers } from './ipc/handlers'

// @anthropic-ai/sdk is imported here in the main process only.
// The renderer is blocked from importing it via the ESLint no-restricted-imports rule.

log.initialize()

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  win.on('ready-to-show', () => win.show())

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

app.whenReady().then(() => {
  if (process.platform === 'win32') {
    app.setAppUserModelId(app.isPackaged ? 'com.roundup.app' : process.execPath)
  }

  log.info(`Roundup starting — version ${app.getVersion()}`)

  try {
    initDb()
  } catch (err) {
    log.error('Failed to initialise database', err)
  }

  registerIpcHandlers()

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
