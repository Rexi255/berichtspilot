// Fetch one timetable week from WebUntis (E-013, step 4.5): the week overview,
// then the "Lehrstoff" (teachingContent) of every lesson block. Returns a
// trimmed shape for the renderer — subjects, times, status and topics only;
// no teacher, class or room names, no notesAll, no ids, never the token.
// Pure CommonJS apart from the injected session, tested in webuntis.test.mjs.
const { request } = require('./net')
const { BASE } = require('./webuntis-session')

const TIMETABLE_URL = `${BASE}/api/rest/view/v1/timetable/entries`
const DETAIL_URL = `${BASE}/api/rest/view/v2/calendar-entry/detail`
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

/** `teachingContent` from a calendar-entry/detail answer (entries and their single periods). */
function topicsOf(detail) {
  const topics = []
  const add = (t) => {
    const topic = str(t).slice(0, MAX_TOPIC_LENGTH)
    if (topic && !topics.includes(topic)) topics.push(topic)
  }
  for (const entry of Array.isArray(detail?.calendarEntries) ? detail.calendarEntries : []) {
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
 * `session`: from createWebUntisSession() — supplies the bearer token and
 * enforces the on/off switch (`code: 'disabled'`). `ses`/`fetchImpl` go to
 * request() (Electron session / test stub).
 */
async function fetchWeek(session, mondayISO, { ses, fetchImpl } = {}) {
  const saturday = saturdayOf(mondayISO)
  if (!saturday) return INVALID

  // Asked before every call: cached, renewed by the session when about to expire
  const authorized = async (url) => {
    const tok = await session.getToken()
    if (!tok.ok) return tok
    const personId = tok.payload?.person_id
    if (!Number.isInteger(personId)) return { ok: false, code: 'auth', error: 'Bitte erneut anmelden.' }
    const headers = { Authorization: `Bearer ${tok.token}`, Accept: 'application/json' }
    if (tok.payload.tenant_id != null) headers['Tenant-Id'] = String(tok.payload.tenant_id)
    return request(url(personId), { ses, fetchImpl, headers, expect: 'json' })
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
  const blocks = days.flatMap((d) => d.lessons).filter((l) => l.status !== 'CANCELLED' && l.rawStart && l.rawEnd)
  await mapLimited(blocks, DETAIL_CONCURRENCY, async (lesson) => {
    const detail = await authorized(
      (personId) =>
        `${DETAIL_URL}?${new URLSearchParams({
          elementId: String(personId),
          elementType: '5',
          startDateTime: lesson.rawStart,
          endDateTime: lesson.rawEnd,
          homeworkOption: 'DUE',
        })}`
    )
    if (detail.ok) lesson.topics = topicsOf(detail.data)
  })

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

module.exports = { fetchWeek, saturdayOf, TIMETABLE_URL, DETAIL_URL, DETAIL_CONCURRENCY }
