import { test, expect, _electron as electron } from '@playwright/test'
import path from 'path'

/**
 * Smoke test: the built app launches, shows the nav rail, and all three nav
 * items are visible. Requires `npm run build:unpack` (or the e2e script which
 * runs `electron-vite build` first) before running.
 */
test('app launches and renders the nav rail', async () => {
  const electronPath = require('electron') as string
  const app = await electron.launch({
    executablePath: electronPath,
    args: [path.join(__dirname, '../out/main/index.js')],
  })

  const window = await app.firstWindow()
  await window.waitForLoadState('domcontentloaded')

  const nav = window.locator('[data-testid="nav-rail"]')
  await expect(nav).toBeVisible()

  await expect(nav.getByRole('link', { name: 'Today' })).toBeVisible()
  await expect(nav.getByRole('link', { name: 'History' })).toBeVisible()
  await expect(nav.getByRole('link', { name: 'Settings' })).toBeVisible()

  await app.close()
})
