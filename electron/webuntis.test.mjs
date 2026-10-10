// WebUntis week fetch against a local stub: request URLs/headers, trimming,
// partial failures, concurrency — without Electron or a real server. Response
// bodies are hand-written from the shape in docs/DECISIONS.md E-013.
import { URL } from 'node:url'
import { setTimeout as sleep } from 'node:timers/promises'
import { describe, it, expect, vi } from 'vitest'
import { fetchWeek, saturdayOf, TIMETABLE_URL, DETAIL_URL, DETAIL_CONCURRENCY } from './webuntis.js'

function json(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name) => (name.toLowerCase() === 'content-type' ? 'application/json;charset=UTF-8' : null) },
    text: async () => JSON.stringify(body),
  }
}

const session = (tok = { ok: true, token: 'tok-123', payload: { person_id: 4711, tenant_id: 99 } }) => ({
  getToken: vi.fn(async () => tok),
})

const subject = (shortName, longName = `${shortName} lang`) => [
  { current: { type: 'SUBJECT', shortName, longName } },
]
const entry = (date, from, to, shortName, extra = {}) => ({
  duration: { start: `${date}T${from}`, end: `${date}T${to}` },
  type: 'NORMAL_TEACHING_PERIOD',
  status: 'REGULAR',
  position1: [{ current: { type: 'TEACHER', shortName: 'Mü', longName: 'Herr Müller' } }],
  position2: subject(shortName),
  position3: [{ current: { type: 'ROOM', shortName: 'A101' } }],
  notesAll: 'Bitte Laptop mitbringen',
  lessonInfo: 'FI25a',
  ...extra,
})

const WEEK = {
  days: [
    {
      date: '2026-09-07',
      status: 'REGULAR',
      gridEntries: [
        entry('2026-09-07', '07:45', '09:15', 'LF03'),
        entry('2026-09-07', '09:30', '11:00', 'WiPo', { status: 'CANCELLED' }),
      ],
      backEntries: [],
    },
    { date: '2026-09-08', status: 'NO_DATA', gridEntries: [], backEntries: [] },
    { date: '2026-09-09', status: 'REGULAR', gridEntries: [], backEntries: [{ type: 'HOLIDAY', name: 'Ferien' }] },
  ],
}

const detailFor = (topics) => ({
  calendarEntries: [
    {
      teachingContent: topics[0],
      notesAll: 'nicht verwenden',
      singleEntries: topics.slice(1).map((t) => ({ teachingContent: t })),
    },
  ],
})

// Routes the stub by path; `details` maps "<start>" → detail body (or a status number)
function server({ week = WEEK, details = {} } = {}) {
  return vi.fn(async (url) => {
    const u = new URL(url)
    if (url.startsWith(TIMETABLE_URL)) return typeof week === 'number' ? json(week, {}) : json(200, week)
    if (url.startsWith(DETAIL_URL)) {
      const d = details[u.searchParams.get('startDateTime')]
      if (typeof d === 'number') return json(d, {})
      return json(200, d ?? { calendarEntries: [] })
    }
    return json(404, {})
  })
}

describe('saturdayOf', () => {
  it('accepts only a real Monday', () => {
    expect(saturdayOf('2026-09-07')).toBe('2026-09-12')
    expect(saturdayOf('2026-12-28')).toBe('2027-01-02')
    expect(saturdayOf('2026-09-08')).toBeNull() // Tuesday
    expect(saturdayOf('2026-02-30')).toBeNull()
    expect(saturdayOf('2026-9-7')).toBeNull()
    expect(saturdayOf(20260907)).toBeNull()
  })
})

describe('fetchWeek', () => {
  it('asks for the week with bearer token + tenant and returns the trimmed shape', async () => {
    const fetchImpl = server({ details: { '2026-09-07T07:45': detailFor(['Subnetting', 'VLANs', 'Subnetting']) } })
    const res = await fetchWeek(session(), '2026-09-07', { fetchImpl })

    const [weekUrl, weekInit] = fetchImpl.mock.calls[0]
    const q = new URL(weekUrl).searchParams
    expect(Object.fromEntries(q)).toEqual({
      start: '2026-09-07',
      end: '2026-09-12',
      format: '4',
      resourceType: 'STUDENT',
      resources: '4711',
      periodTypes: '',
      timetableType: 'MY_TIMETABLE',
    })
    expect(weekInit.headers).toMatchObject({ Authorization: 'Bearer tok-123', 'Tenant-Id': '99' })

    expect(res).toEqual({
      ok: true,
      days: [
        {
          date: '2026-09-07',
          holiday: false,
          lessons: [
            { start: '07:45', end: '09:15', status: 'REGULAR', subjectShort: 'LF03', subjectLong: 'LF03 lang', topics: ['Subnetting', 'VLANs'] },
            { start: '09:30', end: '11:00', status: 'CANCELLED', subjectShort: 'WiPo', subjectLong: 'WiPo lang', topics: [] },
          ],
        },
        { date: '2026-09-08', holiday: false, lessons: [] },
        { date: '2026-09-09', holiday: true, lessons: [] },
      ],
    })
    // No teacher/room/class names or notes in what the renderer gets
    expect(JSON.stringify(res)).not.toMatch(/Müller|A101|FI25a|Laptop|nicht verwenden|tok-123|4711/)
  })

  it('asks for topics per non-cancelled block with its exact times', async () => {
    const fetchImpl = server()
    await fetchWeek(session(), '2026-09-07', { fetchImpl })
    const detailCalls = fetchImpl.mock.calls.filter(([url]) => url.startsWith(DETAIL_URL))
    expect(detailCalls).toHaveLength(1)
    expect(Object.fromEntries(new URL(detailCalls[0][0]).searchParams)).toEqual({
      elementId: '4711',
      elementType: '5',
      startDateTime: '2026-09-07T07:45',
      endDateTime: '2026-09-07T09:15',
      homeworkOption: 'DUE',
    })
  })

  it('keeps the week when a single topic call fails', async () => {
    const week = {
      days: [
        {
          date: '2026-09-07',
          gridEntries: [entry('2026-09-07', '07:45', '09:15', 'LF03'), entry('2026-09-07', '09:30', '11:00', 'LF02')],
        },
      ],
    }
    const fetchImpl = server({ week, details: { '2026-09-07T07:45': 500, '2026-09-07T09:30': detailFor(['Netzplan']) } })
    const res = await fetchWeek(session(), '2026-09-07', { fetchImpl })
    expect(res.ok).toBe(true)
    expect(res.days[0].lessons.map((l) => l.topics)).toEqual([[], ['Netzplan']])
  })

  // Real case (2026-10-10): a stray LF08 entry parallel to LF10 got LF10's topic
  it('gives parallel lessons only the topics of their own subject, one call per time range', async () => {
    const week = {
      days: [
        {
          date: '2026-09-23',
          gridEntries: [
            entry('2026-09-23', '07:45', '09:15', 'LF08'),
            entry('2026-09-23', '11:30', '13:00', 'LF08'),
            entry('2026-09-23', '11:30', '13:00', 'LF10'),
          ],
        },
      ],
    }
    const withSubject = (shortName, teachingContent) => ({
      subject: { id: 1, shortName, longName: `${shortName} lang`, displayName: `${shortName} lang` },
      teachingContent,
    })
    const fetchImpl = server({
      week,
      details: {
        '2026-09-23T07:45': { calendarEntries: [withSubject('LF08', 'PacketTracer Szenario')] },
        '2026-09-23T11:30': {
          calendarEntries: [withSubject('LF08', ''), withSubject('LF10', 'Aktuelles zur Politik')],
        },
      },
    })
    const res = await fetchWeek(session(), '2026-09-21', { fetchImpl })
    expect(res.days[0].lessons.map((l) => [l.subjectShort, l.topics])).toEqual([
      ['LF08', ['PacketTracer Szenario']],
      ['LF08', []],
      ['LF10', ['Aktuelles zur Politik']],
    ])
    expect(fetchImpl.mock.calls.filter(([url]) => url.startsWith(DETAIL_URL))).toHaveLength(2)
  })

  it('uses every entry when the detail answer names no subjects', async () => {
    const week = { days: [{ date: '2026-09-07', gridEntries: [entry('2026-09-07', '07:45', '09:15', 'LF03')] }] }
    const fetchImpl = server({
      week,
      details: { '2026-09-07T07:45': { calendarEntries: [{ teachingContent: 'A' }, { teachingContent: 'B' }] } },
    })
    const res = await fetchWeek(session(), '2026-09-07', { fetchImpl })
    expect(res.days[0].lessons[0].topics).toEqual(['A', 'B'])
  })

  it('runs at most a few topic calls at once', async () => {
    const gridEntries = Array.from({ length: 8 }, (_, i) =>
      entry('2026-09-07', `${String(8 + i).padStart(2, '0')}:00`, `${String(8 + i).padStart(2, '0')}:45`, `F${i}`)
    )
    let inFlight = 0
    let peak = 0
    const base = server({ week: { days: [{ date: '2026-09-07', gridEntries }] } })
    const fetchImpl = vi.fn(async (url, init) => {
      inFlight++
      peak = Math.max(peak, inFlight)
      await sleep(5)
      inFlight--
      return base(url, init)
    })
    const res = await fetchWeek(session(), '2026-09-07', { fetchImpl })
    expect(res.days[0].lessons).toHaveLength(8)
    expect(peak).toBeLessThanOrEqual(DETAIL_CONCURRENCY)
  })

  it('passes a failed week call on with its German text', async () => {
    const res = await fetchWeek(session(), '2026-09-07', { fetchImpl: server({ week: 401 }) })
    expect(res).toEqual({ ok: false, code: 'auth', error: 'Bitte erneut anmelden.' })
  })

  it('sends no request when the session refuses (switched off / logged out)', async () => {
    const fetchImpl = server()
    const off = session({ ok: false, code: 'disabled', error: 'WebUntis ist ausgeschaltet.' })
    expect(await fetchWeek(off, '2026-09-07', { fetchImpl })).toEqual({
      ok: false,
      code: 'disabled',
      error: 'WebUntis ist ausgeschaltet.',
    })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('rejects an invalid week or a token without person id before any request', async () => {
    const fetchImpl = server()
    expect((await fetchWeek(session(), '../../etc', { fetchImpl })).code).toBe('invalid')
    expect((await fetchWeek(session(), '2026-09-08', { fetchImpl })).code).toBe('invalid')
    const noPerson = session({ ok: true, token: 't', payload: {} })
    expect((await fetchWeek(noPerson, '2026-09-07', { fetchImpl })).code).toBe('auth')
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('tolerates odd answers: missing fields, days outside the week, long topics', async () => {
    const week = {
      days: [
        { date: '2026-09-05', gridEntries: [entry('2026-09-05', '07:45', '09:15', 'LF01')] },
        { date: '2026-09-10T00:00', gridEntries: [{ status: 'REGULAR' }, null] },
        null,
      ],
    }
    const res = await fetchWeek(session(), '2026-09-07', { fetchImpl: server({ week }) })
    expect(res.days).toEqual([
      {
        date: '2026-09-10',
        holiday: false,
        lessons: [
          { start: '', end: '', status: 'REGULAR', subjectShort: '', subjectLong: '', topics: [] },
          { start: '', end: '', status: 'REGULAR', subjectShort: '', subjectLong: '', topics: [] },
        ],
      },
    ])

    const long = 'x'.repeat(500)
    const one = { days: [{ date: '2026-09-07', gridEntries: [entry('2026-09-07', '07:45', '09:15', 'LF03')] }] }
    const res2 = await fetchWeek(session(), '2026-09-07', {
      fetchImpl: server({ week: one, details: { '2026-09-07T07:45': detailFor([long]) } }),
    })
    expect(res2.days[0].lessons[0].topics[0]).toHaveLength(300)
  })
})
