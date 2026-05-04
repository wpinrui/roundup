import { describe, it, expect } from 'vitest'
import {
  buildDateBounds,
  formatDateLabel,
  isValidIsoDate,
  neighborDates,
} from '../dateUtils'

describe('isValidIsoDate', () => {
  it('accepts YYYY-MM-DD', () => {
    expect(isValidIsoDate('2026-05-04')).toBe(true)
  })
  it('rejects other formats', () => {
    expect(isValidIsoDate('5/4/2026')).toBe(false)
    expect(isValidIsoDate('2026-5-4')).toBe(false)
    expect(isValidIsoDate('not a date')).toBe(false)
    expect(isValidIsoDate('')).toBe(false)
  })
})

describe('formatDateLabel', () => {
  it('says "Today, …" when date matches today', () => {
    expect(formatDateLabel('2026-05-04', '2026-05-04')).toBe('Today, May 4')
  })
  it('uses weekday + full date for non-today dates', () => {
    // 2026-05-01 was a Friday.
    expect(formatDateLabel('2026-05-01', '2026-05-04')).toBe('Friday, May 1, 2026')
  })
})

describe('buildDateBounds', () => {
  it('always includes today even if no rows exist', () => {
    expect(buildDateBounds([], '2026-05-04')).toEqual(['2026-05-04'])
  })
  it('unions rows with today and dedupes', () => {
    expect(buildDateBounds(['2026-05-02', '2026-05-04', '2026-05-03'], '2026-05-04')).toEqual([
      '2026-05-02',
      '2026-05-03',
      '2026-05-04',
    ])
  })
})

describe('neighborDates', () => {
  const bounds = ['2026-05-01', '2026-05-02', '2026-05-04']
  it('returns null prev at the start, null next at the end', () => {
    expect(neighborDates('2026-05-01', bounds)).toEqual({ prev: null, next: '2026-05-02' })
    expect(neighborDates('2026-05-04', bounds)).toEqual({ prev: '2026-05-02', next: null })
  })
  it('returns both neighbors in the middle', () => {
    expect(neighborDates('2026-05-02', bounds)).toEqual({
      prev: '2026-05-01',
      next: '2026-05-04',
    })
  })
})
