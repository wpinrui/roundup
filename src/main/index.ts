import { app, BrowserWindow, shell } from 'electron'
import { join } from 'path'
import log from 'electron-log/main'
import { initDb, type DrizzleClient } from './db/client'
import { registerIpcHandlers } from './ipc/handlers'

// @anthropic-ai/sdk is imported here in the main process only.
// The renderer is blocked from importing it via the ESLint no-restricted-imports rule.

log.initialize()

// Belt-and-suspenders env scrub for the E2E test hooks. In a packaged build,
// strip these vars before anything else imports them so the mocks cannot be
// enabled in production even if a user somehow sets them. Centralised here
// (rather than in each consumer) because the modules that read these vars are
// deliberately electron-free — the CLI engine harness imports them from plain
// Node, so the guard belongs at the Electron entry point.
//
// - ROUNDUP_E2E_MOCK_ANTHROPIC: short-circuits Anthropic calls in
//   src/main/ai/{verify,rubrics,grade}.ts to return deterministic stubs.
// - ROUNDUP_E2E_NOOP_SHELL: makes the open-rubrics-* IPC handlers no-op so
//   E2E tests don't actually launch the OS file browser.
if (app.isPackaged) {
  delete process.env['ROUNDUP_E2E_MOCK_ANTHROPIC']
  delete process.env['ROUNDUP_E2E_NOOP_SHELL']
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
