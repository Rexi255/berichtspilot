// WebUntis week → school days. Fixtures are hand-written from the shape in
// docs/DECISIONS.md E-013 (no real timetable data in the repo).
import { describe, it, expect } from 'vitest'
import {
  schoolDaysFromWebuntis,
  subjectKey,
  profileSubjectLabels,
  lookupMapping,
  setMapping,
  mapSubjects,
  unmappedSubjects,
  fillWeekFromWebuntis,
} from './webuntis.js'

const lesson = (start, subjectShort, topics = [], extra = {}) => ({
  start,
  end: start.replace(/:\d\d$/, ':45'),
  status: 'REGULAR',
  subjectShort,
  subjectLong: `${subjectShort} lang`,
  topics,
  ...extra,
})

describe('schoolDaysFromWebuntis', () => {
  it('lists subjects in timetable order with their topics', () => {
    const days = [
      {
        date: '2026-09-07',
        holiday: false,
        lessons: [lesson('09:30', 'LF03', ['Subnetting']), lesson('07:45', 'LF02', ['Netzwerkplan'])],
      },
    ]
    expect(schoolDaysFromWebuntis(days)).toEqual([
      {
        date: '2026-09-07',
        schoolBreak: false,
        subjects: [
          { short: 'LF02', long: 'LF02 lang', topics: ['Netzwerkplan'] },
          { short: 'LF03', long: 'LF03 lang', topics: ['Subnetting'] },
        ],
        cancelledSubjects: [],
      },
    ])
  })

  it('merges double periods and repeated subjects, de-duplicating topics', () => {
    const [day] = schoolDaysFromWebuntis([
      {
        date: '2026-09-07',
        lessons: [
          lesson('07:45', 'LF03', ['IPv4-Subnetting']),
          lesson('08:30', 'LF03', ['IPv4-Subnetting', ' ipv4-subnetting ']),
          lesson('10:00', 'WiPo', ['Tarifvertrag']),
          lesson('11:30', 'lf03', ['VLANs  einrichten']),
        ],
      },
    ])
    expect(day.subjects).toEqual([
      { short: 'LF03', long: 'LF03 lang', topics: ['IPv4-Subnetting', 'VLANs einrichten'] },
      { short: 'WiPo', long: 'WiPo lang', topics: ['Tarifvertrag'] },
    ])
  })

  it('drops cancelled lessons and reports fully cancelled subjects', () => {
    const [day] = schoolDaysFromWebuntis([
      {
        date: '2026-09-08',
        lessons: [
          lesson('07:45', 'Englisch', [], { status: 'CANCELLED' }),
          lesson('09:30', 'LF03', ['Topologien'], { status: 'CANCELLED' }),
          lesson('10:15', 'LF03', ['Routing'], { status: 'CHANGED' }),
        ],
      },
    ])
    expect(day.subjects).toEqual([{ short: 'LF03', long: 'LF03 lang', topics: ['Routing'] }])
    expect(day.cancelledSubjects).toEqual(['Englisch'])
  })

  it('turns a holiday day into a school break without subjects', () => {
    expect(schoolDaysFromWebuntis([{ date: '2026-10-12', holiday: true, lessons: [lesson('07:45', 'LF02')] }])).toEqual([
      { date: '2026-10-12', schoolBreak: true, subjects: [], cancelledSubjects: [] },
    ])
  })

  it('keeps a day without lessons as an empty school day', () => {
    expect(schoolDaysFromWebuntis([{ date: '2026-09-09', holiday: false, lessons: [] }])[0]).toMatchObject({
      schoolBreak: false,
      subjects: [],
    })
  })

  it('falls back to the long name and skips lessons without any subject', () => {
    const [day] = schoolDaysFromWebuntis([
      {
        date: '2026-09-07',
        lessons: [
          { start: '07:45', status: 'REGULAR', subjectShort: '', subjectLong: 'Sport', topics: [] },
          { start: '08:30', status: 'REGULAR', subjectShort: '', subjectLong: '', topics: ['x'] },
        ],
      },
    ])
    expect(day.subjects).toEqual([{ short: 'Sport', long: 'Sport', topics: [] }])
  })

  it('sorts days and ignores malformed input', () => {
    expect(schoolDaysFromWebuntis(null)).toEqual([])
    const days = schoolDaysFromWebuntis([
      { date: '2026-09-08', lessons: 'kaputt' },
      null,
      { date: '8.9.2026', lessons: [] },
      { date: '2026-09-07', lessons: [null, lesson('07:45', 'LF02', ['a', 5, null, ''])] },
    ])
    expect(days.map((d) => d.date)).toEqual(['2026-09-07', '2026-09-08'])
    expect(days[0].subjects[0].topics).toEqual(['a'])
    expect(days[1].subjects).toEqual([])
  })
})

// Real-world spellings from the user's timetable (2026-10): mixed case,
// abbreviations, a support-teacher entry `pfk`
const profile = (webuntisSubjects = {}) => ({
  weekdays: {
    mon: { type: 'work', subjects: [] },
    tue: { type: 'school', subjects: ['LF06', 'LF07', 'Kommunikation'] },
    wed: { type: 'school', subjects: ['LF08', 'LF09', 'LF10', 'WiPo'] },
    thu: { type: 'off', subjects: ['Ignoriert'] },
  },
  webuntisSubjects,
})
const sub = (short, topics = [], long = `${short} lang`) => ({ short, long, topics })
const day = (subjects, extra = {}) => ({ date: '2026-10-06', schoolBreak: false, subjects, cancelledSubjects: [], ...extra })

describe('subjectKey', () => {
  it('ignores case, spaces and leading zeros', () => {
    expect(subjectKey('LF07')).toBe('lf7')
    expect(subjectKey(' lf 7 ')).toBe('lf7')
    expect(subjectKey('LF10')).toBe('lf10')
    expect(subjectKey('wipo')).toBe(subjectKey('WiPo'))
    expect(subjectKey(null)).toBe('')
  })
})

describe('profileSubjectLabels', () => {
  it('collects school-day labels once, in weekday order', () => {
    expect(profileSubjectLabels(profile())).toEqual(['LF06', 'LF07', 'Kommunikation', 'LF08', 'LF09', 'LF10', 'WiPo'])
    expect(profileSubjectLabels(null)).toEqual([])
  })
})

describe('lookupMapping / setMapping', () => {
  it('finds saved entries whatever the spelling', () => {
    const map = { kom: 'Kommunikation', PFK: '' }
    expect(lookupMapping(map, 'KOM')).toBe('Kommunikation')
    expect(lookupMapping(map, 'pfk')).toBe('')
    expect(lookupMapping(map, 'LF07')).toBeUndefined()
    expect(lookupMapping(undefined, 'kom')).toBeUndefined()
  })

  it('replaces spelling variants and removes with null', () => {
    expect(setMapping({ KOM: 'X', pfk: '' }, ' kom ', 'Kommunikation')).toEqual({ pfk: '', kom: 'Kommunikation' })
    expect(setMapping({ pfk: '' }, 'PFK', null)).toEqual({})
    expect(setMapping(undefined, 'pfk', '')).toEqual({ pfk: '' })
    expect(setMapping({ a: 'b' }, '  ', 'x')).toEqual({ a: 'b' })
  })
})

describe('mapSubjects', () => {
  it('maps identical names automatically (case, leading zeros) and via the long name', () => {
    const [d] = mapSubjects(
      [day([sub('lf6', ['Persönlichkeit']), sub('kom', ['Gesprächsführung'], 'Kommunikation'), sub('wipo', [], 'Wirtschaft und Politik')])],
      profile()
    )
    expect(d.subjects).toEqual([
      { label: 'LF06', topics: ['Persönlichkeit'], from: ['lf6'] },
      { label: 'Kommunikation', topics: ['Gesprächsführung'], from: ['kom'] },
      { label: 'WiPo', topics: [], from: ['wipo'] },
    ])
    expect(d.unmapped).toEqual([])
  })

  it('uses saved mappings first, including "ignore"', () => {
    const [d] = mapSubjects(
      [day([sub('pfk', ['Hilfe']), sub('wipo', ['Wahlen'], 'Wirtschaft und Politik'), sub('LF07')])],
      profile({ pfk: '', WIPO: 'WiPo', LF07: 'LF06' })
    )
    expect(d.ignored).toEqual(['pfk'])
    expect(d.subjects.map((s) => s.label)).toEqual(['WiPo', 'LF06'])
  })

  it('reports unknown subjects and keeps day fields', () => {
    const [d] = mapSubjects(
      [day([sub('Sport', ['Ballspiele'], 'Sport'), sub('LF08')], { cancelledSubjects: ['pfk'] })],
      profile()
    )
    expect(d.unmapped).toEqual([sub('Sport', ['Ballspiele'], 'Sport')])
    expect(d.subjects.map((s) => s.label)).toEqual(['LF08'])
    expect(d).toMatchObject({ date: '2026-10-06', schoolBreak: false, cancelledSubjects: ['pfk'] })
  })

  it('merges two WebUntis subjects mapped to the same label', () => {
    const [d] = mapSubjects(
      [day([sub('LF10', ['Router', 'ACLs']), sub('LF10a', ['acls', 'NAT'])])],
      profile({ lf10a: 'LF10' })
    )
    expect(d.subjects).toEqual([{ label: 'LF10', topics: ['Router', 'ACLs', 'NAT'], from: ['LF10', 'LF10a'] }])
  })

  it('works on the output of schoolDaysFromWebuntis end to end', () => {
    const days = schoolDaysFromWebuntis([
      {
        date: '2026-10-07',
        holiday: false,
        lessons: [
          lesson('07:45', 'LF08', ['Übungsaufgaben']),
          lesson('11:15', 'pfk', [], { status: 'CANCELLED' }),
          lesson('13:00', 'wipo', ['Politischer Wochenrückblick']),
        ],
      },
      { date: '2026-10-08', holiday: false, lessons: [] },
    ])
    const mapped = mapSubjects(days, profile())
    expect(mapped[0].subjects).toEqual([
      { label: 'LF08', topics: ['Übungsaufgaben'], from: ['LF08'] },
      { label: 'WiPo', topics: ['Politischer Wochenrückblick'], from: ['wipo'] },
    ])
    expect(mapped[0].cancelledSubjects).toEqual(['pfk'])
    expect(mapped[1].subjects).toEqual([])
    expect(mapSubjects(null, profile())).toEqual([])
  })
})

describe('unmappedSubjects', () => {
  it('lists each unknown subject once across the week', () => {
    const mapped = mapSubjects(
      [day([sub('Sport'), sub('sport')]), day([sub('Reli', [], 'Religion'), sub('SPORT')], { date: '2026-10-07' })],
      profile()
    )
    expect(unmappedSubjects(mapped)).toEqual([
      { short: 'Sport', long: 'Sport lang' },
      { short: 'Reli', long: 'Religion' },
    ])
  })
})

describe('fillWeekFromWebuntis', () => {
  // Week day as newWeek() builds it (school day with two subjects)
  const weekDay = (date, extra = {}) => ({
    date,
    type: 'school',
    status: 'normal',
    holidayName: null,
    notes: '',
    bullets: ['', ''],
    subjects: [
      { label: 'LF08', bullets: [''] },
      { label: 'LF10', bullets: [''] },
    ],
    ...extra,
  })
  const week = (days) => ({ id: '2026-10-05', status: 'draft', instructions: '', days })
  const mappedDay = (date, subjects, extra = {}) => ({
    date,
    schoolBreak: false,
    cancelledSubjects: [],
    ignored: [],
    unmapped: [],
    subjects: subjects.map(([label, topics = [], from = [label]]) => ({ label, topics, from })),
    ...extra,
  })

  it('fills empty subjects with the topics as bullets', () => {
    const w = week([weekDay('2026-10-07')])
    const { week: out, count, changes } = fillWeekFromWebuntis(w, [
      mappedDay('2026-10-07', [['LF08', ['Übungsaufgaben', 'Fehlersuche']], ['LF10', ['Datenbanken']]]),
    ])
    expect(out.days[0].subjects).toEqual([
      { label: 'LF08', bullets: ['Übungsaufgaben', 'Fehlersuche'] },
      { label: 'LF10', bullets: ['Datenbanken'] },
    ])
    expect(count).toBe(2)
    expect(changes).toEqual([
      {
        date: '2026-10-07',
        skipped: null,
        cancelledSubjects: [],
        ignored: [],
        unmapped: [],
        subjects: [
          { label: 'LF08', topics: ['Übungsaufgaben', 'Fehlersuche'], from: ['LF08'], result: 'filled' },
          { label: 'LF10', topics: ['Datenbanken'], from: ['LF10'], result: 'filled' },
        ],
      },
    ])
    // Immutable: the input week is untouched
    expect(w.days[0].subjects[0].bullets).toEqual([''])
  })

  it('never overwrites a subject that already has text', () => {
    const w = week([
      weekDay('2026-10-07', {
        subjects: [
          { label: 'LF08', bullets: ['Eigener Text', ''] },
          { label: 'LF10', bullets: ['  '] },
        ],
      }),
    ])
    const { week: out, changes } = fillWeekFromWebuntis(w, [
      mappedDay('2026-10-07', [['LF08', ['Übungsaufgaben']], ['LF10', ['Datenbanken']]]),
    ])
    expect(out.days[0].subjects).toEqual([
      { label: 'LF08', bullets: ['Eigener Text', ''] },
      { label: 'LF10', bullets: ['Datenbanken'] },
    ])
    expect(changes[0].subjects.map((s) => s.result)).toEqual(['kept', 'filled'])
  })

  it('matches labels via subjectKey and appends subjects the day lacks', () => {
    const w = week([weekDay('2026-10-07', { subjects: [{ label: 'LF 8', bullets: [''] }] })])
    const { week: out, changes } = fillWeekFromWebuntis(w, [
      mappedDay('2026-10-07', [['LF08', ['Übungsaufgaben']], ['WiPo', ['Wahlen']], ['Englisch']]),
    ])
    expect(out.days[0].subjects).toEqual([
      { label: 'LF 8', bullets: ['Übungsaufgaben'] },
      { label: 'WiPo', bullets: ['Wahlen'] },
      { label: 'Englisch', bullets: [''] },
    ])
    expect(changes[0].subjects.map((s) => s.result)).toEqual(['filled', 'added', 'added'])
  })

  it('reports a subject without topics but leaves it empty', () => {
    const w = week([weekDay('2026-10-07')])
    const res = fillWeekFromWebuntis(w, [mappedDay('2026-10-07', [['LF08', []]])])
    expect(res.week).toBe(w)
    expect(res.count).toBe(0)
    expect(res.changes[0].subjects[0].result).toBe('noTopics')
  })

  it('never turns a work day into a school day', () => {
    const w = week([
      weekDay('2026-10-08', { type: 'work', subjects: [] }),
      weekDay('2026-10-09', { type: 'work', subjects: [] }),
    ])
    const res = fillWeekFromWebuntis(w, [
      mappedDay('2026-10-08', [['LF08', ['Übungsaufgaben']]]),
      mappedDay('2026-10-09', []), // work day without lessons: not reported
    ])
    expect(res.week).toBe(w)
    expect(res.changes).toEqual([
      {
        date: '2026-10-08',
        skipped: 'notSchoolDay',
        cancelledSubjects: [],
        ignored: [],
        unmapped: [],
        subjects: [{ label: 'LF08', topics: ['Übungsaufgaben'], from: ['LF08'], result: null }],
      },
    ])
  })

  it('leaves holiday, vacation and sick days alone', () => {
    const w = week([
      weekDay('2026-10-05', { status: 'holiday', holidayName: 'Testfeiertag' }),
      weekDay('2026-10-06', { status: 'sick' }),
    ])
    const res = fillWeekFromWebuntis(w, [
      mappedDay('2026-10-05', [['LF08', ['A']]]),
      mappedDay('2026-10-06', [['LF08', ['B']]]),
    ])
    expect(res.week).toBe(w)
    expect(res.changes.map((c) => c.skipped)).toEqual(['status', 'status'])
  })

  it('only reports a WebUntis school break', () => {
    const w = week([weekDay('2026-10-07')])
    const res = fillWeekFromWebuntis(w, [mappedDay('2026-10-07', [], { schoolBreak: true })])
    expect(res.week).toBe(w)
    expect(res.changes).toEqual([
      { date: '2026-10-07', skipped: 'schoolBreak', cancelledSubjects: [], ignored: [], unmapped: [], subjects: [] },
    ])
  })

  it('passes cancelled, ignored and unmapped subjects through for the preview', () => {
    const w = week([weekDay('2026-10-07')])
    const unmapped = [{ short: 'Sport', long: 'Sport lang', topics: [] }]
    const res = fillWeekFromWebuntis(w, [
      mappedDay('2026-10-07', [['LF10', ['Datenbanken']]], { cancelledSubjects: ['pfk'], ignored: ['FÖ'], unmapped }),
    ])
    expect(res.changes[0]).toMatchObject({ cancelledSubjects: ['pfk'], ignored: ['FÖ'], unmapped })
  })

  it('ignores WebUntis days outside the week and bad input', () => {
    const w = week([weekDay('2026-10-07')])
    expect(fillWeekFromWebuntis(w, [mappedDay('2026-10-14', [['LF08', ['X']]])])).toEqual({
      week: w,
      count: 0,
      changes: [],
    })
    expect(fillWeekFromWebuntis(w, null).week).toBe(w)
    expect(fillWeekFromWebuntis(w, [null, mappedDay('2026-10-07', [['', ['X']]])]).count).toBe(0)
  })

  it('works end to end on mapSubjects() output; unticking = filtering', () => {
    const days = schoolDaysFromWebuntis([
      {
        date: '2026-10-07',
        holiday: false,
        lessons: [lesson('11:15', 'LF08', ['Falsche Parallelstunde']), lesson('11:15', 'LF10', ['Normalisierung'])],
      },
    ])
    const mapped = mapSubjects(days, profile())
    // The user unticks LF08 (wrong parallel lesson in the school's timetable)
    const picked = mapped.map((d) => ({ ...d, subjects: d.subjects.filter((s) => s.label !== 'LF08') }))
    const { week: out } = fillWeekFromWebuntis(week([weekDay('2026-10-07')]), picked)
    expect(out.days[0].subjects).toEqual([
      { label: 'LF08', bullets: [''] },
      { label: 'LF10', bullets: ['Normalisierung'] },
    ])
  })
})
