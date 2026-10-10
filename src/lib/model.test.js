// Data model: schema migration, import validation/merge, periods and profile
// validity checks.
import { describe, it, expect } from 'vitest'
import {
  DATA_VERSION,
  migrateData,
  validateData,
  mergeData,
  replaceData,
  seedData,
  newWeek,
  weekFromTemplate,
  applyPeriod,
  periodFor,
  checkProfiles,
  duplicateProfile,
  profileForDate,
  shouldAutoCreate,
} from './model.js'

const profileWith = (patch) => ({
  id: 'p1',
  name: 'Testprofil',
  state: 'SH',
  validFrom: '2026-02-02',
  validTo: '2026-07-31',
  defaultBulletCount: 2,
  weekdays: {
    mon: { type: 'school', subjects: ['LF02'] },
    tue: { type: 'work', subjects: [] },
    wed: { type: 'work', subjects: [] },
    thu: { type: 'work', subjects: [] },
    fri: { type: 'work', subjects: [] },
    sat: { type: 'off', subjects: [] },
  },
  ...patch,
})

// A realistic v2 file (German field names) covering every enum value
const v2File = () => ({
  version: 2,
  einstellungen: {
    ausbildungVon: '2025-08-01',
    ausbildungBis: '2028-07-31',
    theme: 'waldgruen',
    startAnsicht: 'profile',
    textbausteine: ['Ticket bearbeitet'],
    eigenesFeld: 42, // unknown extra field must survive
  },
  zeitraeume: [
    { id: 'zeitraum-1', typ: 'urlaub', label: 'Sommer', von: '2026-08-03', bis: '2026-08-14' },
    { id: 'zeitraum-2', typ: 'ferien', label: 'Herbstferien', von: '2026-10-12', bis: '2026-10-24' },
  ],
  profile: [
    {
      id: 'profil-abc',
      name: 'Schulhalbjahr 2025/26 · 2',
      bundesland: 'SH',
      gueltigVon: '2026-02-02',
      gueltigBis: '2026-07-31',
      standardStichpunkte: 3,
      wochentage: {
        mo: { typ: 'schule', faecher: ['LF02', 'Englisch'] },
        di: { typ: 'schule', faecher: ['LF04'] },
        mi: { typ: 'betrieb', faecher: [] },
        do: { typ: 'betrieb', faecher: [] },
        fr: { typ: 'betrieb', faecher: [] },
        sa: { typ: 'frei', faecher: [] },
      },
    },
  ],
  wochen: [
    {
      id: '2026-04-27',
      status: 'fertig',
      unterweisungen: 'Brandschutzunterweisung',
      tage: [
        {
          datum: '2026-04-27',
          typ: 'schule',
          status: 'normal',
          feiertagName: null,
          stichpunkte: ['', ''],
          faecher: [{ label: 'LF02', punkte: ['Tarifverträge'] }],
        },
        { datum: '2026-04-28', typ: 'schule', status: 'krank', feiertagName: null, stichpunkte: [], faecher: [] },
        { datum: '2026-04-29', typ: 'betrieb', status: 'urlaub', feiertagName: null, stichpunkte: [''], faecher: [] },
        { datum: '2026-04-30', typ: 'betrieb', status: 'normal', feiertagName: null, stichpunkte: ['Switch-Ports konfiguriert'], faecher: [] },
        { datum: '2026-05-01', typ: 'betrieb', status: 'feiertag', feiertagName: 'Tag der Arbeit', stichpunkte: [''], faecher: [] },
      ],
    },
    { id: '2026-05-04', status: 'entwurf', unterweisungen: '', tage: [] },
  ],
})

describe('migrateData', () => {
  it('migrates a full v2 file to the current version with English names and values', () => {
    const d = migrateData(v2File())
    expect(d.version).toBe(DATA_VERSION)
    expect(DATA_VERSION).toBe(8)

    expect(d.settings).toEqual({
      trainingStart: '2025-08-01',
      trainingEnd: '2028-07-31',
      theme: 'forest',
      startView: 'profiles',
      snippets: ['Ticket bearbeitet'],
      eigenesFeld: 42,
      webuntis: { enabled: false },
      autoCreateWeek: true,
      updateCheck: true,
    })
    expect(d.periods).toEqual([
      { id: 'zeitraum-1', type: 'vacation', label: 'Sommer', from: '2026-08-03', to: '2026-08-14' },
      { id: 'zeitraum-2', type: 'schoolBreak', label: 'Herbstferien', from: '2026-10-12', to: '2026-10-24' },
    ])
    expect(d.profiles).toEqual([
      {
        id: 'profil-abc', // ids are opaque and stay unchanged
        name: 'Schulhalbjahr 2025/26 · 2',
        state: 'SH',
        validFrom: '2026-02-02',
        validTo: '2026-07-31',
        defaultBulletCount: 3,
        weekdays: {
          mon: { type: 'school', subjects: ['LF02', 'Englisch'] },
          tue: { type: 'school', subjects: ['LF04'] },
          wed: { type: 'work', subjects: [] },
          thu: { type: 'work', subjects: [] },
          fri: { type: 'work', subjects: [] },
          sat: { type: 'off', subjects: [] },
        },
        webuntisSubjects: {},
      },
    ])
    expect(d.weeks[0]).toEqual({
      id: '2026-04-27',
      status: 'done',
      instructions: 'Brandschutzunterweisung',
      days: [
        {
          date: '2026-04-27',
          type: 'school',
          status: 'normal',
          holidayName: null,
          notes: '',
          bullets: ['', ''],
          subjects: [{ label: 'LF02', bullets: ['Tarifverträge'] }],
        },
        { date: '2026-04-28', type: 'school', status: 'sick', holidayName: null, notes: '', bullets: [], subjects: [] },
        { date: '2026-04-29', type: 'work', status: 'vacation', holidayName: null, notes: '', bullets: [''], subjects: [] },
        { date: '2026-04-30', type: 'work', status: 'normal', holidayName: null, notes: '', bullets: ['Switch-Ports konfiguriert'], subjects: [] },
        { date: '2026-05-01', type: 'work', status: 'holiday', holidayName: 'Tag der Arbeit', notes: '', bullets: [''], subjects: [] },
      ],
    })
    expect(d.weeks[1]).toEqual({ id: '2026-05-04', status: 'draft', instructions: '', days: [] })
    // no German top-level keys left behind
    for (const key of ['einstellungen', 'zeitraeume', 'profile', 'wochen']) expect(d).not.toHaveProperty(key)
    expect(() => validateData(d)).not.toThrow()
  })

  it('migrates every theme id and start view', () => {
    const themes = {
      nordlicht: 'northern-lights', polarnacht: 'polar-night', waldgruen: 'forest',
      bernstein: 'amber', rose: 'rose', graphit: 'graphite',
    }
    for (const [from, to] of Object.entries(themes)) {
      expect(migrateData({ version: 2, einstellungen: { theme: from }, profile: [], wochen: [] }).settings.theme).toBe(to)
    }
    const views = { uebersicht: 'overview', editor: 'editor', profile: 'profiles', einstellungen: 'settings' }
    for (const [from, to] of Object.entries(views)) {
      expect(migrateData({ version: 2, einstellungen: { startAnsicht: from }, profile: [], wochen: [] }).settings.startView).toBe(to)
    }
  })

  it('migrates v1 all the way to the current version and fills new fields', () => {
    const v1 = {
      version: 1,
      einstellungen: { theme: 'graphit', ausbildungVon: '', ausbildungBis: '' },
      profile: [],
      wochen: [],
    }
    const d = migrateData(v1)
    expect(d.version).toBe(DATA_VERSION)
    expect(d.periods).toEqual([])
    expect(d.settings.startView).toBe('overview')
    expect(d.settings.snippets).toEqual([])
    expect(d.settings.theme).toBe('graphite') // kept (and renamed)
    expect(d.profiles).toEqual([])
    expect(d.weeks).toEqual([])
  })

  it('treats a missing version as v1', () => {
    expect(migrateData({ profile: [], wochen: [] }).version).toBe(DATA_VERSION)
  })

  it('leaves current data unchanged', () => {
    const seed = { ...seedData(), weeks: [newWeek('2026-04-20', [profileWith({})])] }
    expect(migrateData(seed)).toEqual(seed)
  })

  it('v3 -> v4 adds empty notes to every day and keeps existing ones', () => {
    const v3 = {
      version: 3,
      settings: {},
      periods: [],
      profiles: [],
      weeks: [
        {
          id: '2026-04-20',
          status: 'draft',
          instructions: '',
          days: [
            { date: '2026-04-20', type: 'work', status: 'normal', holidayName: null, bullets: ['x'], subjects: [] },
            { date: '2026-04-21', type: 'work', status: 'normal', holidayName: null, notes: 'schon da', bullets: [], subjects: [] },
          ],
        },
      ],
    }
    const d = migrateData(v3)
    expect(d.version).toBe(DATA_VERSION)
    expect(d.weeks[0].days.map((day) => day.notes)).toEqual(['', 'schon da'])
    expect(d.weeks[0].days[0].bullets).toEqual(['x'])
    expect(() => validateData(d)).not.toThrow()
  })

  it('v4 -> v5 adds the WebUntis switch (off) and keeps all other settings', () => {
    const v4 = {
      version: 4,
      settings: { theme: 'forest', startView: 'editor', snippets: ['a'] },
      periods: [],
      profiles: [],
      weeks: [],
    }
    const d = migrateData(v4)
    expect(d.version).toBe(DATA_VERSION)
    expect(d.settings).toEqual({
      theme: 'forest', startView: 'editor', snippets: ['a'], webuntis: { enabled: false }, autoCreateWeek: true,
      updateCheck: true,
    })
    expect(() => validateData(d)).not.toThrow()
  })

  it('v4 -> v5 keeps an existing WebUntis value and survives missing settings', () => {
    expect(migrateData({ version: 4, settings: { webuntis: { enabled: true } }, profiles: [], weeks: [] })
      .settings.webuntis).toEqual({ enabled: true })
    expect(migrateData({ version: 4, profiles: [], weeks: [] }).settings.webuntis).toEqual({ enabled: false })
  })

  it('resets a malformed WebUntis value to "off" instead of keeping it', () => {
    const webuntisOf = (value) =>
      migrateData({ version: 5, settings: { webuntis: value }, profiles: [], weeks: [] }).settings.webuntis
    expect(webuntisOf('on')).toEqual({ enabled: false })
    expect(webuntisOf(['x'])).toEqual({ enabled: false })
    expect(webuntisOf(null)).toEqual({ enabled: false })
    expect(webuntisOf({})).toEqual({ enabled: false })
    expect(webuntisOf({ enabled: 'ja' })).toEqual({ enabled: false })
    expect(webuntisOf({ enabled: true })).toEqual({ enabled: true })
    const d = migrateData({ version: 5, settings: 'kaputt', profiles: [], weeks: [] })
    expect(d.settings).toEqual({
      startView: 'overview', snippets: [], webuntis: { enabled: false }, autoCreateWeek: true, updateCheck: true,
    })
    expect(() => validateData(d)).not.toThrow()
  })

  it('v5 -> v6 adds an empty WebUntis subject map per profile, keeping existing ones', () => {
    const profile = (extra = {}) => ({ id: 'p1', name: 'HJ', weekdays: {}, ...extra })
    const d = migrateData({
      version: 5,
      settings: { webuntis: { enabled: true } },
      profiles: [profile(), profile({ id: 'p2', webuntisSubjects: { kom: 'Kommunikation', pfk: '' } })],
      weeks: [],
    })
    expect(d.version).toBe(DATA_VERSION)
    expect(d.profiles.map((p) => p.webuntisSubjects)).toEqual([{}, { kom: 'Kommunikation', pfk: '' }])
    expect(d.settings.webuntis).toEqual({ enabled: true })
    expect(() => validateData(d)).not.toThrow()
  })

  it('drops malformed WebUntis subject map entries', () => {
    const mapOf = (value) =>
      migrateData({ version: 6, profiles: [{ id: 'p', name: 'HJ', weekdays: {}, webuntisSubjects: value }], weeks: [] })
        .profiles[0].webuntisSubjects
    expect(mapOf('kaputt')).toEqual({})
    expect(mapOf(['LF01'])).toEqual({})
    expect(mapOf({ kom: 'Kommunikation', x: 5, y: null })).toEqual({ kom: 'Kommunikation' })
  })

  it('v6 -> v7 turns "create the current week on start" on and keeps an existing value', () => {
    const d = migrateData({ version: 6, settings: { theme: 'forest', webuntis: { enabled: true } }, profiles: [], weeks: [] })
    expect(d.version).toBe(DATA_VERSION)
    expect(d.settings).toEqual({
      theme: 'forest', startView: 'overview', snippets: [], webuntis: { enabled: true }, autoCreateWeek: true,
      updateCheck: true,
    })
    expect(() => validateData(d)).not.toThrow()
    expect(migrateData({ version: 7, settings: { autoCreateWeek: false }, profiles: [], weeks: [] })
      .settings.autoCreateWeek).toBe(false)
  })

  it('treats a malformed autoCreateWeek value as the default (on)', () => {
    const autoOf = (value) =>
      migrateData({ version: 7, settings: { autoCreateWeek: value }, profiles: [], weeks: [] }).settings.autoCreateWeek
    expect(autoOf('nein')).toBe(true)
    expect(autoOf(null)).toBe(true)
    expect(autoOf(0)).toBe(true)
    expect(autoOf(true)).toBe(true)
  })

  it('v7 -> v8 turns the update check on start on and keeps an existing value', () => {
    const d = migrateData({ version: 7, settings: { theme: 'forest', autoCreateWeek: false }, profiles: [], weeks: [] })
    expect(d.version).toBe(8)
    expect(d.settings).toEqual({
      theme: 'forest', startView: 'overview', snippets: [], webuntis: { enabled: false }, autoCreateWeek: false,
      updateCheck: true,
    })
    expect(() => validateData(d)).not.toThrow()
    expect(migrateData({ version: 8, settings: { updateCheck: false }, profiles: [], weeks: [] })
      .settings.updateCheck).toBe(false)
  })

  it('treats a malformed updateCheck value as the default (on)', () => {
    const checkOf = (value) =>
      migrateData({ version: 8, settings: { updateCheck: value }, profiles: [], weeks: [] }).settings.updateCheck
    expect(checkOf('nein')).toBe(true)
    expect(checkOf(null)).toBe(true)
    expect(checkOf(0)).toBe(true)
  })

  it('keeps unknown enum values instead of dropping them', () => {
    const d = migrateData({
      version: 2,
      profile: [],
      wochen: [{ id: '2026-05-04', status: 'seltsam', unterweisungen: '', tage: [] }],
    })
    expect(d.weeks[0].status).toBe('seltsam')
  })

  it('rejects data from a newer version (downgrade protection)', () => {
    expect(() => migrateData({ version: DATA_VERSION + 1 })).toThrow(/neueren Version/)
  })

  it('rejects non-objects with a readable message', () => {
    expect(() => migrateData(null)).toThrow(/Datenobjekt/)
    expect(() => migrateData([])).toThrow(/Datenobjekt/)
  })

  it('does not mutate the original', () => {
    const v2 = v2File()
    const copy = structuredClone(v2)
    migrateData(v2)
    expect(v2).toEqual(copy)
  })

  it('leaves broken structures for validateData to report', () => {
    const d = migrateData({ version: 2, profile: [{}], wochen: 'kaputt' })
    expect(() => validateData(d)).toThrow()
  })
})

describe('validateData', () => {
  it('accepts the seed data', () => {
    expect(() => validateData(seedData())).not.toThrow()
  })

  it('throws for missing lists or broken structures', () => {
    expect(() => validateData(null)).toThrow()
    expect(() => validateData({ profiles: [], weeks: 'nope' })).toThrow()
    expect(() => validateData({ profiles: [{}], weeks: [] })).toThrow(/Profil/)
    expect(() => validateData({ profiles: [], weeks: [{ id: 'kein-datum', days: [] }] })).toThrow(/Woche/)
    expect(() =>
      validateData({ profiles: [], weeks: [{ id: '2026-07-06', days: [{ date: 'x' }] }] })
    ).toThrow(/Tag/)
    expect(() =>
      validateData({ profiles: [], weeks: [{ id: '2026-07-06', days: [{ date: '2026-07-06', notes: 42 }] }] })
    ).toThrow(/Tag/)
    expect(() =>
      validateData({ settings: { webuntis: { enabled: 'ja' } }, profiles: [], weeks: [] })
    ).toThrow(/WebUntis/)
    expect(() =>
      validateData({ settings: { autoCreateWeek: 'ja' }, profiles: [], weeks: [] })
    ).toThrow(/Aktuelle Woche/)
    expect(() =>
      validateData({ settings: { updateCheck: 'ja' }, profiles: [], weeks: [] })
    ).toThrow(/Updates/)
    expect(() =>
      validateData({ profiles: [{ id: 'p', name: 'HJ', weekdays: {}, webuntisSubjects: { kom: 1 } }], weeks: [] })
    ).toThrow(/Fächerzuordnung/)
  })
})

describe('replaceData', () => {
  it('takes everything from the file except the WebUntis switch', () => {
    const current = { ...seedData(), settings: { ...seedData().settings, webuntis: { enabled: false } } }
    const imported = {
      ...seedData(),
      weeks: [{ id: '2026-07-06', status: 'done', instructions: '', days: [] }],
      settings: { ...seedData().settings, theme: 'rose', webuntis: { enabled: true } },
    }
    const result = replaceData(current, imported)
    expect(result.weeks).toEqual(imported.weeks)
    expect(result.settings.theme).toBe('rose')
    expect(result.settings.webuntis).toEqual({ enabled: false })
    expect(replaceData(imported, current).settings.webuntis).toEqual({ enabled: true })
  })

  it("keeps this device's update-check switch", () => {
    const current = { ...seedData(), settings: { ...seedData().settings, updateCheck: false } }
    const imported = { ...seedData(), settings: { ...seedData().settings, updateCheck: true } }
    expect(replaceData(current, imported).settings.updateCheck).toBe(false)
    expect(replaceData(imported, current).settings.updateCheck).toBe(true)
  })
})

describe('mergeData', () => {
  it('adds only what is missing; existing entries stay unchanged', () => {
    const current = {
      ...seedData(),
      weeks: [{ id: '2026-07-06', status: 'done', instructions: '', days: [] }],
    }
    const imported = migrateData({
      version: 1,
      profile: [{ id: 'new-1', name: 'Neu', bundesland: 'SH', wochentage: {} }],
      wochen: [
        { id: '2026-07-06', status: 'entwurf', unterweisungen: 'anders', tage: [] }, // conflict
        { id: '2026-06-29', status: 'fertig', unterweisungen: '', tage: [] }, // new
      ],
    })
    const result = mergeData(current, imported)
    expect(result.weeks.map((w) => w.id)).toEqual(['2026-06-29', '2026-07-06'])
    expect(result.weeks[1].status).toBe('done') // existing week wins
    expect(result.weeks[0].status).toBe('done') // imported week was migrated
    expect(result.profiles.some((p) => p.id === 'new-1')).toBe(true)
    expect(result.settings).toEqual(current.settings)
  })
})

describe('periods', () => {
  const vacation = { id: 'z1', type: 'vacation', label: 'Sommerurlaub', from: '2026-08-03', to: '2026-08-14' }
  const schoolBreak = { id: 'z2', type: 'schoolBreak', label: 'Sommerferien', from: '2026-07-20', to: '2026-08-28' }

  it('periodFor finds the matching period', () => {
    expect(periodFor('2026-08-05', [vacation, schoolBreak])).toBe(vacation)
    expect(periodFor('2026-08-20', [vacation, schoolBreak])).toBe(schoolBreak)
    expect(periodFor('2026-09-01', [vacation, schoolBreak])).toBeNull()
  })

  it('new week during vacation: days become vacation, holiday wins', () => {
    const period = { id: 'z', type: 'vacation', label: '', from: '2026-04-27', to: '2026-05-03' }
    // week from Mon 2026-04-27 — Fri 05-01 is Tag der Arbeit
    const week = newWeek('2026-04-27', [], [period])
    const friday = week.days.find((d) => d.date === '2026-05-01')
    expect(friday.status).toBe('holiday')
    expect(friday.holidayName).toBe('Tag der Arbeit')
    for (const d of week.days.filter((d) => d.date !== '2026-05-01')) {
      expect(d.status).toBe('vacation')
    }
  })

  it('new week during school break: school days become work days', () => {
    const profile = profileWith({ validFrom: '2026-02-02', validTo: '2026-12-31' })
    const week = newWeek('2026-07-20', [profile], [schoolBreak]) // Monday would be school
    const monday = week.days.find((d) => d.date === '2026-07-20')
    expect(monday.type).toBe('work')
    expect(monday.subjects).toEqual([])
  })

  it('applyPeriod marks only empty normal days of existing weeks', () => {
    const weeks = [
      {
        id: '2026-08-03',
        status: 'draft',
        instructions: '',
        days: [
          { date: '2026-08-03', type: 'work', status: 'normal', holidayName: null, bullets: ['', ''], subjects: [] },
          { date: '2026-08-04', type: 'work', status: 'normal', holidayName: null, bullets: ['Inhalt!'], subjects: [] },
          { date: '2026-08-05', type: 'work', status: 'sick', holidayName: null, bullets: [''], subjects: [] },
        ],
      },
    ]
    const result = applyPeriod(weeks, vacation)
    expect(result[0].days[0].status).toBe('vacation') // empty -> marked
    expect(result[0].days[1].status).toBe('normal') // content -> untouched
    expect(result[0].days[2].status).toBe('sick') // manual status -> untouched
    // school-break periods don't change existing weeks
    expect(applyPeriod(weeks, schoolBreak)).toBe(weeks)
  })
})

describe('newWeek / weekFromTemplate', () => {
  it('builds the week from the matching profile', () => {
    const week = newWeek('2026-04-20', [profileWith({})])
    expect(week).toMatchObject({ id: '2026-04-20', status: 'draft', instructions: '' })
    expect(week.days.map((d) => d.type)).toEqual(['school', 'work', 'work', 'work', 'work'])
    expect(week.days[0].subjects).toEqual([{ label: 'LF02', bullets: [''] }])
    expect(week.days[1].bullets).toEqual(['', ''])
    expect(week.days.every((d) => d.notes === '')).toBe(true)
  })

  it('copies the structure of a previous week with empty bullets', () => {
    const template = newWeek('2026-04-20', [profileWith({})])
    template.days[0].subjects[0].bullets = ['Inhalt']
    template.days[0].notes = 'Rohtext'
    const week = weekFromTemplate('2026-04-27', template, [profileWith({})])
    expect(week.days[0]).toMatchObject({ date: '2026-04-27', type: 'school', notes: '', subjects: [{ label: 'LF02', bullets: [''] }] })
    expect(week.days[4]).toMatchObject({ date: '2026-05-01', status: 'holiday', holidayName: 'Tag der Arbeit' })
  })
})

describe('checkProfiles', () => {
  it('reports overlaps', () => {
    const warnings = checkProfiles([
      profileWith({ id: 'a', name: 'A', validFrom: '2026-02-01', validTo: '2026-07-31' }),
      profileWith({ id: 'b', name: 'B', validFrom: '2026-07-01', validTo: '2026-12-31' }),
    ])
    expect(warnings.some((w) => w.includes('überlappen'))).toBe(true)
  })

  it('reports gaps', () => {
    const warnings = checkProfiles([
      profileWith({ id: 'a', name: 'A', validFrom: '2026-02-01', validTo: '2026-07-31' }),
      profileWith({ id: 'b', name: 'B', validFrom: '2026-09-01', validTo: '2026-12-31' }),
    ])
    expect(warnings.some((w) => w.includes('Lücke'))).toBe(true)
  })

  it('reports missing/reversed ranges', () => {
    expect(checkProfiles([profileWith({ validFrom: '' })])[0]).toMatch(/vollständigen/)
    expect(
      checkProfiles([profileWith({ validFrom: '2026-07-31', validTo: '2026-02-02' })])[0]
    ).toMatch(/liegt vor/)
  })

  it('is silent for seamlessly adjacent profiles', () => {
    expect(
      checkProfiles([
        profileWith({ id: 'a', name: 'A', validFrom: '2025-08-01', validTo: '2026-02-01' }),
        profileWith({ id: 'b', name: 'B', validFrom: '2026-02-02', validTo: '2026-07-31' }),
      ])
    ).toEqual([])
  })
})

describe('duplicateProfile / profileForDate', () => {
  it('copies with a new id and a marked name', () => {
    const original = profileWith({})
    const copy = duplicateProfile(original)
    expect(copy.id).not.toBe(original.id)
    expect(copy.name).toBe('Testprofil (Kopie)')
    expect(copy.weekdays).toEqual(original.weekdays)
    expect(copy.weekdays).not.toBe(original.weekdays) // real copy
  })

  it('profileForDate picks the profile by validity range', () => {
    const a = profileWith({ id: 'a', validFrom: '2025-08-01', validTo: '2026-02-01' })
    const b = profileWith({ id: 'b', validFrom: '2026-02-02', validTo: '2026-07-31' })
    expect(profileForDate([a, b], '2026-01-15')).toBe(a)
    expect(profileForDate([a, b], '2026-03-01')).toBe(b)
    expect(profileForDate([a, b], '2026-08-15')).toBeNull()
  })
})

describe('shouldAutoCreate', () => {
  const dataWith = (settings = {}, weekIds = []) => ({
    settings: { autoCreateWeek: true, ...settings },
    weeks: weekIds.map((id) => ({ id, days: [] })),
  })

  it('creates the current week on every work day Mon–Fri', () => {
    // 2026-10-12 is a Monday … 2026-10-16 a Friday
    for (const day of ['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16']) {
      expect(shouldAutoCreate(dataWith(), day)).toBe(true)
    }
  })

  it('does nothing at the weekend (Mon–Fri only, as the user chose)', () => {
    expect(shouldAutoCreate(dataWith(), '2026-10-10')).toBe(false) // Saturday
    expect(shouldAutoCreate(dataWith(), '2026-10-11')).toBe(false) // Sunday
  })

  it('does nothing if the week already exists', () => {
    expect(shouldAutoCreate(dataWith({}, ['2026-10-12']), '2026-10-15')).toBe(false)
    expect(shouldAutoCreate(dataWith({}, ['2026-10-05']), '2026-10-15')).toBe(true)
  })

  it('respects the switch', () => {
    expect(shouldAutoCreate(dataWith({ autoCreateWeek: false }), '2026-10-12')).toBe(false)
  })

  it('stays inside the training period when one is set', () => {
    const settings = { trainingStart: '2025-08-01', trainingEnd: '2028-07-31' }
    expect(shouldAutoCreate(dataWith(settings), '2025-07-31')).toBe(false)
    expect(shouldAutoCreate(dataWith(settings), '2025-08-01')).toBe(true)
    expect(shouldAutoCreate(dataWith(settings), '2028-07-31')).toBe(true)
    expect(shouldAutoCreate(dataWith(settings), '2028-08-01')).toBe(false)
    expect(shouldAutoCreate(dataWith({ trainingStart: '', trainingEnd: '' }), '2030-01-07')).toBe(true)
  })
})
