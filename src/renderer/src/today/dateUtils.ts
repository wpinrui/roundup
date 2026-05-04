/**
 * Date helpers for the day-view. All values are local-time YYYY-MM-DD strings;
 * we never store or pass Date objects between modules.
 */

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const

const WEEKDAYS = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
] as const

export function todayLocalDate(): string {
  const d = new Date()
  return formatLocal(d)
}

function formatLocal(d: Date): string {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

export function isValidIsoDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s)
}

/** "Today, May 4" for today; "Monday, May 4, 2026" for any other date. */
export function formatDateLabel(isoDate: string, today: string): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const monthDay = `${MONTHS[date.getMonth()]} ${date.getDate()}`
  if (isoDate === today) return `Today, ${monthDay}`
  const weekday = WEEKDAYS[date.getDay()]
  return `${weekday}, ${monthDay}, ${date.getFullYear()}`
}

/**
 * Build the navigable date set: union of (days with a row) ∪ today's date.
 * Returns a sorted ascending list of unique YYYY-MM-DD strings.
 */
export function buildDateBounds(daysWithRows: string[], today: string): string[] {
  const set = new Set(daysWithRows)
  set.add(today)
  return [...set].sort()
}

export function neighborDates(
  current: string,
  bounds: string[]
): { prev: string | null; next: string | null } {
  const idx = bounds.indexOf(current)
  if (idx < 0) return { prev: bounds[bounds.length - 1] ?? null, next: null }
  return {
    prev: idx > 0 ? bounds[idx - 1] : null,
    next: idx < bounds.length - 1 ? bounds[idx + 1] : null,
  }
}
