// Overview logic (E-032): which weeks are due and missing, the state of every
// day (the "Tagesfeld"), the year band, the week list and the search.
// Pure — the views only render what these functions return.
import { addDays, mondayOf, parseISO, isoWeek } from './dates.js'

/** Weekday abbreviations by offset from Monday */
export const WEEKDAY_SHORT = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']

export const MONTH_NAMES_DE = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
]
const MONTHS_SHORT = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']

const STATUS_DAYS = new Set(['holiday', 'sick', 'vacation'])

/* --------------------------------- Days --------------------------------- */

/**
 * Does the day have content that reaches the output? Work days: a bullet;
 * school days: a subject with a label and a bullet (format.js drops the rest).
 */
export function dayHasContent(day) {
  if (day.type === 'school') {
    return (day.subjects ?? []).some((s) => (s.label ?? '').trim() && (s.bullets ?? []).some((b) => b.trim()))
  }
  return (day.bullets ?? []).some((b) => b.trim())
}

/**
 * State of a day cell: 'holiday' | 'sick' | 'vacation' (status first, also
 * ahead of time), 'written', 'future' (after `todayISO`, still empty) or
 * 'open'.
 */
export function dayState(day, todayISO) {
  if (STATUS_DAYS.has(day.status)) return day.status
  if (dayHasContent(day)) return 'written'
  if (todayISO && day.date > todayISO) return 'future'
  return 'open'
}

/** Type letter of a day: F · K · U for the statuses, else S (school) or B (work) */
export function dayLetter(day) {
  if (day.status === 'holiday') return 'F'
  if (day.status === 'sick') return 'K'
  if (day.status === 'vacation') return 'U'
  return day.type === 'school' ? 'S' : 'B'
}

/** "x von y Tagen geschrieben": normal days with content of all normal days */
export function weekProgress(week) {
  const normal = (week?.days ?? []).filter((d) => d.status === 'normal')
  return { written: normal.filter(dayHasContent).length, needed: normal.length }
}

/* -------------------------------- Weeks --------------------------------- */

/** Monday the record starts: the training start, otherwise the first report */
export function firstMonday(data) {
  if (data.settings?.trainingStart) return mondayOf(parseISO(data.settings.trainingStart))
  return data.weeks.map((w) => w.id).sort()[0] ?? null
}

// Monday of the training's last week, or null without an end date
function lastTrainingMonday(data) {
  return data.settings?.trainingEnd ? mondayOf(parseISO(data.settings.trainingEnd)) : null
}

/**
 * Is the week starting `monday` inside the ignored stretch — the weeks before
 * the user started with Berichtspilot (settings.ignoredUntil, inclusive; the
 * week that contains the date counts as ignored)? Only weeks WITHOUT a report
 * are left out: a report written there anyway counts as usual.
 */
export function isIgnoredWeek(data, monday) {
  const until = data.settings?.ignoredUntil
  return Boolean(until) && monday <= until
}

/**
 * The ignored stretch for the settings and the wizard: { from, to, count }
 * (Mondays, from = the record's first Monday) or null when nothing is ignored.
 */
export function ignoredRange(data) {
  const until = data.settings?.ignoredUntil
  const start = firstMonday(data)
  if (!until || !start) return null
  const to = mondayOf(parseISO(until))
  if (to < start) return null
  return { from: start, to, count: mondaysBetween(start, to).length }
}

/** "KW 36/2025 bis KW 44/2026, 61 Wochen" — the stretch in words (settings, wizard) */
export function ignoredRangeLabel(range) {
  if (!range) return ''
  const kw = (monday) => {
    const { week, year } = isoWeek(monday)
    return `KW ${week}/${year}`
  }
  const span = range.count === 1 ? kw(range.from) : `${kw(range.from)} bis ${kw(range.to)}`
  return `${span}, ${range.count === 1 ? '1 Woche' : `${range.count} Wochen`}`
}

function mondaysBetween(from, to) {
  const list = []
  for (let m = from; m <= to; m = addDays(m, 7)) list.push(m)
  return list
}

/**
 * Mondays without a report between the start and the week BEFORE the current
 * one (the running week and later ones never count as missing), capped at
 * the training end, without the ignored weeks. Ascending.
 */
export function missingWeeks(data, currentMonday) {
  const start = firstMonday(data)
  if (!start) return []
  let end = addDays(currentMonday, -7)
  const last = lastTrainingMonday(data)
  if (last && last < end) end = last
  const ids = new Set(data.weeks.map((w) => w.id))
  return mondaysBetween(start, end).filter((m) => !ids.has(m) && !isIgnoredWeek(data, m))
}

/**
 * Weeks due so far: start → the week before the current one, plus the
 * current week once it exists; capped at the training end; ignored weeks only
 * when they have a report. Every due week is done, a draft or missing — so
 * the three numbers add up (user, 2026-11-07).
 */
export function dueWeeks(data, currentMonday) {
  const start = firstMonday(data)
  if (!start) return []
  const ids = new Set(data.weeks.map((w) => w.id))
  let end = ids.has(currentMonday) ? currentMonday : addDays(currentMonday, -7)
  const last = lastTrainingMonday(data)
  if (last && last < end) end = last
  return mondaysBetween(start, end).filter((m) => ids.has(m) || !isIgnoredWeek(data, m))
}

/** Figures of the overview: { due, done, drafts, missing: [mondays] } */
export function overviewStats(data, currentMonday) {
  const due = dueWeeks(data, currentMonday)
  const byId = new Map(data.weeks.map((w) => [w.id, w]))
  let done = 0
  let drafts = 0
  for (const m of due) {
    const week = byId.get(m)
    if (!week) continue
    if (week.status === 'done') done++
    else drafts++
  }
  return { due: due.length, done, drafts, missing: missingWeeks(data, currentMonday) }
}

// Month (0–11) and year a week belongs to: its Thursday, as for ISO weeks
function weekMonth(monday) {
  const [y, m] = addDays(monday, 3).split('-').map(Number)
  return { year: y, month: m - 1 }
}

/* ------------------------------- Year band ------------------------------- */

/**
 * The year band: one column per week from the start to the training end
 * (without an end: `futureWeeks` after today), five day cells each (Mon–Fri).
 * Cells: dayState() of the day, 'open' for missing weeks and the empty days
 * up to today of a not yet created current week, 'future' after that,
 * 'ignored' for the days of an ignored week without a report, 'none'
 * outside the training period or for days the week doesn't have.
 * Returns { columns: [{ monday, week, year, current, status, cells }],
 * months: [{ column, label }] }.
 */
export function yearBand(data, todayISO, { futureWeeks = 12 } = {}) {
  const currentMonday = mondayOf(parseISO(todayISO))
  const start = firstMonday(data) ?? currentMonday
  let end = lastTrainingMonday(data) ?? addDays(currentMonday, futureWeeks * 7)
  const lastReport = data.weeks.map((w) => w.id).sort().at(-1)
  if (lastReport && lastReport > end) end = lastReport
  if (currentMonday > end) end = currentMonday

  const byId = new Map(data.weeks.map((w) => [w.id, w]))
  const missing = new Set(missingWeeks(data, currentMonday))
  const { trainingStart, trainingEnd } = data.settings ?? {}

  const columns = mondaysBetween(start, end).map((monday) => {
    const week = byId.get(monday)
    const cells = [0, 1, 2, 3, 4].map((offset) => {
      const date = addDays(monday, offset)
      if ((trainingStart && date < trainingStart) || (trainingEnd && date > trainingEnd)) return 'none'
      if (week) {
        const day = week.days.find((d) => d.date === date)
        return day ? dayState(day, todayISO) : 'none'
      }
      if (missing.has(monday)) return 'open'
      if (isIgnoredWeek(data, monday)) return 'ignored'
      return monday === currentMonday && date <= todayISO ? 'open' : 'future'
    })
    const { week: number, year } = isoWeek(monday)
    let status = 'future'
    if (week) status = week.status === 'done' ? 'done' : 'draft'
    else if (missing.has(monday)) status = 'missing'
    else if (isIgnoredWeek(data, monday)) status = 'ignored'
    return { monday, week: number, year, current: monday === currentMonday, status, cells }
  })

  // A label where the month changes; January and the first label carry the year
  const months = []
  let previous = null
  columns.forEach((c, i) => {
    const { year, month } = weekMonth(c.monday)
    const key = `${year}-${month}`
    if (key === previous) return
    previous = key
    const label = month === 0 || months.length === 0 ? `${MONTHS_SHORT[month]} ${year}` : MONTHS_SHORT[month]
    months.push({ column: i, label })
  })
  return { columns, months }
}

/* -------------------------------- Search -------------------------------- */

/**
 * Read the search field: a week number ("42", "KW 42", "KW 42/2026"), a date
 * ("15.10.", "15.10.2026", "2026-10-15") or free text. Null when empty.
 */
export function parseQuery(text) {
  const q = (text ?? '').trim().toLowerCase()
  if (!q) return null
  let m = /^(?:kw\s*)?(\d{1,2})(?:\s*\/\s*(\d{4}))?$/.exec(q)
  if (m && Number(m[1]) >= 1 && Number(m[1]) <= 53) {
    return { kind: 'week', week: Number(m[1]), year: m[2] ? Number(m[2]) : null }
  }
  m = /^(\d{1,2})\.(\d{1,2})\.?(\d{4})?$/.exec(q)
  if (m && validDate(m[1], m[2])) return { kind: 'date', day: Number(m[1]), month: Number(m[2]), year: m[3] ? Number(m[3]) : null }
  m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(q)
  if (m && validDate(m[3], m[2])) return { kind: 'date', day: Number(m[3]), month: Number(m[2]), year: Number(m[1]) }
  return { kind: 'text', text: q }
}

const validDate = (day, month) => Number(day) >= 1 && Number(day) <= 31 && Number(month) >= 1 && Number(month) <= 12

// First text of the week that contains `q`, as a snippet for the list
function textSnippet(week, q) {
  if ((week.instructions ?? '').toLowerCase().includes(q)) return week.instructions
  for (const day of week.days) {
    if ((day.holidayName ?? '').toLowerCase().includes(q)) return `Feiertag: ${day.holidayName}`
    if ((day.notes ?? '').toLowerCase().includes(q)) return `Notiz: ${day.notes}`
    for (const b of day.bullets ?? []) if (b.toLowerCase().includes(q)) return b
    for (const s of day.subjects ?? []) {
      if ((s.label ?? '').toLowerCase().includes(q)) return s.label
      for (const b of s.bullets ?? []) if (b.toLowerCase().includes(q)) return `${s.label}: ${b}`
    }
  }
  return null
}

/**
 * Does the week starting `monday` match the parsed query? Returns null (no),
 * '' (matched by week number or date) or the text snippet that matched.
 * `week` is null for a missing week (only number and date can match).
 */
export function matchWeek(parsed, monday, week) {
  if (!parsed) return ''
  if (parsed.kind === 'week') {
    const { week: number, year } = isoWeek(monday)
    return number === parsed.week && (!parsed.year || year === parsed.year) ? '' : null
  }
  if (parsed.kind === 'date') {
    for (let i = 0; i < 7; i++) {
      const [y, m, d] = addDays(monday, i).split('-').map(Number)
      if (d === parsed.day && m === parsed.month && (!parsed.year || y === parsed.year)) return ''
    }
    return null
  }
  if (monday.includes(parsed.text)) return ''
  return week ? textSnippet(week, parsed.text) : null
}

/* ------------------------------- Week list ------------------------------- */

function rowFor(monday, week, currentMonday, todayISO, snippet = null) {
  const { week: number, year } = isoWeek(monday)
  const days = week
    ? week.days.map((d) => ({
        date: d.date,
        short: WEEKDAY_SHORT[(parseISO(d.date).getDay() + 6) % 7],
        letter: dayLetter(d),
        state: dayState(d, todayISO),
      }))
    : [0, 1, 2, 3, 4].map((i) => ({ date: addDays(monday, i), short: WEEKDAY_SHORT[i], letter: '', state: 'open' }))
  let status = 'missing'
  if (week) status = week.status === 'done' ? 'done' : 'draft'
  return { monday, week: number, year, status, current: monday === currentMonday, days, snippet }
}

/**
 * The week list: reports and missing weeks, newest first, grouped by month
 * ("November 2026"). Without a query only the first `limit` rows (0 = all);
 * with a query every match, with its snippet.
 * Returns { groups: [{ key, label, rows }], total, shown }.
 */
export function weekRows(data, todayISO, { limit = 8, query = '' } = {}) {
  const currentMonday = mondayOf(parseISO(todayISO))
  const parsed = parseQuery(query)
  let rows = [
    ...data.weeks.map((w) => ({ monday: w.id, week: w })),
    ...missingWeeks(data, currentMonday).map((m) => ({ monday: m, week: null })),
  ]
    .sort((a, b) => (a.monday < b.monday ? 1 : -1))
    .map(({ monday, week }) => ({ monday, week, snippet: parsed ? matchWeek(parsed, monday, week) : null }))
    .filter((r) => !parsed || r.snippet !== null)
    .map((r) => rowFor(r.monday, r.week, currentMonday, todayISO, r.snippet || null))

  const total = rows.length
  if (!parsed && limit > 0) rows = rows.slice(0, limit)

  const groups = []
  for (const row of rows) {
    const { year, month } = weekMonth(row.monday)
    const key = `${year}-${String(month + 1).padStart(2, '0')}`
    if (groups.at(-1)?.key !== key) groups.push({ key, label: `${MONTH_NAMES_DE[month]} ${year}`, rows: [] })
    groups.at(-1).rows.push(row)
  }
  return { groups, total, shown: rows.length }
}
