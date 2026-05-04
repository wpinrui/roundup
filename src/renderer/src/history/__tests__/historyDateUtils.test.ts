import { describe, it, expect } from 'vitest'
import {
  bucketByWeek,
  daysAgo,
  daysBetween,
  formatRangeLabel,
} from '../historyDateUtils'

describe('daysAgo', () => {
  it('returns today when n=0', () => {
    expect(daysAgo(0, '2026-05-04')).toBe('2026-05-04')
  })

  it('returns the previous day for n=1', () => {
    expect(daysAgo(1, '2026-05-04')).toBe('2026-05-03')
  })

  it('crosses month boundaries', () => {
    expect(daysAgo(7, '2026-05-04')).toBe('2026-04-27')
  })

  it('crosses year boundaries', () => {
    expect(daysAgo(31, '2026-01-15')).toBe('2025-12-15')
  })
})

describe('daysBetween', () => {
  it('returns 0 for same day', () => {
    expect(daysBetween('2026-05-04', '2026-05-04')).toBe(0)
  })
  it('returns positive for forward delta', () => {
    expect(daysBetween('2026-05-01', '2026-05-04')).toBe(3)
  })
  it('returns negative for reverse delta', () => {
    expect(daysBetween('2026-05-04', '2026-05-01')).toBe(-3)
  })
})

describe('bucketByWeek', () => {
  it('empty input returns empty', () => {
    expect(bucketByWeek([])).toEqual([])
  })

  it('groups dates that fall in the same ISO week (Mon start)', () => {
    // Mon 2026-05-04 to Sun 2026-05-10
    const out = bucketByWeek(['2026-05-04', '2026-05-05', '2026-05-10'])
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({
      weekStart: '2026-05-04',
      weekEnd: '2026-05-10',
      dates: ['2026-05-04', '2026-05-05', '2026-05-10'],
    })
  })

  it('splits across weeks at Sun → Mon boundary', () => {
    // Sun 2026-05-03 and Mon 2026-05-04 are different ISO weeks.
    const out = bucketByWeek(['2026-05-03', '2026-05-04'])
    expect(out).toHaveLength(2)
    expect(out[0].dates).toEqual(['2026-05-03'])
    expect(out[1].dates).toEqual(['2026-05-04'])
  })
})

describe('formatRangeLabel', () => {
  it('shows a single date when start === end', () => {
    expect(formatRangeLabel('2026-05-04', '2026-05-04')).toBe('May 4')
  })

  it('shows a span when start ≠ end', () => {
    expect(formatRangeLabel('2026-04-28', '2026-05-04')).toBe('Apr 28 – May 4')
  })
})
