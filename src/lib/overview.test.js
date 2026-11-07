import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import {
  dayHasContent,
  dayState,
  dayLetter,
  weekProgress,
  missingWeeks,
  dueWeeks,
  overviewStats,
  yearBand,
  parseQuery,
  matchWeek,
  weekRows,
} from './overview.js'
import { migrateData } from './model.js'

const demo = migrateData(JSON.parse(fs.readFileSync(new URL('../../e2e/fixtures/demo-daten.json', import.meta.url), 'utf8')))
const TODAY = '2026-11-04' // the demo record's today (Wed, KW 45)
const CURRENT = '2026-11-02'

const day = (date, patch = {}) => ({
  date, type: 'work', status: 'normal', holidayName: null, notes: '', bullets: [''], subjects: [], ...patch,
})
const week = (id, days, status = 'draft') => ({ id, status, instructions: '', days })
const record = (weeks, settings = {}) => ({ settings: { trainingStart: '', trainingEnd: '', ...settings }, weeks, profiles: [], periods: [] })

describe('day state', () => {
  it('counts only content that reaches the output', () => {
    expect(dayHasContent(day('2026-11-02', { bullets: ['  '] }))).toBe(false)
    expect(dayHasContent(day('2026-11-02', { bullets: ['Drucker getauscht'] }))).toBe(true)
    // school: a subject needs a label AND a bullet (format.js drops the rest)
    const school = (subjects) => day('2026-11-02', { type: 'school', bullets: [''], subjects })
    expect(dayHasContent(school([{ label: '', bullets: ['Thema'] }]))).toBe(false)
    expect(dayHasContent(school([{ label: 'LF03', bullets: [''] }]))).toBe(false)
    expect(dayHasContent(school([{ label: 'LF03', bullets: ['Subnetting'] }]))).toBe(true)
  })

  it('puts the status first, then written, then future/open', () => {
    expect(dayState(day('2026-12-25', { status: 'holiday' }), TODAY)).toBe('holiday')
    expect(dayState(day('2026-11-05', { bullets: ['x'] }), TODAY)).toBe('written')
    expect(dayState(day('2026-11-05'), TODAY)).toBe('future')
    expect(dayState(day('2026-11-04'), TODAY)).toBe('open')
    expect(dayState(day('2026-11-03', { status: 'sick' }), TODAY)).toBe('sick')
  })

  it('has a letter per type and status', () => {
    expect(['work', 'school'].map((type) => dayLetter(day('x', { type })))).toEqual(['B', 'S'])
    expect(['holiday', 'sick', 'vacation'].map((status) => dayLetter(day('x', { type: 'school', status })))).toEqual(['F', 'K', 'U'])
  })

  it('counts written of needed days (status days need nothing)', () => {
    const w = week('2026-11-02', [
      day('2026-11-02', { bullets: ['a'] }),
      day('2026-11-03'),
      day('2026-11-04', { status: 'holiday' }),
    ])
    expect(weekProgress(w)).toEqual({ written: 1, needed: 2 })
  })
})

describe('due and missing weeks', () => {
  it('never counts the running week as missing, and caps at the training end', () => {
    const data = record([week('2026-03-02', [])], { trainingStart: '2026-03-02', trainingEnd: '2026-03-27' })
    expect(missingWeeks(data, '2026-04-13')).toEqual(['2026-03-09', '2026-03-16', '2026-03-23'])
  })

  it('steps over the DST switches (end of March, end of October)', () => {
    const data = record([], { trainingStart: '2026-03-23' })
    expect(missingWeeks(data, '2026-04-13')).toEqual(['2026-03-23', '2026-03-30', '2026-04-06'])
    const autumn = record([], { trainingStart: '2026-10-19' })
    expect(missingWeeks(autumn, '2026-11-09')).toEqual(['2026-10-19', '2026-10-26', '2026-11-02'])
  })

  it('starts at the first report without a training start', () => {
    const data = record([week('2026-10-19', [])])
    expect(missingWeeks(data, '2026-11-09')).toEqual(['2026-10-26', '2026-11-02'])
    expect(missingWeeks(record([]), '2026-11-09')).toEqual([])
  })

  it('counts the current week as due only once it exists', () => {
    const data = record([week('2026-10-26', [])], { trainingStart: '2026-10-26' })
    expect(dueWeeks(data, '2026-11-02')).toEqual(['2026-10-26'])
    data.weeks.push(week('2026-11-02', []))
    expect(dueWeeks(data, '2026-11-02')).toEqual(['2026-10-26', '2026-11-02'])
  })

  it('adds up: done + drafts + missing = due (demo record)', () => {
    const stats = overviewStats(demo, CURRENT)
    expect(stats).toMatchObject({ due: 62, done: 54, drafts: 4 })
    expect(stats.missing).toEqual(['2026-03-16', '2026-06-08', '2026-06-15', '2026-10-19'])
    expect(stats.done + stats.drafts + stats.missing.length).toBe(stats.due)
  })
})

describe('yearBand', () => {
  const band = yearBand(demo, TODAY)

  it('has one column per week from the training start to its end', () => {
    expect(band.columns[0].monday).toBe('2025-09-01')
    expect(band.columns.at(-1).monday).toBe('2028-08-28')
    expect(band.columns.every((c) => c.cells.length === 5)).toBe(true)
  })

  it('marks the current week and the states of its days', () => {
    const current = band.columns.find((c) => c.current)
    expect(current.monday).toBe(CURRENT)
    expect(current.week).toBe(45)
    // Mon school written, Tue written, Wed (today) only notes, Thu/Fri ahead
    expect(current.cells).toEqual(['written', 'written', 'open', 'future', 'future'])
  })

  it('shows missing weeks as open, future weeks as future, days after the end as none', () => {
    expect(band.columns.find((c) => c.monday === '2026-10-19')).toMatchObject({ status: 'missing', cells: Array(5).fill('open') })
    expect(band.columns.find((c) => c.monday === '2027-03-01')).toMatchObject({ status: 'future', cells: Array(5).fill('future') })
    // training ends Thu 2028-08-31: Friday is outside
    expect(band.columns.at(-1).cells).toEqual(['future', 'future', 'future', 'future', 'none'])
  })

  it('carries holiday, sick and vacation days', () => {
    const christmas = band.columns.find((c) => c.monday === '2025-12-22')
    expect(christmas.cells).toEqual(['vacation', 'vacation', 'vacation', 'holiday', 'holiday'])
    expect(band.columns.find((c) => c.monday === '2026-02-09').cells[1]).toBe('sick')
  })

  it('labels months at their first week (by Thursday); January and the first label with the year', () => {
    expect(band.months[0]).toEqual({ column: 0, label: 'Sep 2025' })
    expect(band.months[1].label).toBe('Okt')
    const january = band.months.find((m) => m.label.startsWith('Jan'))
    expect(january.label).toBe('Jan 2026')
    // 2025-12-29 belongs to January (its Thursday is 2026-01-01)
    expect(band.columns[january.column].monday).toBe('2025-12-29')
  })

  it('without an end date runs 12 weeks past today', () => {
    const data = record([], { trainingStart: '2026-10-05' })
    const b = yearBand(data, TODAY)
    expect(b.columns.at(-1).monday).toBe('2027-01-25')
    expect(b.columns.find((c) => c.current).cells).toEqual(['open', 'open', 'open', 'future', 'future'])
  })
})

describe('search', () => {
  it('reads week numbers, dates and free text', () => {
    expect(parseQuery('KW 42')).toEqual({ kind: 'week', week: 42, year: null })
    expect(parseQuery('kw42/2026')).toEqual({ kind: 'week', week: 42, year: 2026 })
    expect(parseQuery('7')).toEqual({ kind: 'week', week: 7, year: null })
    expect(parseQuery('15.10.')).toEqual({ kind: 'date', day: 15, month: 10, year: null })
    expect(parseQuery('15.10.2026')).toEqual({ kind: 'date', day: 15, month: 10, year: 2026 })
    expect(parseQuery('2026-10-15')).toEqual({ kind: 'date', day: 15, month: 10, year: 2026 })
    expect(parseQuery('  Drucker ')).toEqual({ kind: 'text', text: 'drucker' })
    expect(parseQuery('99')).toEqual({ kind: 'text', text: '99' })
    expect(parseQuery('')).toBeNull()
  })

  it('matches weeks by number, date (any day of the week) and text with a snippet', () => {
    const w = week('2026-10-12', [day('2026-10-12', { bullets: ['Drucker im Lager getauscht'] })])
    expect(matchWeek(parseQuery('42'), '2026-10-12', w)).toBe('')
    expect(matchWeek(parseQuery('KW 42/2025'), '2026-10-12', w)).toBeNull()
    expect(matchWeek(parseQuery('18.10.'), '2026-10-12', w)).toBe('')
    expect(matchWeek(parseQuery('19.10.'), '2026-10-12', w)).toBeNull()
    expect(matchWeek(parseQuery('drucker'), '2026-10-12', w)).toBe('Drucker im Lager getauscht')
    // a missing week matches by number, never by text
    expect(matchWeek(parseQuery('43'), '2026-10-19', null)).toBe('')
    expect(matchWeek(parseQuery('drucker'), '2026-10-19', null)).toBeNull()
  })
})

describe('weekRows', () => {
  it('lists the newest 8 rows grouped by month, missing weeks included', () => {
    const { groups, total, shown } = weekRows(demo, TODAY)
    expect(total).toBe(62)
    expect(shown).toBe(8)
    expect(groups.map((g) => g.label)).toEqual(['November 2026', 'Oktober 2026', 'September 2026'])
    const rows = groups.flatMap((g) => g.rows)
    expect(rows[0]).toMatchObject({ monday: CURRENT, week: 45, status: 'draft', current: true })
    expect(rows.find((r) => r.monday === '2026-10-19')).toMatchObject({ status: 'missing' })
    expect(rows[0].days.map((d) => `${d.short}${d.letter}:${d.state}`)).toEqual([
      'MoS:written', 'DiB:written', 'MiB:open', 'DoS:future', 'FrB:future',
    ])
  })

  it('shows all rows with limit 0 and every match while searching', () => {
    expect(weekRows(demo, TODAY, { limit: 0 }).shown).toBe(62)
    const found = weekRows(demo, TODAY, { query: 'kw 43' })
    expect(found.groups.flatMap((g) => g.rows).map((r) => r.monday)).toEqual(['2026-10-19', '2025-10-20'])
    const text = weekRows(demo, TODAY, { query: 'usv' }).groups.flatMap((g) => g.rows)
    expect(text.length).toBeGreaterThan(0)
    expect(text.every((r) => r.snippet && /usv/i.test(r.snippet))).toBe(true)
  })
})
