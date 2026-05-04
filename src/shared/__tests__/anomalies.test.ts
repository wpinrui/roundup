import { describe, it, expect } from 'vitest'
import { detectAnomalies } from '../anomalies'
import type { DayRow } from '../ipc'

function day(date: string, scores: Array<{ id: number; name: string; score: number }>, graded = true): DayRow {
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

function range(startDay: number, count: number, scoreFn: (i: number) => number, dimId = 1, dimName = 'Work'): DayRow[] {
  const out: DayRow[] = []
  for (let i = 0; i < count; i++) {
    const d = String(startDay + i).padStart(2, '0')
    out.push(day(`2026-04-${d}`, [{ id: dimId, name: dimName, score: scoreFn(i) }]))
  }
  return out
}

describe('detectAnomalies — input handling', () => {
  it('returns empty when no days', () => {
    expect(detectAnomalies([])).toEqual([])
  })

  it('ignores ungraded days', () => {
    const ungraded = [day('2026-04-01', [], false), day('2026-04-02', [], false)]
    expect(detectAnomalies(ungraded)).toEqual([])
  })
})

describe('detectAnomalies — long-gap', () => {
  it('emits a long-gap when 5+ consecutive days score ≤ 2', () => {
    const days = range(1, 5, () => 1)
    const out = detectAnomalies(days).filter((a) => a.type === 'long-gap')
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({
      type: 'long-gap',
      dimId: 1,
      dimName: 'Work',
      startDate: '2026-04-01',
      endDate: '2026-04-05',
      dayCount: 5,
    })
  })

  it('does not emit when only 4 days at ≤ 2', () => {
    const days = range(1, 4, () => 1)
    const out = detectAnomalies(days).filter((a) => a.type === 'long-gap')
    expect(out).toEqual([])
  })

  it('break in the middle resets the run', () => {
    const days = [
      ...range(1, 3, () => 1),
      ...range(4, 1, () => 8),
      ...range(5, 3, () => 1),
    ]
    const out = detectAnomalies(days).filter((a) => a.type === 'long-gap')
    expect(out).toEqual([])
  })

  it('emits two separate long-gaps when broken by a recovery', () => {
    const days = [
      ...range(1, 5, () => 1),
      ...range(6, 1, () => 8),
      ...range(7, 5, () => 1),
    ]
    const out = detectAnomalies(days).filter((a) => a.type === 'long-gap')
    expect(out).toHaveLength(2)
  })
})

describe('detectAnomalies — unusual', () => {
  it('emits an unusual when score deviates from mean by ≥ 2.5', () => {
    // 5 days at ~5, then a sudden 9 (delta 4)
    const days = [
      ...range(1, 5, () => 5),
      ...range(6, 1, () => 9),
    ]
    const out = detectAnomalies(days).filter((a) => a.type === 'unusual')
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({
      type: 'unusual',
      dimId: 1,
      date: '2026-04-06',
      score: 9,
    })
  })

  it('does not emit when deviation is < 2.5', () => {
    const days = [
      ...range(1, 5, () => 5),
      ...range(6, 1, () => 7),
    ]
    const out = detectAnomalies(days).filter((a) => a.type === 'unusual')
    expect(out).toEqual([])
  })

  it('skips days when the historical window is too small (< 3 prior days)', () => {
    const days = [
      ...range(1, 1, () => 5),
      ...range(2, 1, () => 9), // only 1 prior day
    ]
    const out = detectAnomalies(days).filter((a) => a.type === 'unusual')
    expect(out).toEqual([])
  })

  it('emits both positive and negative deviations', () => {
    const days = [
      ...range(1, 5, () => 5),
      ...range(6, 1, () => 9), // +4 above mean
      ...range(7, 1, () => 5), // back to baseline so the next unusual reads correctly
      ...range(8, 1, () => 1), // −4 below mean (mean still ~5 since one 9 isn't enough to swing it)
    ]
    const out = detectAnomalies(days).filter((a) => a.type === 'unusual')
    expect(out.length).toBeGreaterThanOrEqual(2)
  })
})

describe('detectAnomalies — declining', () => {
  it('emits when 7-day series declines by ≥ 0.4 pts/day', () => {
    // 8, 7, 6, 5, 4, 3, 2 → slope -1
    const days = range(1, 7, (i) => 8 - i)
    const out = detectAnomalies(days).filter((a) => a.type === 'declining')
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({
      type: 'declining',
      dimId: 1,
      startDate: '2026-04-01',
      endDate: '2026-04-07',
    })
    if (out[0].type === 'declining') {
      expect(out[0].slopePerDay).toBeLessThan(-0.4)
    }
  })

  it('does not emit when slope is shallower than 0.4', () => {
    // 7, 6.9, 6.8, ... slope -0.1
    const days = range(1, 7, (i) => 7 - i * 0.1)
    const out = detectAnomalies(days).filter((a) => a.type === 'declining')
    expect(out).toEqual([])
  })

  it('does not emit on a flat or rising series', () => {
    const flat = range(1, 7, () => 6)
    expect(detectAnomalies(flat).filter((a) => a.type === 'declining')).toEqual([])
    const rising = range(1, 7, (i) => 3 + i)
    expect(detectAnomalies(rising).filter((a) => a.type === 'declining')).toEqual([])
  })

  it('extends the run beyond 7 days when the decline continues', () => {
    // 9, 8, 7, 6, 5, 4, 3, 2, 1 — 9 declining days
    const days = range(1, 9, (i) => 9 - i)
    const out = detectAnomalies(days).filter((a) => a.type === 'declining')
    expect(out).toHaveLength(1)
    if (out[0].type === 'declining') {
      expect(out[0].startDate).toBe('2026-04-01')
      expect(out[0].endDate).toBe('2026-04-09')
    }
  })
})

describe('detectAnomalies — multi-dim', () => {
  it('emits anomalies for each dimension independently', () => {
    const days: DayRow[] = []
    for (let i = 0; i < 5; i++) {
      const d = String(1 + i).padStart(2, '0')
      days.push(
        day(`2026-04-${d}`, [
          { id: 1, name: 'Work', score: 1 }, // long-gap candidate
          { id: 2, name: 'Health', score: 8 }, // healthy
        ])
      )
    }
    const out = detectAnomalies(days)
    const longGaps = out.filter((a) => a.type === 'long-gap')
    expect(longGaps.map((a) => a.dimId)).toEqual([1])
  })
})
