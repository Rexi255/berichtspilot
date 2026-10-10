// Data model: profiles, weeks, periods, seed data, migration + validation.
// Field names are English since schema v3 (mapping: docs/GLOSSARY.md).
import { WEEKDAY_KEYS, addDays, inRange, formatDE } from './dates.js'
import { holidayOn } from './holidays.js'

export const DAY_STATUSES = ['normal', 'holiday', 'sick', 'vacation']

// Current schema version of daten.json. Older files are upgraded on load/import
// via migrateData(); newer ones are rejected (downgrade protection).
export const DATA_VERSION = 3

let idCounter = 0
export const newId = (prefix) =>
  `${prefix}-${Date.now().toString(36)}-${(idCounter++).toString(36)}`

/** The profile whose validity range covers the date (otherwise null). */
export function profileForDate(profiles, iso) {
  return profiles.find((p) => inRange(iso, p.validFrom, p.validTo)) ?? null
}

/** The first period (vacation/school break) covering the date (otherwise null). */
export function periodFor(iso, periods = []) {
  return periods.find((p) => p.from && p.to && inRange(iso, p.from, p.to)) ?? null
}

/** New, empty period for the profiles view. */
export function newPeriod() {
  return { id: newId('period'), type: 'vacation', label: '', from: '', to: '' }
}

/**
 * Derive a day's status when a week is created. Precedence:
 * holiday > vacation period > normal. School-break periods don't change the
 * status but turn school days into work days (flag `schoolBreak`).
 */
function dayStatusFor(date, state, periods) {
  const holiday = holidayOn(date, state)
  if (holiday) return { status: 'holiday', holidayName: holiday, schoolBreak: false }
  const period = periodFor(date, periods)
  if (period?.type === 'vacation') return { status: 'vacation', holidayName: null, schoolBreak: false }
  return { status: 'normal', holidayName: null, schoolBreak: period?.type === 'schoolBreak' }
}

// Day without any content? (all bullets + subject bullets empty)
const isDayEmpty = (day) =>
  (day.bullets ?? []).every((s) => !s.trim()) &&
  (day.subjects ?? []).every((s) => (s.bullets ?? []).every((b) => !b.trim()))

/**
 * Apply a vacation period retroactively to EXISTING weeks: only days inside the
 * period that are still "normal" and empty become vacation — written content
 * and manually set statuses stay untouched.
 */
export function applyPeriod(weeks, period) {
  if (!period || period.type !== 'vacation' || !period.from || !period.to) return weeks
  return weeks.map((w) => {
    if (!w.days.some((d) => inRange(d.date, period.from, period.to))) return w
    return {
      ...w,
      days: w.days.map((d) =>
        inRange(d.date, period.from, period.to) && d.status === 'normal' && isDayEmpty(d)
          ? { ...d, status: 'vacation' }
          : d
      ),
    }
  })
}

// ---------------------------------------------------------------------------
// Migration, validation, merging (daten.json / import)
// ---------------------------------------------------------------------------

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)

/**
 * Copy an object with renamed keys. Keys not in `map` are kept as they are, so
 * unknown/extra fields survive a migration. Non-objects pass through unchanged
 * (validateData() reports them afterwards).
 */
function renameKeys(obj, map) {
  if (!isObject(obj)) return obj
  const out = {}
  for (const [key, value] of Object.entries(obj)) out[map[key] ?? key] = value
  return out
}

// Map an enum value; unknown values are kept (never silently dropped)
const mapEnum = (value, map) => map[value] ?? value
const mapList = (list, fn) => (Array.isArray(list) ? list.map(fn) : list)

// v2 -> v3 value mappings (German -> English), see docs/GLOSSARY.md
const V3_DAY_TYPE = { betrieb: 'work', schule: 'school', frei: 'off' }
const V3_DAY_STATUS = { feiertag: 'holiday', krank: 'sick', urlaub: 'vacation' }
const V3_WEEK_STATUS = { entwurf: 'draft', fertig: 'done' }
const V3_PERIOD_TYPE = { urlaub: 'vacation', ferien: 'schoolBreak' }
const V3_START_VIEW = { uebersicht: 'overview', profile: 'profiles', einstellungen: 'settings' }
const V3_THEME = {
  nordlicht: 'northern-lights', polarnacht: 'polar-night', waldgruen: 'forest',
  bernstein: 'amber', graphit: 'graphite',
}
const V3_WEEKDAY = { mo: 'mon', di: 'tue', mi: 'wed', do: 'thu', fr: 'fri', sa: 'sat' }

/** Schema v2 (German field names) -> v3 (English field names). */
function migrateV2toV3(d) {
  const out = renameKeys(d, {
    einstellungen: 'settings', zeitraeume: 'periods', profile: 'profiles', wochen: 'weeks',
  })

  if (isObject(out.settings)) {
    const s = renameKeys(out.settings, {
      ausbildungVon: 'trainingStart', ausbildungBis: 'trainingEnd',
      startAnsicht: 'startView', textbausteine: 'snippets',
    })
    if (s.theme !== undefined) s.theme = mapEnum(s.theme, V3_THEME)
    if (s.startView !== undefined) s.startView = mapEnum(s.startView, V3_START_VIEW)
    out.settings = s
  }

  out.periods = mapList(out.periods, (z) => {
    const p = renameKeys(z, { typ: 'type', von: 'from', bis: 'to' })
    if (isObject(p)) p.type = mapEnum(p.type, V3_PERIOD_TYPE)
    return p
  })

  out.profiles = mapList(out.profiles, (raw) => {
    const p = renameKeys(raw, {
      bundesland: 'state', gueltigVon: 'validFrom', gueltigBis: 'validTo',
      standardStichpunkte: 'defaultBulletCount', wochentage: 'weekdays',
    })
    if (isObject(p) && isObject(p.weekdays)) {
      const weekdays = {}
      for (const [key, config] of Object.entries(p.weekdays)) {
        const w = renameKeys(config, { typ: 'type', faecher: 'subjects' })
        if (isObject(w)) w.type = mapEnum(w.type, V3_DAY_TYPE)
        weekdays[V3_WEEKDAY[key] ?? key] = w
      }
      p.weekdays = weekdays
    }
    return p
  })

  out.weeks = mapList(out.weeks, (raw) => {
    const w = renameKeys(raw, { unterweisungen: 'instructions', tage: 'days' })
    if (!isObject(w)) return w
    w.status = mapEnum(w.status, V3_WEEK_STATUS)
    w.days = mapList(w.days, (rawDay) => {
      const day = renameKeys(rawDay, {
        datum: 'date', typ: 'type', feiertagName: 'holidayName',
        stichpunkte: 'bullets', faecher: 'subjects',
      })
      if (!isObject(day)) return day
      day.type = mapEnum(day.type, V3_DAY_TYPE)
      day.status = mapEnum(day.status, V3_DAY_STATUS)
      day.subjects = mapList(day.subjects, (s) => renameKeys(s, { punkte: 'bullets' }))
      return day
    })
    return w
  })

  out.version = 3
  return out
}

/**
 * Upgrade older daten.json files to the current schema version.
 * Throws for a file from a NEWER app version (downgrade protection).
 */
export function migrateData(raw) {
  if (!isObject(raw)) throw new Error('Die Datei enthält kein Datenobjekt.')
  let d = structuredClone(raw)
  d.version = typeof d.version === 'number' ? d.version : 1
  if (d.version > DATA_VERSION) {
    throw new Error('Die Daten stammen aus einer neueren Version von Berichtspilot.')
  }
  if (d.version < 2) {
    // v1 -> v2: add periods + new settings fields (still German names)
    d.zeitraeume = []
    d.einstellungen = { startAnsicht: 'uebersicht', textbausteine: [], ...(d.einstellungen ?? {}) }
    d.version = 2
  }
  if (d.version < 3) d = migrateV2toV3(d)

  // Defensive defaults in case single fields are missing (e.g. hand-edited file)
  d.periods ??= []
  d.settings ??= {}
  d.settings.startView ??= 'overview'
  d.settings.snippets ??= []
  return d
}

const IS_ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/**
 * Structural check of (already migrated) data — throws with a readable German
 * message before a broken import can replace the user's own data.
 */
export function validateData(d) {
  const fail = (text) => {
    throw new Error(text)
  }
  if (!isObject(d)) fail('Die Datei enthält kein Datenobjekt.')
  if (typeof d.version === 'number' && d.version > DATA_VERSION) {
    fail('Die Datei stammt aus einer neueren Version von Berichtspilot.')
  }
  if (!Array.isArray(d.profiles) || !Array.isArray(d.weeks)) {
    fail('Der Datei fehlen die Listen der Profile oder Wochen.')
  }
  for (const p of d.profiles) {
    if (!isObject(p) || typeof p.id !== 'string' || typeof p.name !== 'string' || !isObject(p.weekdays)) {
      fail('Ein Profil in der Datei ist unvollständig (id, Name oder Wochentage fehlen).')
    }
  }
  for (const w of d.weeks) {
    if (!isObject(w) || !IS_ISO_DATE.test(w.id ?? '') || !Array.isArray(w.days)) {
      fail('Eine Woche in der Datei ist unvollständig (id muss ein Datum sein, Tage eine Liste).')
    }
    for (const day of w.days) {
      if (!isObject(day) || !IS_ISO_DATE.test(day.date ?? '') ||
          !Array.isArray(day.bullets ?? []) || !Array.isArray(day.subjects ?? [])) {
        fail(`Die Woche ab ${w.id} enthält einen unvollständigen Tag.`)
      }
    }
  }
  if (d.periods !== undefined && !Array.isArray(d.periods)) {
    fail('Die Zeiträume müssen eine Liste sein.')
  }
  return d
}

/**
 * Merge an import instead of replacing: adds only weeks, profiles and periods
 * that don't exist yet (by id) — existing entries stay untouched.
 */
export function mergeData(current, imported) {
  const onlyNew = (existing, candidates = []) => {
    const ids = new Set(existing.map((e) => e.id))
    return candidates.filter((e) => !ids.has(e.id))
  }
  return {
    ...current,
    profiles: [...current.profiles, ...onlyNew(current.profiles, imported.profiles)],
    periods: [...current.periods, ...onlyNew(current.periods, imported.periods)],
    weeks: [...current.weeks, ...onlyNew(current.weeks, imported.weeks)].sort((a, b) =>
      a.id < b.id ? -1 : 1
    ),
  }
}

// Fallback if no profile covers the date: Mon–Fri work
const FALLBACK_WEEKDAYS = Object.fromEntries(
  WEEKDAY_KEYS.map((k) => [k, { type: k === 'sat' ? 'off' : 'work', subjects: [] }])
)

// Profile selection uses the middle of the week (Wednesday) — robust if a
// half-year starts in the middle of a week.
function midweek(mondayISO) {
  return addDays(mondayISO, 2)
}

/**
 * Build a new training week starting Monday `mondayISO`. Structure (day types,
 * subjects, number of starter bullets) comes from the matching profile;
 * holidays and vacation/school-break periods are applied right away: vacation
 * sets the status, school breaks turn school days into work days.
 */
export function newWeek(mondayISO, profiles, periods = []) {
  const profile = profileForDate(profiles, midweek(mondayISO))
  const weekdays = profile?.weekdays ?? FALLBACK_WEEKDAYS
  const count = Math.max(1, profile?.defaultBulletCount ?? 2)
  const state = profile?.state ?? 'SH'

  const days = []
  WEEKDAY_KEYS.forEach((key, i) => {
    const config = weekdays[key]
    if (!config || config.type === 'off') return
    const date = addDays(mondayISO, i)
    const { status, holidayName, schoolBreak } = dayStatusFor(date, state, periods)
    const type = config.type === 'school' && schoolBreak ? 'work' : config.type
    days.push({
      date,
      type,
      status,
      holidayName,
      bullets: Array.from({ length: count }, () => ''),
      subjects: type === 'school' ? (config.subjects ?? []).map((label) => ({ label, bullets: [''] })) : [],
    })
  })

  return { id: mondayISO, status: 'draft', instructions: '', days }
}

/**
 * Empty copy of an existing week for a new Monday: keeps day types and subject
 * labels, clears all bullets. Holidays are detected fresh for the new dates.
 */
export function weekFromTemplate(mondayISO, template, profiles, periods = []) {
  const profile = profileForDate(profiles, midweek(mondayISO))
  const state = profile?.state ?? 'SH'
  const count = Math.max(1, profile?.defaultBulletCount ?? 2)

  const days = template.days.map((old) => {
    // Keep the old day's weekday offset (Mon = 0 … Sat = 5)
    const offset = Math.round(
      (new Date(old.date).getTime() - new Date(template.id).getTime()) / 86400000
    )
    const date = addDays(mondayISO, offset)
    const { status, holidayName, schoolBreak } = dayStatusFor(date, state, periods)
    const type = old.type === 'school' && schoolBreak ? 'work' : old.type
    return {
      date,
      type,
      status,
      holidayName,
      bullets: Array.from({ length: count }, () => ''),
      subjects: type === 'school' ? old.subjects.map((s) => ({ label: s.label, bullets: [''] })) : [],
    }
  })

  return { id: mondayISO, status: 'draft', instructions: '', days }
}

/** Initial data on the very first start (the user's real half-years as a template). */
export function seedData() {
  return {
    version: DATA_VERSION,
    settings: {
      trainingStart: '',
      trainingEnd: '',
      theme: 'northern-lights',
      startView: 'overview',
      snippets: [],
    },
    periods: [],
    profiles: [
      {
        id: newId('profile'),
        name: 'Schulhalbjahr 2025/26 · 2',
        state: 'SH',
        validFrom: '2026-02-02',
        validTo: '2026-07-31',
        defaultBulletCount: 2,
        weekdays: {
          mon: { type: 'school', subjects: ['LF02', 'LF03', 'Englisch', 'WiPo'] },
          tue: { type: 'school', subjects: ['LF04', 'LF05'] },
          wed: { type: 'work', subjects: [] },
          thu: { type: 'work', subjects: [] },
          fri: { type: 'work', subjects: [] },
          sat: { type: 'off', subjects: [] },
        },
      },
      {
        id: newId('profile'),
        name: 'Schulhalbjahr 2025/26 · 1',
        state: 'SH',
        validFrom: '2025-08-01',
        validTo: '2026-02-01',
        defaultBulletCount: 2,
        weekdays: {
          mon: { type: 'school', subjects: ['LF01', 'LF02', 'LF03', 'WiPo'] },
          tue: { type: 'work', subjects: [] },
          wed: { type: 'work', subjects: [] },
          thu: { type: 'work', subjects: [] },
          fri: { type: 'work', subjects: [] },
          sat: { type: 'off', subjects: [] },
        },
      },
    ],
    weeks: [],
  }
}

/** Copy of a profile with a new id — for the half-year switch. */
export function duplicateProfile(profile) {
  const copy = structuredClone(profile)
  copy.id = newId('profile')
  copy.name = `${profile.name} (Kopie)`
  return copy
}

/**
 * Check the profiles' validity ranges: incomplete/reversed ranges, overlaps
 * (profile selection becomes ambiguous) and gaps (weeks without a profile fall
 * back to Mon–Fri work). Returns German warning texts for the UI.
 */
export function checkProfiles(profiles) {
  const warnings = []
  for (const p of profiles) {
    if (!p.validFrom || !p.validTo) {
      warnings.push(`„${p.name}" hat keinen vollständigen Gültigkeitszeitraum.`)
    } else if (p.validTo < p.validFrom) {
      warnings.push(`„${p.name}": „Gültig bis" liegt vor „Gültig von".`)
    }
  }

  const sorted = profiles
    .filter((p) => p.validFrom && p.validTo && p.validTo >= p.validFrom)
    .sort((a, b) => (a.validFrom < b.validFrom ? -1 : 1))

  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const a = sorted[i]
      const b = sorted[j]
      if (b.validFrom <= a.validTo) {
        const end = a.validTo < b.validTo ? a.validTo : b.validTo
        warnings.push(
          `„${a.name}" und „${b.name}" überlappen sich (${formatDE(b.validFrom)} – ${formatDE(end)}) — es gewinnt das zuerst gelistete Profil.`
        )
      }
    }
  }

  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i]
    const b = sorted[i + 1]
    const gapStart = addDays(a.validTo, 1)
    if (gapStart < b.validFrom) {
      warnings.push(
        `Lücke zwischen „${a.name}" und „${b.name}" (${formatDE(gapStart)} – ${formatDE(addDays(b.validFrom, -1))}) — Wochen dort nutzen den Standard Mo–Fr Betrieb.`
      )
    }
  }
  return warnings
}

/** New, empty profile (for the profiles view). */
export function newProfile() {
  return {
    id: newId('profile'),
    name: 'Neues Halbjahr',
    state: 'SH',
    validFrom: '',
    validTo: '',
    defaultBulletCount: 2,
    weekdays: {
      mon: { type: 'work', subjects: [] },
      tue: { type: 'work', subjects: [] },
      wed: { type: 'work', subjects: [] },
      thu: { type: 'work', subjects: [] },
      fri: { type: 'work', subjects: [] },
      sat: { type: 'off', subjects: [] },
    },
  }
}
