import { defineConfig } from '@playwright/test'
import path from 'path'

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  use: {
    // E2E tests run against the built app
  },
  projects: [
    {
      name: 'electron',
      testMatch: '**/*.test.ts',
    },
  ],
  reporter: [['list']],
  // Build output path for Electron main
  outputDir: path.join(__dirname, 'test-results'),
})
