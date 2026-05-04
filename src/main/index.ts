import { app, BrowserWindow, shell } from 'electron'
import { join } from 'path'
import log from 'electron-log/main'
import { initDb, type DrizzleClient } from './db/client'
import { registerIpcHandlers } from './ipc/handlers'

// @anthropic-ai/sdk is imported here in the main process only.
// The renderer is blocked from importing it via the ESLint no-restricted-imports rule.

log.initialize()

// Belt-and-suspenders for the ROUNDUP_E2E_MOCK_ANTHROPIC test hook in
// src/main/ai/{verify,rubrics}.ts: in a packaged build, scrub the env var
// before anything else imports it, so the AI mock cannot be enabled in
// production even if the variable is somehow set in the user's environment.
// The AI module is deliberately electron-free (the CLI engine harness imports
// it from plain Node), so the guard belongs here, not in the AI module.
if (app.isPackaged) {
  delete process.env['ROUNDUP_E2E_MOCK_ANTHROPIC']
}

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

  let db: DrizzleClient | null = null
  try {
    db = initDb()
  } catch (err) {
    log.error('Failed to initialise database', err)
  }

  registerIpcHandlers(db)

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
