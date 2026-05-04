import path from 'path'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { app } from 'electron'
import log from 'electron-log/main'
import * as schema from './schema'
import { runMigrations } from './migrate'

export type DrizzleClient = ReturnType<typeof drizzle<typeof schema>>

let _db: DrizzleClient | null = null

export function getDb(): DrizzleClient {
  if (!_db) {
    throw new Error('Database not initialised — call initDb() first')
  }
  return _db
}

export function initDb(): DrizzleClient {
  const dbPath = path.join(app.getPath('userData'), 'roundup.sqlite')
  log.info(`Opening database at ${dbPath}`)

  const sqlite = new Database(dbPath)
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')

  runMigrations(sqlite)
  log.info('Migrations complete')

  _db = drizzle(sqlite, { schema })
  return _db
}
