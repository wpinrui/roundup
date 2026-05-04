/**
 * Anomaly detection across a window of graded days.
 *
 * Three engineering-default rules from the History brief (tune later if real
 * data argues otherwise):
 *
 *  - long-gap:    ≥ 5 consecutive days where a dim scored ≤ 2
 *  - unusual:     |score − 30dayMean(dim)| ≥ 2.5 on a single day
 *  - declining:   dim's 7-day rolling avg drops by ≥ 0.4 pts/day for ≥ 7
 *                 consecutive days (negative slope on a 7-point window)
 *
 * Pure functions over `DayRow[]` — no IPC, no DB, no electron. Both the
 * renderer (History view) and tests can call directly.
 */

import type { DayRow } from './ipc'

export interface LongGapAnomaly {
  type: 'long-gap'
  dimId: number
  dimName: string
  startDate: string
  endDate: string
  dayCount: number
}

export interface UnusualAnomaly {
  type: 'unusual'
  dimId: number
  dimName: string
  date: string
  score: number
  mean: number
  deltaPts: number
}

export interface DecliningAnomaly {
  type: 'declining'
  dimId: number
  dimName: string
  startDate: string
  endDate: string
  slopePerDay: number
}

export type Anomaly = LongGapAnomaly | UnusualAnomaly | DecliningAnomaly

const LONG_GAP_THRESHOLD_SCORE = 2
const LONG_GAP_MIN_DAYS = 5

const UNUSUAL_DEVIATION = 2.5
const UNUSUAL_MEAN_WINDOW_DAYS = 30

const DECLINING_MIN_SLOPE = 0.4 // absolute pts/day; we only flag when slope is ≤ −threshold
const DECLINING_MIN_DAYS = 7

/** Top-level entry point. Runs all three detectors and concatenates. */
export function detectAnomalies(daysWindow: DayRow[]): Anomaly[] {
  const graded = daysWindow.filter((d) => d.gradedAt !== null && d.scores.length > 0)
  if (graded.length === 0) return []

  const byDim = scoresByDim(graded)
  const out: Anomaly[] = []
  for (const [dimId, series] of byDim) {
    const dimName = series[0].dimName
    out.push(...findLongGaps(dimId, dimName, series))
    out.push(...findUnusual(dimId, dimName, series))
    out.push(...findDeclining(dimId, dimName, series))
  }
  return out
}

interface DimScorePoint {
  date: string
  score: number
  dimName: string
}

function scoresByDim(graded: DayRow[]): Map<number, DimScorePoint[]> {
  const m = new Map<number, DimScorePoint[]>()
  for (const day of graded) {
    for (const s of day.scores) {
      const arr = m.get(s.dimensionId) ?? []
      arr.push({ date: day.date, score: s.score, dimName: s.dimensionName })
      m.set(s.dimensionId, arr)
    }
  }
  // Each dim's series is already date-sorted because daysWindow comes from
  // getDaysInRange which orders ascending.
  return m
}

function findLongGaps(
  dimId: number,
  dimName: string,
  series: DimScorePoint[]
): LongGapAnomaly[] {
  const out: LongGapAnomaly[] = []
  let runStart: number | null = null
  for (let i = 0; i <= series.length; i++) {
    const isLow = i < series.length && series[i].score <= LONG_GAP_THRESHOLD_SCORE
    if (isLow && runStart === null) {
      runStart = i
    } else if (!isLow && runStart !== null) {
      const runLen = i - runStart
      if (runLen >= LONG_GAP_MIN_DAYS) {
        out.push({
          type: 'long-gap',
          dimId,
          dimName,
          startDate: series[runStart].date,
          endDate: series[i - 1].date,
          dayCount: runLen,
        })
      }
      runStart = null
    }
  }
  return out
}

function findUnusual(
  dimId: number,
  dimName: string,
  series: DimScorePoint[]
): UnusualAnomaly[] {
  const out: UnusualAnomaly[] = []
  for (let i = 0; i < series.length; i++) {
    // Mean of the last 30 graded entries for this dim, ending at (but excluding)
    // the current day. Falls back to fewer points when there aren't 30 yet.
    const windowStart = Math.max(0, i - UNUSUAL_MEAN_WINDOW_DAYS)
    const window = series.slice(windowStart, i)
    if (window.length < 3) continue // not enough to characterise "unusual"
    const mean = window.reduce((a, b) => a + b.score, 0) / window.length
    const delta = series[i].score - mean
    if (Math.abs(delta) >= UNUSUAL_DEVIATION) {
      out.push({
        type: 'unusual',
        dimId,
        dimName,
        date: series[i].date,
        score: series[i].score,
        mean,
        deltaPts: delta,
      })
    }
  }
  return out
}

function findDeclining(
  dimId: number,
  dimName: string,
  series: DimScorePoint[]
): DecliningAnomaly[] {
  if (series.length < DECLINING_MIN_DAYS) return []
  const out: DecliningAnomaly[] = []
  // Walk windows of length DECLINING_MIN_DAYS; emit one anomaly per maximal
  // declining run. Avoid emitting overlapping windows by skipping past the end
  // of any run we record.
  let i = 0
  while (i <= series.length - DECLINING_MIN_DAYS) {
    const slope = linearSlope(series.slice(i, i + DECLINING_MIN_DAYS).map((p) => p.score))
    if (slope <= -DECLINING_MIN_SLOPE) {
      // Extend the window as long as the rolling slope stays ≤ -threshold.
      let end = i + DECLINING_MIN_DAYS
      while (
        end < series.length &&
        linearSlope(series.slice(end - DECLINING_MIN_DAYS + 1, end + 1).map((p) => p.score)) <=
          -DECLINING_MIN_SLOPE
      ) {
        end++
      }
      out.push({
        type: 'declining',
        dimId,
        dimName,
        startDate: series[i].date,
        endDate: series[end - 1].date,
        slopePerDay: slope,
      })
      i = end // skip past this run; do not emit overlapping declining anomalies
    } else {
      i++
    }
  }
  return out
}

/** Linear-regression slope of y values against indices 0..n-1. */
function linearSlope(ys: number[]): number {
  const n = ys.length
  if (n < 2) return 0
  const xMean = (n - 1) / 2
  const yMean = ys.reduce((a, b) => a + b, 0) / n
  let num = 0
  let den = 0
  for (let i = 0; i < n; i++) {
    num += (i - xMean) * (ys[i] - yMean)
    den += (i - xMean) ** 2
  }
  if (den === 0) return 0
  return num / den
}
