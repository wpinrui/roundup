/**
 * Algorithmic suggestion ranker.
 *
 * Picks the top 1–3 dimensions to surface tomorrow-suggestions for, using the
 * priority function from GDD § Tomorrow Suggestions — Ranking:
 *
 *   priority(dim) = weight × recency_penalty × trend_factor × gap_from_goal
 *
 * Mode label (decision P): with ≥ 7 graded days (today inclusive) AND a
 * weighted 7-day average > 7, the day is in 'stretch' mode; otherwise 'fix'.
 *
 * Pure-Node, electron-free — the CLI engine harness imports this directly so
 * Tester's CLI output and the UI render the same numbers.
 */

import type { DimensionRow } from '@shared/ipc'
import type { GradeResult, GradeCandidateSuggestion } from './ai/grade'

const DECENT_SCORE = 6 // GDD § Rubric Design — "5–6 normal okay day"; ≥6 = at-or-above
const GOAL_SCORE = 7 // GDD § Rubric Design — "7–8 clearly good day"
const MODE_THRESHOLD = 7 // GDD example

export type RankerMode = 'fix' | 'stretch'

export interface HistoricalDay {
  date: string // YYYY-MM-DD; assumed to be a graded day (gradedAt set)
  weightedOverallScore: number
  scores: Array<{ dimensionId: number; score: number }>
}

export interface RankerInput {
  /** Today's just-computed grade — not yet persisted. */
  graded: GradeResult
  /** Today's calendar date in YYYY-MM-DD; used for recency math. */
  todayDate: string
  /** Dimensions in scoring order; weights drive priority. */
  dimensions: DimensionRow[]
  /** Prior graded days only (today is conveyed via `graded`). */
  history: HistoricalDay[]
}

export interface RankedSuggestion {
  dimensionId: number
  rank: number
  text: string
  mode: RankerMode
}

export interface RankerResult {
  mode: RankerMode
  suggestions: RankedSuggestion[]
}

export function rankSuggestions(input: RankerInput): RankerResult {
  const { graded, dimensions, history, todayDate } = input

  const mode = chooseMode(graded.weightedOverallScore, history)

  const candidatesByDim = groupCandidates(graded.candidateSuggestions)
  const todayScoreByDim = new Map(graded.scores.map((s) => [s.dimensionId, s.score]))

  // Score every dim with at least one candidate suggestion. Dims with no
  // candidates can't surface a suggestion regardless of priority.
  const ranked = dimensions
    .filter((d) => (candidatesByDim.get(d.id) ?? []).length > 0)
    .map((d) => ({
      dim: d,
      priority: priorityFor(d, todayScoreByDim.get(d.id) ?? 0, history, todayDate),
    }))
    .sort((a, b) => b.priority - a.priority)

  const topN = Math.min(3, ranked.length)
  const suggestions: RankedSuggestion[] = []
  for (let i = 0; i < topN; i++) {
    const { dim } = ranked[i]
    const pool = candidatesByDim.get(dim.id) ?? []
    if (pool.length === 0) continue
    suggestions.push({
      dimensionId: dim.id,
      rank: i + 1,
      text: pool[0].text,
      mode,
    })
  }

  return { mode, suggestions }
}

/**
 * Mode = 'stretch' iff there have been ≥ 7 graded days (today inclusive) AND
 * the weighted 7-day average (today inclusive) exceeds the threshold.
 */
function chooseMode(todayWeightedOverall: number, history: HistoricalDay[]): RankerMode {
  const totalGraded = history.length + 1
  if (totalGraded < 7) return 'fix'
  // Take the most recent 6 historical days + today = last 7.
  const recent6 = history.slice(-6).map((d) => d.weightedOverallScore)
  const sevenDay = [...recent6, todayWeightedOverall]
  const avg = sevenDay.reduce((a, b) => a + b, 0) / sevenDay.length
  return avg > MODE_THRESHOLD ? 'stretch' : 'fix'
}

function groupCandidates(
  candidates: GradeCandidateSuggestion[]
): Map<number, GradeCandidateSuggestion[]> {
  const m = new Map<number, GradeCandidateSuggestion[]>()
  for (const c of candidates) {
    const arr = m.get(c.dimensionId) ?? []
    arr.push(c)
    m.set(c.dimensionId, arr)
  }
  return m
}

function priorityFor(
  dim: DimensionRow,
  todayScore: number,
  history: HistoricalDay[],
  todayDate: string
): number {
  const recency = recencyPenalty(dim.id, history, todayDate)
  const trend = trendFactor(dim.id, history, todayScore)
  const gap = gapFromGoal(todayScore)
  return dim.weight * recency * trend * gap
}

/**
 * Days since this dimension last hit a decent score (≥ DECENT_SCORE).
 * Returns 1.0 baseline when the most recent decent day is today (or no history
 * at all is treated as "long time" → 4.0). Grows linearly: +1.0 per 7 days,
 * capped at 4.0.
 */
function recencyPenalty(
  dimensionId: number,
  history: HistoricalDay[],
  todayDate: string
): number {
  // Walk most-recent-first.
  for (let i = history.length - 1; i >= 0; i--) {
    const day = history[i]
    const score = day.scores.find((s) => s.dimensionId === dimensionId)?.score
    if (score !== undefined && score >= DECENT_SCORE) {
      const days = daysBetween(day.date, todayDate)
      return Math.min(4.0, 1.0 + days / 7)
    }
  }
  return 4.0
}

/**
 * Linear-regression slope of this dim's scores over the last 7 days
 * (history + today). Negative slope → factor = 1 + |slope| (capped at 3).
 * Non-negative slope → 1.0.
 */
function trendFactor(
  dimensionId: number,
  history: HistoricalDay[],
  todayScore: number
): number {
  const last6 = history.slice(-6).map((d) => d.scores.find((s) => s.dimensionId === dimensionId)?.score ?? null)
  const series = [...last6, todayScore].filter((v): v is number => v !== null)
  if (series.length < 2) return 1.0

  const n = series.length
  const xs = series.map((_, i) => i)
  const xMean = xs.reduce((a, b) => a + b, 0) / n
  const yMean = series.reduce((a, b) => a + b, 0) / n
  let num = 0
  let den = 0
  for (let i = 0; i < n; i++) {
    num += (xs[i] - xMean) * (series[i] - yMean)
    den += (xs[i] - xMean) ** 2
  }
  if (den === 0) return 1.0
  const slope = num / den
  if (slope >= 0) return 1.0
  return Math.min(3.0, 1.0 + Math.abs(slope))
}

/** max(0.5, GOAL - score). 0.5 floor so dims at-or-above goal still rank. */
function gapFromGoal(todayScore: number): number {
  return Math.max(0.5, GOAL_SCORE - todayScore)
}

/** Whole-day difference. Both dates are YYYY-MM-DD. */
function daysBetween(earlier: string, later: string): number {
  const e = Date.UTC(
    Number(earlier.slice(0, 4)),
    Number(earlier.slice(5, 7)) - 1,
    Number(earlier.slice(8, 10))
  )
  const l = Date.UTC(
    Number(later.slice(0, 4)),
    Number(later.slice(5, 7)) - 1,
    Number(later.slice(8, 10))
  )
  return Math.round((l - e) / (1000 * 60 * 60 * 24))
}
