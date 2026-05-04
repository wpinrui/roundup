import path from 'path'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { app } from 'electron'
import log from 'electron-log/main'
import * as schema from './schema'

export type DrizzleClient = ReturnType<typeof drizzle<typeof schema>>

/**
 * Migrations folder path. Bundled with the app via electron-builder's
 * `extraResources`; in dev it's at the project root.
 */
function getMigrationsFolder(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'drizzle')
    : path.join(__dirname, '../../drizzle')
}

export function initDb(): DrizzleClient {
  const dbPath = path.join(app.getPath('userData'), 'roundup.sqlite')
  log.info(`Opening database at ${dbPath}`)

  const sqlite = new Database(dbPath)
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')

  const db = drizzle(sqlite, { schema })
  migrate(db, { migrationsFolder: getMigrationsFolder() })
  log.info('Migrations complete')

  return db
}
