import { sql } from 'drizzle-orm'
import { sqliteTable, text, real, integer, primaryKey, check } from 'drizzle-orm/sqlite-core'

/**
 * Single source of truth for the database schema.
 *
 * Workflow: change this file, then `npm run drizzle:generate` to produce a new
 * migration in `./drizzle/`. Migrations run automatically on app start.
 *
 * DB-enforces-all-spec-constraints rule: every range/enum constraint expressed
 * in the GDD lives in this schema as a CHECK or enum. The application layer
 * does not re-enforce — this is the canonical boundary.
 */

/** One entry per day (YYYY-MM-DD primary key). */
export const days = sqliteTable('days', {
  date: text('date').primaryKey(),
  rawEntry: text('raw_entry').notNull(),
  createdAt: text('created_at').notNull(),
  gradedAt: text('graded_at'),
  aiNarrative: text('ai_narrative'),
  weightedOverallScore: real('weighted_overall_score'),
})

/** User-defined tracking dimensions (e.g. Work, Health, Fitness). */
export const dimensions = sqliteTable(
  'dimensions',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    weight: integer('weight').notNull(), // 1–10 (GDD)
    successText: text('success_text').notNull(),
    constraintsText: text('constraints_text').notNull(),
    antiGoalsText: text('anti_goals_text').notNull(),
    additionalInfo: text('additional_info'),
    createdAt: text('created_at').notNull(),
  },
  (table) => ({
    weightRange: check('dimensions_weight_range', sql`${table.weight} BETWEEN 1 AND 10`),
  })
)

/**
 * Per-day per-dimension AI grades.
 * Composite primary key (day_date, dimension_id).
 * hours_estimated comes from the AI grading output (decision M).
 *
 * Re-grade semantics (decision B1): re-grading replaces the day's score rows
 * in place via delete-then-insert inside a transaction (see `day.ts` →
 * `gradeDay`). Prior scores are not preserved. The composite PK on
 * (day_date, dimension_id) means there is one row per dim per day at any time.
 * Versioning via a `superseded_at` column is a tracked carry-forward; not yet
 * implemented and not in scope for this PR.
 */
export const scores = sqliteTable(
  'scores',
  {
    dayDate: text('day_date')
      .notNull()
      .references(() => days.date),
    dimensionId: integer('dimension_id')
      .notNull()
      .references(() => dimensions.id),
    score: real('score').notNull(), // 0–10 (GDD)
    hoursEstimated: real('hours_estimated'),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.dayDate, table.dimensionId] }),
    scoreRange: check('scores_score_range', sql`${table.score} BETWEEN 0 AND 10`),
  })
)

/**
 * AI-generated candidate suggestions for tomorrow per dimension.
 * mode: 'fix' = address weak areas; 'stretch' = push on strong areas (decision P).
 */
export const suggestions = sqliteTable(
  'suggestions',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    dayDate: text('day_date')
      .notNull()
      .references(() => days.date),
    dimensionId: integer('dimension_id')
      .notNull()
      .references(() => dimensions.id),
    rank: integer('rank').notNull(),
    text: text('text').notNull(),
    mode: text('mode', { enum: ['fix', 'stretch'] }).notNull(),
  },
  (table) => ({
    rankPositive: check('suggestions_rank_positive', sql`${table.rank} > 0`),
    modeEnum: check('suggestions_mode_enum', sql`${table.mode} IN ('fix', 'stretch')`),
  })
)

/**
 * Key/value bag for app-wide preferences (viz toggles today, room for more
 * later). Values are JSON-serialised text so any small primitive or shape
 * fits without further migrations.
 */
export const appSettings = sqliteTable('app_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
})
