import type Database from 'better-sqlite3'

/**
 * Runs all schema migrations against the provided SQLite connection.
 * Uses CREATE TABLE IF NOT EXISTS so it is idempotent and safe to call on
 * every app start. Extend with ALTER TABLE statements as the schema evolves.
 */
export function runMigrations(sqlite: Database.Database): void {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS days (
      date                   TEXT PRIMARY KEY,
      raw_entry              TEXT NOT NULL,
      created_at             TEXT NOT NULL,
      graded_at              TEXT,
      ai_narrative           TEXT,
      weighted_overall_score REAL
    );

    CREATE TABLE IF NOT EXISTS dimensions (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      name             TEXT    NOT NULL,
      weight           INTEGER NOT NULL,
      success_text     TEXT    NOT NULL,
      constraints_text TEXT    NOT NULL,
      anti_goals_text  TEXT    NOT NULL,
      additional_info  TEXT,
      created_at       TEXT    NOT NULL
    );

    CREATE TABLE IF NOT EXISTS scores (
      day_date        TEXT    NOT NULL REFERENCES days(date),
      dimension_id    INTEGER NOT NULL REFERENCES dimensions(id),
      score           REAL    NOT NULL,
      hours_estimated REAL,
      PRIMARY KEY (day_date, dimension_id)
    );

    CREATE TABLE IF NOT EXISTS suggestions (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      day_date     TEXT    NOT NULL REFERENCES days(date),
      dimension_id INTEGER NOT NULL REFERENCES dimensions(id),
      rank         INTEGER NOT NULL,
      text         TEXT    NOT NULL,
      mode         TEXT    NOT NULL CHECK (mode IN ('fix', 'stretch'))
    );
  `)
}
