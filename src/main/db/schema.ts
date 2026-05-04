import { sqliteTable, text, real, integer, primaryKey } from 'drizzle-orm/sqlite-core'

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
export const dimensions = sqliteTable('dimensions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  weight: integer('weight').notNull(), // 1–10
  successText: text('success_text').notNull(),
  constraintsText: text('constraints_text').notNull(),
  antiGoalsText: text('anti_goals_text').notNull(),
  additionalInfo: text('additional_info'),
  createdAt: text('created_at').notNull(),
})

/**
 * Per-day per-dimension AI grades.
 * Composite primary key (day_date, dimension_id).
 * hours_estimated comes from the AI grading output (decision M).
 *
 * Immutability note: once written, scores are never updated — the application
 * layer enforces this (no UPDATE path after graded_at is set on the parent day).
 * Re-grading creates a new row; a future migration could add a `superseded_at`
 * column if audit trail becomes required.
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
    score: real('score').notNull(), // 0–10
    hoursEstimated: real('hours_estimated'),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.dayDate, table.dimensionId] }),
  })
)

/**
 * AI-generated candidate suggestions for tomorrow per dimension.
 * mode: 'fix' = address weak areas; 'stretch' = push on strong areas (decision P).
 */
export const suggestions = sqliteTable('suggestions', {
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
})
