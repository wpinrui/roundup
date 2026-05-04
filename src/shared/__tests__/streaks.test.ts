import { describe, it, expect } from 'vitest'
import { computeStreaks, STREAK_THRESHOLD } from '../streaks'
import type { DayRow } from '../ipc'

function day(
  date: string,
  scores: Array<{ id: number; name: string; score: number }>,
  graded = true
): DayRow {
  return {
    date,
    rawEntry: 'x',
    createdAt: '2026-04-01T00:00:00Z',
    gradedAt: graded ? '2026-04-01T18:00:00Z' : null,
    aiNarrative: graded ? 'n' : null,
    weightedOverallScore: graded ? 5 : null,
    scores: scores.map((s) => ({
      dimensionId: s.id,
      dimensionName: s.name,
      weight: 5,
      score: s.score,
      hoursEstimated: null,
    })),
    suggestions: [],
  }
}

describe('computeStreaks', () => {
  it('returns empty when no days', () => {
    expect(computeStreaks([])).toEqual([])
  })

  it('threshold is 5', () => {
    expect(STREAK_THRESHOLD).toBe(5)
  })

  it('counts hits at-or-above 5', () => {
    const days = [
      day('2026-05-01', [{ id: 1, name: 'Work', score: 4 }]),
      day('2026-05-02', [{ id: 1, name: 'Work', score: 5 }]), // hit
      day('2026-05-03', [{ id: 1, name: 'Work', score: 6 }]), // hit
      day('2026-05-04', [{ id: 1, name: 'Work', score: 7 }]), // hit
    ]
    const out = computeStreaks(days)
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ dimId: 1, dimName: 'Work', hits: 3, total: 4 })
  })

  it('excludes ungraded days entirely', () => {
    const days = [
      day('2026-05-01', [], false),
      day('2026-05-02', [{ id: 1, name: 'Work', score: 9 }]),
    ]
    const out = computeStreaks(days)
    expect(out[0].total).toBe(1)
  })

  it('aggregates per dim across days', () => {
    const days = [
      day('2026-05-01', [
        { id: 1, name: 'Work', score: 7 },
        { id: 2, name: 'Health', score: 4 },
      ]),
      day('2026-05-02', [
        { id: 1, name: 'Work', score: 8 },
        { id: 2, name: 'Health', score: 6 },
      ]),
    ]
    const out = computeStreaks(days)
    const work = out.find((s) => s.dimId === 1)!
    const health = out.find((s) => s.dimId === 2)!
    expect(work).toMatchObject({ hits: 2, total: 2 })
    expect(health).toMatchObject({ hits: 1, total: 2 })
  })

  it('sorts by descending hit ratio, then by total descending', () => {
    const days = [
      day('2026-05-01', [
        { id: 1, name: 'A', score: 9 }, // 1/1 → 1.0
        { id: 2, name: 'B', score: 9 }, // building up to 5/5
        { id: 3, name: 'C', score: 4 }, // 0/1 → 0
      ]),
      day('2026-05-02', [{ id: 2, name: 'B', score: 9 }]),
      day('2026-05-03', [{ id: 2, name: 'B', score: 9 }]),
      day('2026-05-04', [{ id: 2, name: 'B', score: 9 }]),
      day('2026-05-05', [{ id: 2, name: 'B', score: 9 }]),
    ]
    const out = computeStreaks(days)
    // A and B both 100%; B has more total → first.
    expect(out[0].dimId).toBe(2)
    expect(out[1].dimId).toBe(1)
    expect(out[out.length - 1].dimId).toBe(3) // 0% last
  })
})
