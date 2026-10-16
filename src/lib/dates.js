// Date helpers. All dates travel through the app as ISO strings ("YYYY-MM-DD")
// and are deliberately parsed as LOCAL dates (no UTC offset at time-zone borders).

// German weekday names for the IHK output (index = Date#getDay(), 0 = Sunday)
export const WEEKDAY_NAMES_DE = [
  'Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag',
]

// Order of the configurable weekdays (Mon–Sat)
export const WEEKDAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat']
// German UI labels per weekday key
export const WEEKDAY_LABELS = {
  mon: 'Montag', tue: 'Dienstag', wed: 'Mittwoch', thu: 'Donnerstag', fri: 'Freitag', sat: 'Samstag',
}

const pad2 = (n) => String(n).padStart(2, '0')

/** Date -> "YYYY-MM-DD" (local) */
export function toISO(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

/** "YYYY-MM-DD" -> Date (local, 00:00) */
export function parseISO(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** "YYYY-MM-DD" -> "DD.MM.YYYY" (German notation) */
export function formatDE(iso) {
  const [y, m, d] = iso.split('-')
  return `${d}.${m}.${y}`
}

/** ISO date + n days */
export function addDays(iso, n) {
  const d = parseISO(iso)
  d.setDate(d.getDate() + n)
  return toISO(d)
}

/**
 * Calendar days from `fromISO` to `toISO` (negative if earlier). Counted via
 * UTC midnights — local midnights are 23 or 25 hours apart across the DST
 * switch, which made plain millisecond math one day (or week) short.
 */
export function daysBetween(fromISO, toISO) {
  const utc = (iso) => {
    const [y, m, d] = iso.split('-').map(Number)
    return Date.UTC(y, m - 1, d)
  }
  return Math.round((utc(toISO) - utc(fromISO)) / 86400000)
}

/** German weekday name for an ISO date */
export function weekdayName(iso) {
  return WEEKDAY_NAMES_DE[parseISO(iso).getDay()]
}

/** Monday of the week containing `date` (as ISO string) */
export function mondayOf(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const day = d.getDay() // 0 = Sunday
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day))
  return toISO(d)
}

/**
 * ISO-8601 week number. The Thursday of the week determines the week-year:
 * week 1 is the week containing the first Thursday of the year.
 */
export function isoWeek(iso) {
  const d = parseISO(iso)
  const thursday = new Date(d)
  thursday.setDate(d.getDate() - ((d.getDay() + 6) % 7) + 3)
  const year = thursday.getFullYear()
  const firstThursday = new Date(year, 0, 4)
  firstThursday.setDate(firstThursday.getDate() - ((firstThursday.getDay() + 6) % 7) + 3)
  const week = 1 + Math.round((thursday - firstThursday) / (7 * 24 * 3600 * 1000))
  return { week, year }
}

/** Monday of ISO week `week` in `year` */
export function mondayOfIsoWeek(year, week) {
  // January 4th is always in week 1
  const jan4 = new Date(year, 0, 4)
  const mondayWeek1 = parseISO(mondayOf(jan4))
  mondayWeek1.setDate(mondayWeek1.getDate() + (week - 1) * 7)
  return toISO(mondayWeek1)
}

/** "20.04. – 26.04.2026" for the week starting Monday `mondayISO` */
export function weekRangeLabel(mondayISO) {
  const sunday = addDays(mondayISO, 6)
  const [, m1, d1] = mondayISO.split('-')
  return `${d1}.${m1}. – ${formatDE(sunday)}`
}

/** Today as ISO string */
export function todayISO() {
  return toISO(new Date())
}

/** Is `iso` within [from, to] (both inclusive, empty bounds = open)? */
export function inRange(iso, from, to) {
  if (from && iso < from) return false
  if (to && iso > to) return false
  return true
}
