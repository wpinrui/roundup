import { defineConfig } from 'drizzle-kit'

/**
 * Configuration for drizzle-kit. Run `npm run drizzle:generate` after changing
 * `src/main/db/schema.ts` to produce a new migration file in `./drizzle/`.
 * Generated migrations are committed to git and bundled into the packaged app
 * via electron-builder's `extraResources`.
 */
export default defineConfig({
  schema: './src/main/db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
})
