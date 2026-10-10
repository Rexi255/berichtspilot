// Anonymised shapes: structure must survive, personal values must not.
import { describe, it, expect } from 'vitest'
import { shapeOf, anonymizeUrl, createShape, addSample, shapeToJSON } from './shape.js'

describe('shapeOf', () => {
  it('replaces primitive values by their type', () => {
    expect(shapeOf({ id: 4711, ratio: 0.5, active: true, gone: null, name: 'Max Muster' })).toEqual({
      id: 'integer',
      ratio: 'number',
      active: 'boolean',
      gone: 'null',
      name: 'string(10)',
    })
  })

  it('never leaks string contents of free-text keys', () => {
    const json = JSON.stringify(shapeOf({ notes: 'Subnetting mit Herrn Müller', teacher: { name: 'MUE' } }))
    expect(json).not.toContain('Müller')
    expect(json).not.toContain('MUE')
  })

  it('recognises dates, datetimes and times', () => {
    expect(shapeOf(['2026-10-12', '2026-10-12T07:45:00', '2026-10-12T07:45Z', '07:45'])).toEqual({
      $array: 4,
      $of: 'date | datetime | time',
    })
  })

  it('keeps short identifier values only for enum-like keys', () => {
    expect(
      shapeOf({ resourceType: 'STUDENT', status: 'CANCELLED', roles: ['STUDENT'], label: 'STUDENT', type: 'two words' })
    ).toEqual({
      resourceType: 'enum["STUDENT"]',
      status: 'enum["CANCELLED"]',
      roles: { $array: 1, $of: 'enum["STUDENT"]' },
      label: 'string(7)',
      type: 'string(9)',
    })
  })

  it('merges array items and marks keys missing in some items as optional', () => {
    const lessons = [
      { subject: 'LF4', state: 'NORMAL' },
      { subject: 'WiSo', state: 'CANCELLED', notes: 'VLAN-Grundlagen' },
      { subject: 'Deutsch', state: 'NORMAL', notes: null },
    ]
    expect(shapeOf({ lessons })).toEqual({
      lessons: {
        $array: 3,
        $of: {
          subject: 'string(3..7)',
          state: 'enum["CANCELLED", "NORMAL"]',
          'notes?': 'null | string(15)',
        },
      },
    })
  })

  it('describes empty arrays and mixed object/null positions', () => {
    expect(shapeOf({ list: [], maybe: [{ a: 1 }, null] })).toEqual({
      list: { $array: 0, $of: 'empty' },
      maybe: { $array: 2, $of: { a: 'integer', $or: 'null' } },
    })
  })

  it('hides ids used as object keys', () => {
    expect(shapeOf({ elementPeriods: { 36931: [{ a: 1 }], 4711: [{ a: 2 }] } })).toEqual({
      elementPeriods: { '<n>': { $array: 1, $of: { a: 'integer' } } },
    })
  })

  it('accumulates several responses into one shape', () => {
    const node = createShape()
    addSample(node, { a: 1 })
    addSample(node, { a: 2, b: 'x' })
    expect(shapeToJSON(node)).toEqual({ a: 'integer', 'b?': 'string(1)' })
  })

  it('stops at a maximum depth instead of recursing forever', () => {
    let deep = { leaf: true }
    for (let i = 0; i < 40; i++) deep = { child: deep }
    expect(JSON.stringify(shapeOf(deep))).toContain('…(too deep)')
  })
})

describe('anonymizeUrl', () => {
  it('keeps host, API path and enum-like params, hides ids and free values', () => {
    expect(
      anonymizeUrl(
        'https://beispiel-bbs.webuntis.com/WebUntis/api/rest/view/v1/timetable/entries?start=2026-10-12&end=2026-10-16&format=4&resourceType=STUDENT&resources=12345&periodTypes=&timetableType=MY_TIMETABLE'
      )
    ).toBe(
      'beispiel-bbs.webuntis.com/WebUntis/api/rest/view/v1/timetable/entries?start=<date>&end=<date>&format=4&resourceType=STUDENT&resources=<n>&periodTypes=&timetableType=MY_TIMETABLE'
    )
  })

  it('replaces numeric and odd path segments and drops the fragment', () => {
    expect(anonymizeUrl('https://x.webuntis.com/WebUntis/api/lessons/98765/detail/a1b2c3d4e5?user=max.muster#top')).toBe(
      'x.webuntis.com/WebUntis/api/lessons/:n/detail/:id?user=<string(10)>'
    )
  })

  it('keeps the public school name and flags 8-digit dates', () => {
    expect(anonymizeUrl('https://x.webuntis.com/WebUntis/jsonrpc.do?school=beispiel-bbs&date=20261012')).toBe(
      'x.webuntis.com/WebUntis/jsonrpc.do?school=beispiel-bbs&date=<yyyymmdd?>'
    )
  })

  it('does not throw on garbage', () => {
    expect(anonymizeUrl('not a url')).toBe('(invalid url)')
  })
})
