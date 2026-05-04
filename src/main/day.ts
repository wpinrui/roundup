/**
 * Day domain functions — read, save (text), and grade a single day.
 *
 * Like `wizard.ts`, every function takes its dependencies explicitly (db,
 * apiKey, userDataDir) so the CLI engine harness exercises the same code path
 * the IPC handlers do.
 */

import { readFileSync } from 'fs'
import { eq, asc, inArray } from 'drizzle-orm'
import type {
  DayRow,
  DaySummary,
  DayScore,
  DaySuggestion,
  DimensionRow,
} from '@shared/ipc'
import type { DrizzleClient } from './db/client'
import { days, dimensions, scores, suggestions } from './db/schema'
import { rubricsPath } from './setup'
import { gradeDay as callGrader } from './ai/grade'
import { rankSuggestions, type HistoricalDay } from './suggestions'

/** Load a day by ISO date `YYYY-MM-DD`, joined with its scores + suggestions. */
export async function getDay(db: DrizzleClient, date: string): Promise<DayRow | null> {
  const [dayRow] = await db.select().from(days).where(eq(days.date, date))
  if (!dayRow) return null

  const [dayScores, daySuggestions] = await Promise.all([
    loadScoresForDate(db, date),
    loadSuggestionsForDate(db, date),
  ])

  return {
    date: dayRow.date,
    rawEntry: dayRow.rawEntry,
    createdAt: dayRow.createdAt,
    gradedAt: dayRow.gradedAt,
    aiNarrative: dayRow.aiNarrative,
    weightedOverallScore: dayRow.weightedOverallScore,
    scores: dayScores,
    suggestions: daySuggestions,
  }
}

/** Lightweight summary per existing day — used for prev/next nav bounds. */
export async function listDays(db: DrizzleClient): Promise<DaySummary[]> {
  const rows = await db
    .select({ date: days.date, gradedAt: days.gradedAt })
    .from(days)
    .orderBy(asc(days.date))
  return rows.map((r) => ({ date: r.date, gradedAt: r.gradedAt }))
}

/**
 * Upsert the day's raw text. Creates the row when missing; updates rawEntry
 * when present. Never touches grade fields (gradedAt, aiNarrative, scores,
 * suggestions). Returns the resulting row joined with whatever grade state
 * already existed.
 */
export async function saveDayText(
  db: DrizzleClient,
  date: string,
  text: string
): Promise<DayRow> {
  if (!isValidDate(date)) {
    throw new Error(`Invalid date "${date}" — expected YYYY-MM-DD.`)
  }
  const now = new Date().toISOString()
  await db
    .insert(days)
    .values({ date, rawEntry: text, createdAt: now })
    .onConflictDoUpdate({
      target: days.date,
      set: { rawEntry: text },
    })
  const row = await getDay(db, date)
  if (!row) throw new Error(`saveDayText: failed to read back row for ${date}.`)
  return row
}

/**
 * End-to-end grading: load the day text + dimensions + rubrics + history →
 * call the grader (Haiku) → rank suggestions → overwrite any prior grade
 * (decision B1: re-grade replaces, no versioning) → return the joined row.
 */
export async function gradeDay(
  db: DrizzleClient,
  apiKey: string,
  userDataDir: string,
  date: string
): Promise<DayRow> {
  const existing = await getDay(db, date)
  if (!existing) {
    throw new Error(`Cannot grade ${date}: no day text saved.`)
  }
  if (!existing.rawEntry || existing.rawEntry.trim().length === 0) {
    throw new Error(`Cannot grade ${date}: day text is empty.`)
  }

  const dimRows = await db.select().from(dimensions).orderBy(asc(dimensions.id))
  if (dimRows.length === 0) {
    throw new Error('Cannot grade: no dimensions configured.')
  }
  const dimensionRows: DimensionRow[] = dimRows.map((d) => ({
    id: d.id,
    name: d.name,
    weight: d.weight,
    successText: d.successText,
    constraintsText: d.constraintsText,
    antiGoalsText: d.antiGoalsText,
    additionalInfo: d.additionalInfo,
    createdAt: d.createdAt,
  }))

  const rubrics = readFileSync(rubricsPath(userDataDir), 'utf8')

  // History excludes today (we're about to overwrite or create today's grade).
  const history = await loadGradedHistory(db, date)

  const graded = await callGrader({ apiKey, dimensions: dimensionRows, rubrics, dayText: existing.rawEntry })
  const ranked = rankSuggestions({ graded, todayDate: date, dimensions: dimensionRows, history })

  // Re-grade overwrites in place (decision B1). Wrap delete-then-insert-then-
  // update in a transaction so a crash mid-write can't leave the day visible
  // as graded with mismatched data (e.g. new scores but stale narrative).
  // The AI call deliberately stays outside — drizzle's better-sqlite3
  // transactions are sync, and a network round-trip inside one would block
  // the DB for the duration of the call.
  const gradedAt = new Date().toISOString()
  db.transaction((tx) => {
    tx.delete(scores).where(eq(scores.dayDate, date)).run()
    tx.delete(suggestions).where(eq(suggestions.dayDate, date)).run()

    if (graded.scores.length > 0) {
      tx.insert(scores)
        .values(
          graded.scores.map((s) => ({
            dayDate: date,
            dimensionId: s.dimensionId,
            score: s.score,
            hoursEstimated: s.hoursEstimated,
          }))
        )
        .run()
    }
    if (ranked.suggestions.length > 0) {
      tx.insert(suggestions)
        .values(
          ranked.suggestions.map((s) => ({
            dayDate: date,
            dimensionId: s.dimensionId,
            rank: s.rank,
            text: s.text,
            mode: s.mode,
          }))
        )
        .run()
    }

    tx.update(days)
      .set({
        gradedAt,
        aiNarrative: graded.narrative,
        weightedOverallScore: graded.weightedOverallScore,
      })
      .where(eq(days.date, date))
      .run()
  })

  const fresh = await getDay(db, date)
  if (!fresh) throw new Error(`gradeDay: failed to read back row for ${date}.`)
  return fresh
}

async function loadScoresForDate(db: DrizzleClient, date: string): Promise<DayScore[]> {
  const rows = await db
    .select({
      dimensionId: scores.dimensionId,
      score: scores.score,
      hoursEstimated: scores.hoursEstimated,
      dimensionName: dimensions.name,
      weight: dimensions.weight,
    })
    .from(scores)
    .innerJoin(dimensions, eq(scores.dimensionId, dimensions.id))
    .where(eq(scores.dayDate, date))
    .orderBy(asc(dimensions.id))
  return rows.map((r) => ({
    dimensionId: r.dimensionId,
    dimensionName: r.dimensionName,
    weight: r.weight,
    score: r.score,
    hoursEstimated: r.hoursEstimated,
  }))
}

async function loadSuggestionsForDate(
  db: DrizzleClient,
  date: string
): Promise<DaySuggestion[]> {
  const rows = await db
    .select({
      dimensionId: suggestions.dimensionId,
      rank: suggestions.rank,
      text: suggestions.text,
      mode: suggestions.mode,
      dimensionName: dimensions.name,
    })
    .from(suggestions)
    .innerJoin(dimensions, eq(suggestions.dimensionId, dimensions.id))
    .where(eq(suggestions.dayDate, date))
    .orderBy(asc(suggestions.rank))
  return rows.map((r) => ({
    dimensionId: r.dimensionId,
    dimensionName: r.dimensionName,
    rank: r.rank,
    text: r.text,
    mode: r.mode,
  }))
}

/**
 * Load all graded days strictly before `today`, oldest-first, with their
 * per-dim scores attached. The ranker uses this for recency + trend math.
 */
async function loadGradedHistory(
  db: DrizzleClient,
  today: string
): Promise<HistoricalDay[]> {
  const dayRows = await db
    .select({
      date: days.date,
      weightedOverallScore: days.weightedOverallScore,
      gradedAt: days.gradedAt,
    })
    .from(days)
    .orderBy(asc(days.date))
  const graded = dayRows.filter(
    (d) => d.gradedAt !== null && d.weightedOverallScore !== null && d.date < today
  )
  if (graded.length === 0) return []

  const dates = graded.map((d) => d.date)
  const scoreRows = await db
    .select()
    .from(scores)
    .where(inArray(scores.dayDate, dates))
  const scoresByDate = new Map<string, Array<{ dimensionId: number; score: number }>>()
  for (const s of scoreRows) {
    const arr = scoresByDate.get(s.dayDate) ?? []
    arr.push({ dimensionId: s.dimensionId, score: s.score })
    scoresByDate.set(s.dayDate, arr)
  }
  return graded.map((d) => ({
    date: d.date,
    weightedOverallScore: d.weightedOverallScore as number,
    scores: scoresByDate.get(d.date) ?? [],
  }))
}

function isValidDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s)
}
