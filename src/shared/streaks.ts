/**
 * Soft streak counters per GDD § Visualization Candidates.
 *
 * "X of last N" rather than reset-on-miss — counts how many days in the window
 * a dim scored at-or-above the threshold. Pure function over `DayRow[]`.
 *
 * Default threshold = 5 ("normal okay day" floor per GDD § Rubric Design).
 * The History brief surfaces this as the streak threshold; the gradeDay
 * priority math uses 6 ("decent"). Two intentionally distinct knobs.
 */

import type { DayRow } from './ipc'

export const STREAK_THRESHOLD = 5

interface DimStreak {
  dimId: number
  dimName: string
  /** Days in the window at-or-above threshold. */
  hits: number
  /** Total graded days in the window. */
  total: number
}

/**
 * Count "X of last N" per dim across the window. Days without a graded score
 * for a dim don't count toward `total` for that dim. Ungraded days are
 * excluded entirely (no scores to count).
 *
 * Output is sorted by descending hit ratio; ties broken by total (more
 * graded days first, since a 5/5 means more than a 1/1).
 */
export function computeStreaks(daysWindow: DayRow[]): DimStreak[] {
  const graded = daysWindow.filter((d) => d.gradedAt !== null && d.scores.length > 0)
  const byDim = new Map<number, { name: string; hits: number; total: number }>()
  for (const day of graded) {
    for (const s of day.scores) {
      const cur = byDim.get(s.dimensionId) ?? { name: s.dimensionName, hits: 0, total: 0 }
      cur.total += 1
      if (s.score >= STREAK_THRESHOLD) cur.hits += 1
      byDim.set(s.dimensionId, cur)
    }
  }
  const out: DimStreak[] = []
  for (const [dimId, agg] of byDim) {
    out.push({ dimId, dimName: agg.name, hits: agg.hits, total: agg.total })
  }
  out.sort((a, b) => {
    const ar = a.total === 0 ? 0 : a.hits / a.total
    const br = b.total === 0 ? 0 : b.hits / b.total
    if (br !== ar) return br - ar
    return b.total - a.total
  })
  return out
}
