// Setup wizard logic: suggestions, pre-filled answers, step checks, applying.
import { describe, it, expect } from 'vitest'
import { suggestHalfYear, trainingEndAfter, setupDraft, setupErrors, applySetup, SETUP_STEPS } from './setup.js'
import { seedData, migrateData, validateData } from './model.js'

const TODAY = '2026-10-10'

describe('suggestHalfYear', () => {
  it('August–January is the first half of the school year', () => {
    expect(suggestHalfYear('2026-10-10')).toEqual({
      name: 'Schulhalbjahr 2026/27 · 1',
      validFrom: '2026-08-01',
      validTo: '2027-01-31',
    })
    expect(suggestHalfYear('2026-08-01').name).toBe('Schulhalbjahr 2026/27 · 1')
    expect(suggestHalfYear('2027-01-31')).toEqual({
      name: 'Schulhalbjahr 2026/27 · 1',
      validFrom: '2026-08-01',
      validTo: '2027-01-31',
    })
  })

  it('February–July is the second half', () => {
    expect(suggestHalfYear('2026-02-01')).toEqual({
      name: 'Schulhalbjahr 2025/26 · 2',
      validFrom: '2026-02-01',
      validTo: '2026-07-31',
    })
    expect(suggestHalfYear('2026-07-31').name).toBe('Schulhalbjahr 2025/26 · 2')
  })

  it('handles the century-safe short year (2099/00)', () => {
    expect(suggestHalfYear('2099-09-01').name).toBe('Schulhalbjahr 2099/00 · 1')
  })
})

describe('trainingEndAfter', () => {
  it('ends the day before the anniversary', () => {
    expect(trainingEndAfter('2025-08-01', 36)).toBe('2028-07-31')
    expect(trainingEndAfter('2025-08-01', 42)).toBe('2029-01-31')
    expect(trainingEndAfter('2025-09-01', 30)).toBe('2028-02-29') // leap year
  })

  it('returns "" without a valid start', () => {
    expect(trainingEndAfter('', 36)).toBe('')
    expect(trainingEndAfter(undefined, 36)).toBe('')
    expect(trainingEndAfter('01.08.2025', 36)).toBe('')
  })
})

describe('setupDraft', () => {
  it('a fresh install gets suggestions, not the seed sample profiles', () => {
    const draft = setupDraft(seedData(), TODAY)
    expect(draft.profile.id).toBeNull()
    expect(draft.profile.name).toBe('Schulhalbjahr 2026/27 · 1')
    expect(draft.profile.weekdays.mon).toEqual({ type: 'work', subjects: [] })
    expect(draft.profile.weekdays.sat).toEqual({ type: 'off', subjects: [] })
    expect(draft).toMatchObject({
      trainingStart: '',
      trainingEnd: '',
      state: 'SH',
      webuntisEnabled: false,
      webuntisAddress: '',
      autoCreateWeek: true,
      updateCheck: true,
    })
  })

  it('a re-run shows the current settings and the profile valid today', () => {
    const data = seedData()
    data.settings = {
      ...data.settings,
      setupDone: true,
      trainingStart: '2025-08-01',
      trainingEnd: '2028-07-31',
      webuntis: { enabled: true, host: 'beispiel-bbs.webuntis.com', school: 'Beispiel BBS' },
      updateCheck: false,
    }
    data.profiles[0] = { ...data.profiles[0], validFrom: '2026-08-01', validTo: '2027-01-31', state: 'HH' }
    const draft = setupDraft(data, TODAY)
    expect(draft.profile.id).toBe(data.profiles[0].id)
    expect(draft.profile.weekdays).toEqual(data.profiles[0].weekdays)
    expect(draft.profile.weekdays).not.toBe(data.profiles[0].weekdays) // a copy
    expect(draft).toMatchObject({
      trainingStart: '2025-08-01',
      state: 'HH',
      webuntisEnabled: true,
      webuntisAddress: 'https://beispiel-bbs.webuntis.com/WebUntis/?school=Beispiel%20BBS',
      updateCheck: false,
    })
  })
})

describe('setupErrors', () => {
  const answers = () => setupDraft(seedData(), TODAY)

  it('lets the optional steps pass', () => {
    for (const step of SETUP_STEPS) expect(setupErrors(step, answers())).toEqual([])
  })

  it('training: end after start, valid dates', () => {
    expect(setupErrors('training', { ...answers(), trainingStart: '2025-08-01', trainingEnd: '2025-08-01' })).toHaveLength(1)
    expect(setupErrors('training', { ...answers(), trainingStart: 'x' })).toHaveLength(1)
    expect(setupErrors('training', { ...answers(), trainingStart: '2025-08-01' })).toEqual([])
  })

  it('half-year: name, range and at least one active day', () => {
    const a = answers()
    expect(setupErrors('halfYear', { ...a, profile: { ...a.profile, name: ' ' } })).toHaveLength(1)
    expect(setupErrors('halfYear', { ...a, profile: { ...a.profile, validTo: '' } })).toHaveLength(1)
    expect(setupErrors('halfYear', { ...a, profile: { ...a.profile, validTo: '2026-07-01' } })).toHaveLength(1)
    const allOff = Object.fromEntries(Object.keys(a.profile.weekdays).map((k) => [k, { type: 'off', subjects: [] }]))
    expect(setupErrors('halfYear', { ...a, profile: { ...a.profile, weekdays: allOff } })).toHaveLength(1)
  })

  it('webuntis: the address must parse when WebUntis is on', () => {
    expect(setupErrors('webuntis', { ...answers(), webuntisEnabled: true, webuntisAddress: '' })).toHaveLength(1)
    expect(setupErrors('webuntis', { ...answers(), webuntisEnabled: true, webuntisAddress: 'https://evil.io' })).toHaveLength(1)
    expect(setupErrors('webuntis', { ...answers(), webuntisEnabled: true, webuntisAddress: 'nessa.webuntis.com' })).toEqual([])
    expect(setupErrors('webuntis', { ...answers(), webuntisEnabled: false, webuntisAddress: 'x' })).toEqual([])
  })
})

describe('applySetup', () => {
  const filled = (data = seedData()) => {
    const a = setupDraft(data, TODAY)
    a.trainingStart = '2025-08-01'
    a.trainingEnd = '2028-07-31'
    a.state = 'NI'
    a.profile.weekdays.tue = { type: 'school', subjects: [' LF07 ', '', 'Englisch'] }
    a.profile.weekdays.wed = { type: 'work', subjects: ['vergessen'] }
    a.webuntisEnabled = true
    a.webuntisAddress = 'https://beispiel-bbs.webuntis.com/WebUntis/?school=beispiel-bbs#/basic/login'
    a.updateCheck = false
    return a
  }

  it('fresh install: replaces the sample profiles and fills every setting', () => {
    const result = applySetup(seedData(), filled())
    expect(result.profiles).toHaveLength(1)
    const [profile] = result.profiles
    expect(profile).toMatchObject({
      name: 'Schulhalbjahr 2026/27 · 1',
      state: 'NI',
      validFrom: '2026-08-01',
      validTo: '2027-01-31',
      defaultBulletCount: 1,
      webuntisSubjects: {},
    })
    expect(profile.id).toMatch(/^profile-/)
    expect(profile.weekdays.tue).toEqual({ type: 'school', subjects: ['LF07', 'Englisch'] })
    expect(profile.weekdays.wed).toEqual({ type: 'work', subjects: [] }) // subjects only on school days
    expect(result.settings).toMatchObject({
      trainingStart: '2025-08-01',
      trainingEnd: '2028-07-31',
      webuntis: { enabled: true, host: 'beispiel-bbs.webuntis.com', school: 'beispiel-bbs' },
      autoCreateWeek: true,
      updateCheck: false,
      setupDone: true,
    })
    // the result is a valid record that survives a reload
    expect(() => validateData(migrateData(JSON.parse(JSON.stringify(result))))).not.toThrow()
  })

  it('re-run: edits the pre-filled profile in place and keeps the others', () => {
    const data = seedData()
    data.settings.setupDone = true
    data.profiles[0] = { ...data.profiles[0], validFrom: '2026-08-01', validTo: '2027-01-31', defaultBulletCount: 3, webuntisSubjects: { kom: 'Kommunikation' } }
    const result = applySetup(data, filled(data))
    expect(result.profiles).toHaveLength(2)
    expect(result.profiles[0]).toMatchObject({ id: data.profiles[0].id, state: 'NI', defaultBulletCount: 3, webuntisSubjects: { kom: 'Kommunikation' } })
    expect(result.profiles[1]).toBe(data.profiles[1])
  })

  it('re-run without a profile for today, or with weeks: adds the half-year in front', () => {
    const data = seedData()
    data.settings.setupDone = true
    const result = applySetup(data, filled(data))
    expect(result.profiles).toHaveLength(3)
    expect(result.profiles[0].name).toBe('Schulhalbjahr 2026/27 · 1')
    const withWeeks = { ...seedData(), weeks: [{ id: '2026-09-07', status: 'done', instructions: '', days: [] }] }
    expect(applySetup(withWeeks, filled(withWeeks)).profiles).toHaveLength(3)
  })

  it('WebUntis off keeps a stored address but switches it off', () => {
    const data = seedData()
    data.settings.webuntis = { enabled: true, host: 'beispiel-bbs.webuntis.com', school: 'x' }
    const answers = { ...filled(data), webuntisEnabled: false }
    expect(applySetup(data, answers).settings.webuntis).toEqual({ enabled: false, host: 'beispiel-bbs.webuntis.com', school: 'x' })
    expect(applySetup(seedData(), { ...filled(), webuntisEnabled: false }).settings.webuntis)
      .toEqual({ enabled: false, host: '', school: '' })
  })
})
