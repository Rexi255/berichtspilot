// Setup wizard ("Einrichtung"): suggestions for a fresh install, the answers
// pre-filled from existing data, per-step checks and applying the answers to
// the record. Pure — the wizard UI lives in src/views/SetupWizard.jsx.
import { WEEKDAY_KEYS, parseISO, toISO } from './dates.js'
import { newId, profileForDate } from './model.js'
import { parseWebuntisAddress } from './webuntis.js'

/** Wizard steps in order (ids; the German titles live in the view). */
export const SETUP_STEPS = ['welcome', 'training', 'halfYear', 'webuntis', 'behavior', 'summary']

const IS_ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/**
 * School half-year around `todayISO`: August–January = first half, February–July
 * = second half (a common split — the user can change the dates).
 * → `{ name, validFrom, validTo }`, e.g. "Schulhalbjahr 2026/27 · 1".
 */
export function suggestHalfYear(todayISO) {
  const date = parseISO(todayISO)
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const label = (start, half) => `Schulhalbjahr ${start}/${String(start + 1).slice(-2)} · ${half}`
  if (month >= 8) return { name: label(year, 1), validFrom: `${year}-08-01`, validTo: `${year + 1}-01-31` }
  if (month === 1) return { name: label(year - 1, 1), validFrom: `${year - 1}-08-01`, validTo: `${year}-01-31` }
  return { name: label(year - 1, 2), validFrom: `${year}-02-01`, validTo: `${year}-07-31` }
}

/** Last day of a training of `months` months starting `startISO` (2025-08-01 + 36 → 2028-07-31). */
export function trainingEndAfter(startISO, months) {
  if (!IS_ISO_DATE.test(startISO ?? '')) return ''
  const start = parseISO(startISO)
  return toISO(new Date(start.getFullYear(), start.getMonth() + months, start.getDate() - 1))
}

/** Default week for a new half-year: Mon–Fri at work, Saturday off — school days are picked by the user. */
const defaultWeekdays = () =>
  Object.fromEntries(WEEKDAY_KEYS.map((key) => [key, { type: key === 'sat' ? 'off' : 'work', subjects: [] }]))

const webuntisAddressText = ({ host, school } = {}) =>
  host ? `https://${host}/WebUntis/${school ? `?school=${encodeURIComponent(school)}` : ''}` : ''

/**
 * Answers the wizard starts with. A fresh install gets suggestions; a re-run
 * shows what is set (the profile valid today is edited in place).
 */
export function setupDraft(data, todayISO) {
  const settings = data.settings ?? {}
  const fresh = settings.setupDone === false
  // Fresh: the seed's sample profiles are examples, not the user's half-year
  const current = fresh ? null : profileForDate(data.profiles ?? [], todayISO)
  const suggestion = suggestHalfYear(todayISO)
  return {
    trainingStart: settings.trainingStart ?? '',
    trainingEnd: settings.trainingEnd ?? '',
    state: current?.state ?? data.profiles?.[0]?.state ?? 'SH',
    profile: current
      ? {
          id: current.id,
          name: current.name,
          validFrom: current.validFrom,
          validTo: current.validTo,
          weekdays: structuredClone(current.weekdays),
        }
      : { id: null, ...suggestion, weekdays: defaultWeekdays() },
    webuntisEnabled: settings.webuntis?.enabled === true,
    webuntisAddress: webuntisAddressText(settings.webuntis),
    autoCreateWeek: settings.autoCreateWeek !== false,
    updateCheck: settings.updateCheck !== false,
  }
}

/**
 * German problems that block leaving a step (empty list = fine). Hints that
 * don't block (e.g. a school day without subjects) are left to the view.
 */
export function setupErrors(step, answers) {
  const errors = []
  if (step === 'training') {
    const { trainingStart: start, trainingEnd: end } = answers
    if (start && !IS_ISO_DATE.test(start)) errors.push('Der Ausbildungsbeginn ist kein gültiges Datum.')
    if (end && !IS_ISO_DATE.test(end)) errors.push('Das Ausbildungsende ist kein gültiges Datum.')
    if (start && end && end <= start) errors.push('Das Ausbildungsende muss nach dem Beginn liegen.')
  }
  if (step === 'halfYear') {
    const { name, validFrom, validTo, weekdays } = answers.profile
    if (!name.trim()) errors.push('Bitte gib dem Halbjahr einen Namen.')
    if (!IS_ISO_DATE.test(validFrom ?? '') || !IS_ISO_DATE.test(validTo ?? '')) {
      errors.push('Bitte trag ein, von wann bis wann das Halbjahr gilt.')
    } else if (validTo < validFrom) {
      errors.push('Das Halbjahr endet vor seinem Beginn.')
    }
    if (WEEKDAY_KEYS.every((key) => (weekdays[key]?.type ?? 'off') === 'off')) {
      errors.push('Mindestens ein Tag muss Betrieb oder Schule sein.')
    }
  }
  if (step === 'webuntis' && answers.webuntisEnabled) {
    const parsed = parseWebuntisAddress(answers.webuntisAddress)
    if (!parsed.ok) errors.push(parsed.error)
  }
  return errors
}

/**
 * Apply the answers: training dates, WebUntis switch + address, behavior
 * switches, `setupDone`, and the half-year profile. The profile replaces the
 * one it was pre-filled from; on a fresh install (no weeks yet) it replaces
 * the seed's sample profiles; otherwise it is added in front.
 */
export function applySetup(data, answers) {
  // WebUntis off keeps a stored address (like the switch in Settings)
  const address = answers.webuntisEnabled ? parseWebuntisAddress(answers.webuntisAddress) : null
  const webuntis = address?.ok
    ? { ...data.settings.webuntis, enabled: true, host: address.host, school: address.school }
    : { host: '', school: '', ...data.settings.webuntis, enabled: false }
  const settings = {
    ...data.settings,
    trainingStart: answers.trainingStart,
    trainingEnd: answers.trainingEnd,
    webuntis,
    autoCreateWeek: answers.autoCreateWeek,
    updateCheck: answers.updateCheck,
    setupDone: true,
  }

  const old = data.profiles.find((p) => p.id === answers.profile.id)
  const weekdays = Object.fromEntries(
    WEEKDAY_KEYS.map((key) => {
      const day = answers.profile.weekdays[key] ?? { type: 'off', subjects: [] }
      const subjects = (day.subjects ?? []).map((s) => s.trim()).filter(Boolean)
      return [key, { type: day.type, subjects: day.type === 'school' ? subjects : [] }]
    })
  )
  const profile = {
    ...(old ?? { id: newId('profile'), defaultBulletCount: 2, webuntisSubjects: {} }),
    name: answers.profile.name.trim(),
    state: answers.state,
    validFrom: answers.profile.validFrom,
    validTo: answers.profile.validTo,
    weekdays,
  }

  let profiles
  if (old) profiles = data.profiles.map((p) => (p.id === old.id ? profile : p))
  else if (data.settings.setupDone === false && data.weeks.length === 0) profiles = [profile]
  else profiles = [profile, ...data.profiles]

  return { ...data, settings, profiles }
}
