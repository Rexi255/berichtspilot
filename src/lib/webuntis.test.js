// WebUntis week → school days. Fixtures are hand-written from the shape in
// docs/DECISIONS.md E-013 (no real timetable data in the repo).
import { describe, it, expect } from 'vitest'
import { schoolDaysFromWebuntis } from './webuntis.js'

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
