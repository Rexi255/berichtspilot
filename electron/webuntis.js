// Fetch one timetable week from WebUntis (E-013, step 4.5): the week overview,
// then the "Lehrstoff" (teachingContent) of every lesson block. Returns a
// trimmed shape for the renderer — subjects, times, status and topics only;
// no teacher, class or room names, no notesAll, no ids, never the token.
// Pure CommonJS apart from the injected session, tested in webuntis.test.mjs.
const { request, isWebuntisHost } = require('./net')

// Below the configured server's API base (`https://<host>/WebUntis`, E-019)
const TIMETABLE_PATH = '/api/rest/view/v1/timetable/entries'
const DETAIL_PATH = '/api/rest/view/v2/calendar-entry/detail'
const DETAIL_CONCURRENCY = 3 // be gentle with the school's server
const MAX_TOPIC_LENGTH = 300 // "Lehrstoff" is ~60 chars; anything longer is cut

const INVALID = { ok: false, code: 'invalid', error: 'Ungültige Woche.' }

const pad = (n) => String(n).padStart(2, '0')
const isoOf = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

/** Saturday ISO date for a valid Monday `YYYY-MM-DD` (local dates), else null. */
function saturdayOf(mondayISO) {
  if (typeof mondayISO !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(mondayISO)) return null
  const [y, m, d] = mondayISO.split('-').map(Number)
  const monday = new Date(y, m - 1, d)
  if (isoOf(monday) !== mondayISO || monday.getDay() !== 1) return null
  return isoOf(new Date(y, m - 1, d + 5))
}

const str = (v) => (typeof v === 'string' ? v.trim() : '')
// "2026-09-07T07:45" (any seconds/zone suffix) → "07:45"
const timeOf = (dateTime) => /T(\d{2}:\d{2})/.exec(str(dateTime))?.[1] || ''

/** Subject of a grid entry: `position2[].current` (falls back to `removed` for cancelled lessons). */
function subjectOf(entry) {
  const pos = Array.isArray(entry?.position2) ? entry.position2 : []
  const element = pos.map((p) => p?.current || p?.removed).find(Boolean)
  return { subjectShort: str(element?.shortName), subjectLong: str(element?.longName) }
}

/** Lower-case subject names a calendar entry carries (`subject`, or a `subjects[]` list). */
function entrySubjects(entry) {
  const list = [entry?.subject, ...(Array.isArray(entry?.subjects) ? entry.subjects : [])]
  return list
    .flatMap((s) => [s?.shortName, s?.longName, s?.displayName])
    .map((n) => str(n).toLowerCase())
    .filter(Boolean)
}

/**
 * `teachingContent` of one lesson from a calendar-entry/detail answer (entries
 * and their single periods). The detail call asks for a time range, so it
 * returns *all* parallel lessons in that slot — e.g. a stray second subject in
 * the school's timetable. Only entries of the lesson's own subject count; if
 * the answer names no subjects at all, every entry is used (old behaviour).
 */
function topicsOf(detail, lesson = {}) {
  const topics = []
  const add = (t) => {
    const topic = str(t).slice(0, MAX_TOPIC_LENGTH)
    if (topic && !topics.includes(topic)) topics.push(topic)
  }
  const entries = Array.isArray(detail?.calendarEntries) ? detail.calendarEntries : []
  const own = [lesson.subjectShort, lesson.subjectLong].map((n) => str(n).toLowerCase()).filter(Boolean)
  const named = entries.some((e) => entrySubjects(e).length > 0)
  for (const entry of entries) {
    if (named && !entrySubjects(entry).some((n) => own.includes(n))) continue
    add(entry?.teachingContent)
    for (const single of Array.isArray(entry?.singleEntries) ? entry.singleEntries : []) add(single?.teachingContent)
  }
  return topics
}

// Run `fn` over `items` with at most `limit` calls in flight; keeps the order
async function mapLimited(items, limit, fn) {
  const results = new Array(items.length)
  let next = 0
  const worker = async () => {
    while (next < items.length) {
      const i = next++
      results[i] = await fn(items[i], i)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

/**
 * Fetch the week starting `mondayISO` (Mon–Sat). Never throws; resolves to
 * `{ ok: true, days: [{ date, holiday, lessons: [{ start, end, status,
 * subjectShort, subjectLong, topics }] }] }` or `{ ok: false, code, error }`.
 *
 * `session`: from createWebUntisSession() — supplies the server, the bearer
 * token and enforces the on/off switch (`code: 'disabled'`, `'no-server'`). `ses`/`fetchImpl` go to
 * request() (Electron session / test stub).
 */
async function fetchWeek(session, mondayISO, { ses, fetchImpl } = {}) {
  const saturday = saturdayOf(mondayISO)
  if (!saturday) return INVALID

  // Switch, address and login first; the host is then the only one allowed
  const first = await session.getToken()
  if (!first.ok) return { ok: false, code: first.code, error: first.error }
  const server = session.apiBase()
  // checked again here: only a WebUntis cloud host ever gets the token
  if (!server || !isWebuntisHost(server.host)) return { ok: false, code: 'no-server', error: 'Bitte zuerst die Adresse deiner WebUntis-Seite eintragen.' }
  const TIMETABLE_URL = server.base + TIMETABLE_PATH
  const DETAIL_URL = server.base + DETAIL_PATH

  // Asked before every call: cached, renewed by the session when about to expire
  const authorized = async (url) => {
    const tok = await session.getToken()
    if (!tok.ok) return tok
    const personId = tok.payload?.person_id
    if (!Number.isInteger(personId)) return { ok: false, code: 'auth', error: 'Bitte erneut anmelden.' }
    const headers = { Authorization: `Bearer ${tok.token}`, Accept: 'application/json' }
    if (tok.payload.tenant_id != null) headers['Tenant-Id'] = String(tok.payload.tenant_id)
    return request(url(personId), { ses, fetchImpl, headers, expect: 'json', hosts: [server.host] })
  }

  const week = await authorized(
    (personId) =>
      `${TIMETABLE_URL}?${new URLSearchParams({
        start: mondayISO,
        end: saturday,
        format: '4',
        resourceType: 'STUDENT',
        resources: String(personId),
        periodTypes: '',
        timetableType: 'MY_TIMETABLE',
      })}`
  )
  if (!week.ok) return { ok: false, code: week.code, error: week.error }

  const rawDays = Array.isArray(week.data?.days) ? week.data.days : []
  const days = rawDays
    .map((day) => ({ date: str(day?.date).slice(0, 10), raw: day }))
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d.date) && d.date >= mondayISO && d.date <= saturday)
    .map(({ date, raw }) => ({
      date,
      holiday: (Array.isArray(raw.backEntries) ? raw.backEntries : []).some((b) => b?.type === 'HOLIDAY'),
      lessons: (Array.isArray(raw.gridEntries) ? raw.gridEntries : []).map((entry) => ({
        rawStart: str(entry?.duration?.start),
        rawEnd: str(entry?.duration?.end),
        start: timeOf(entry?.duration?.start),
        end: timeOf(entry?.duration?.end),
        status: str(entry?.status) || 'REGULAR',
        ...subjectOf(entry),
        topics: [],
      })),
    }))

  // Topics per lesson block (the API returns nothing for a whole-week range).
  // A failed call leaves that lesson's topics empty instead of failing the week.
  // Parallel lessons share one time range → one request per range.
  const lessons = days.flatMap((d) => d.lessons).filter((l) => l.status !== 'CANCELLED' && l.rawStart && l.rawEnd)
  const ranges = [...new Set(lessons.map((l) => `${l.rawStart}|${l.rawEnd}`))]
  const details = new Map()
  await mapLimited(ranges, DETAIL_CONCURRENCY, async (range) => {
    const [startDateTime, endDateTime] = range.split('|')
    const detail = await authorized(
      (personId) =>
        `${DETAIL_URL}?${new URLSearchParams({
          elementId: String(personId),
          elementType: '5',
          startDateTime,
          endDateTime,
          homeworkOption: 'DUE',
        })}`
    )
    if (detail.ok) details.set(range, detail.data)
  })
  for (const lesson of lessons) {
    const detail = details.get(`${lesson.rawStart}|${lesson.rawEnd}`)
    if (detail) lesson.topics = topicsOf(detail, lesson)
  }

  return {
    ok: true,
    days: days.map((d) => ({
      date: d.date,
      holiday: d.holiday,
      lessons: d.lessons.map(({ start, end, status, subjectShort, subjectLong, topics }) => ({
        start,
        end,
        status,
        subjectShort,
        subjectLong,
        topics,
      })),
    })),
  }
}

module.exports = { fetchWeek, saturdayOf, TIMETABLE_PATH, DETAIL_PATH, DETAIL_CONCURRENCY }
