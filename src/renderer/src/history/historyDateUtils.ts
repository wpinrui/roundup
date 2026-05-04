/**
 * Date helpers for the History views. Builds on `today/dateUtils.ts` for the
 * primitives (todayLocalDate, isValidIsoDate); History-specific concerns —
 * range bounds, week-bucketing, range labels — live here.
 */

const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const

/** ISO date for `n` whole days before `today`. `daysAgo(0, today)` returns today. */
export function daysAgo(n: number, today: string): string {
  const [y, m, d] = today.split('-').map(Number)
  const ts = Date.UTC(y, m - 1, d) - n * 86_400_000
  const dt = new Date(ts)
  const yyyy = dt.getUTCFullYear()
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(dt.getUTCDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

/** Whole-day distance: positive if `to` is after `from`. */
export function daysBetween(from: string, to: string): number {
  const f = isoToUtc(from)
  const t = isoToUtc(to)
  return Math.round((t - f) / 86_400_000)
}

/**
 * Group an ascending list of ISO dates into ISO week buckets (Monday start).
 * Each bucket has an array of the dates that fall inside it. Empty input
 * returns an empty array.
 */
export interface DateBucket {
  /** ISO date of the Monday that opens the bucket (inclusive). */
  weekStart: string
  /** ISO date of the Sunday that closes the bucket (inclusive). */
  weekEnd: string
  dates: string[]
}

export function bucketByWeek(sortedDates: string[]): DateBucket[] {
  if (sortedDates.length === 0) return []
  const buckets: DateBucket[] = []
  let current: DateBucket | null = null
  for (const date of sortedDates) {
    const ws = isoWeekMonday(date)
    if (!current || current.weekStart !== ws) {
      const we = addDays(ws, 6)
      current = { weekStart: ws, weekEnd: we, dates: [date] }
      buckets.push(current)
    } else {
      current.dates.push(date)
    }
  }
  return buckets
}

/** "Apr 28 – May 4" or "May 4" if start === end. */
export function formatRangeLabel(start: string, end: string): string {
  if (start === end) return formatShort(start)
  return `${formatShort(start)} – ${formatShort(end)}`
}

function formatShort(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  void y
  return `${MONTHS_SHORT[m - 1]} ${d}`
}

function isoToUtc(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

function addDays(iso: string, n: number): string {
  const ts = isoToUtc(iso) + n * 86_400_000
  const dt = new Date(ts)
  const yyyy = dt.getUTCFullYear()
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(dt.getUTCDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

/** ISO date of the Monday opening the week containing `iso`. */
function isoWeekMonday(iso: string): string {
  const ts = isoToUtc(iso)
  const dt = new Date(ts)
  // getUTCDay: 0=Sun..6=Sat; convert to Monday-based offset (0=Mon..6=Sun)
  const dayMon0 = (dt.getUTCDay() + 6) % 7
  return addDays(iso, -dayMon0)
}
