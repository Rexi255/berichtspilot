// WebUntis week (trimmed shape from `webuntis:week`, see electron/webuntis.js)
// → school days the way the week editor needs them: one entry per subject and
// day, in timetable order, with the de-duplicated lesson topics ("Lehrstoff").
// Pure and defensive: the input comes from a remote server.

const CANCELLED = 'CANCELLED'

const clean = (s) => (typeof s === 'string' ? s.replace(/\s+/g, ' ').trim() : '')

/**
 * `[{ date, holiday, lessons: [{ start, end, status, subjectShort, subjectLong, topics }] }]`
 * → `[{ date, schoolBreak, subjects: [{ short, long, topics }], cancelledSubjects }]`,
 * sorted by date.
 *
 * - Cancelled lessons are dropped; a subject whose lessons were *all* cancelled
 *   that day is listed in `cancelledSubjects` (for the import preview).
 * - All lessons of one subject on a day are merged (double periods, or the same
 *   subject twice) — the record lists each subject once per day.
 * - A `holiday` day (WebUntis back entry `HOLIDAY`) is a school break: no subjects.
 */
export function schoolDaysFromWebuntis(days) {
  if (!Array.isArray(days)) return []
  return days
    .filter((d) => d && typeof d.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d.date))
    .map((d) => {
      if (d.holiday === true) return { date: d.date, schoolBreak: true, subjects: [], cancelledSubjects: [] }

      const lessons = (Array.isArray(d.lessons) ? d.lessons : [])
        .filter((l) => l && (clean(l.subjectShort) || clean(l.subjectLong)))
        // Stable sort: lessons without a time keep their position
        .map((l, i) => ({ l, i }))
        .sort((a, b) => clean(a.l.start).localeCompare(clean(b.l.start)) || a.i - b.i)
        .map(({ l }) => l)

      const bySubject = new Map()
      const cancelled = []
      for (const l of lessons) {
        const short = clean(l.subjectShort) || clean(l.subjectLong)
        const key = short.toLowerCase()
        if (l.status === CANCELLED) {
          if (!cancelled.some((c) => c.toLowerCase() === key)) cancelled.push(short)
          continue
        }
        if (!bySubject.has(key)) bySubject.set(key, { short, long: clean(l.subjectLong), topics: [] })
        const subject = bySubject.get(key)
        for (const t of Array.isArray(l.topics) ? l.topics : []) {
          const topic = clean(t)
          if (topic && !subject.topics.some((x) => x.toLowerCase() === topic.toLowerCase())) subject.topics.push(topic)
        }
      }
      const cancelledSubjects = cancelled.filter((c) => !bySubject.has(c.toLowerCase()))
      return { date: d.date, schoolBreak: false, subjects: [...bySubject.values()], cancelledSubjects }
    })
    .sort((a, b) => a.date.localeCompare(b.date))
}

// ---------------------------------------------------------------------------
// Subject mapping WebUntis → profile (step 4.5b)
// ---------------------------------------------------------------------------

/**
 * Comparison key for subject names: case, spaces and leading zeros don't matter
 * ("LF 07" = "lf7"). WebUntis mixes cases (`LF07`, `kom`, `wipo`).
 */
export const subjectKey = (name) =>
  clean(name)
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/\d+/g, (n) => n.replace(/^0+(?=\d)/, ''))

/** Unique subject labels of the profile's school weekdays, in weekday order. */
export function profileSubjectLabels(profile) {
  const labels = []
  for (const day of Object.values(profile?.weekdays ?? {})) {
    if (day?.type !== 'school') continue
    for (const label of Array.isArray(day.subjects) ? day.subjects : []) {
      if (clean(label) && !labels.some((l) => subjectKey(l) === subjectKey(label))) labels.push(label)
    }
  }
  return labels
}

/** Saved mapping for a WebUntis short name: label, '' (= ignore) or undefined. */
export function lookupMapping(map, short) {
  const key = subjectKey(short)
  if (!key || !map || typeof map !== 'object') return undefined
  const hit = Object.entries(map).find(([k, v]) => subjectKey(k) === key && typeof v === 'string')
  return hit?.[1]
}

/**
 * Save `short → label` (`''` = ignore, `null` = remove) and drop spelling
 * variants of the same key, so one WebUntis subject has exactly one entry.
 */
export function setMapping(map, short, label) {
  const key = subjectKey(short)
  const rest = Object.fromEntries(Object.entries(map ?? {}).filter(([k]) => subjectKey(k) !== key))
  if (!key || label === null || label === undefined) return rest
  return { ...rest, [clean(short)]: clean(label) }
}

/**
 * School days from schoolDaysFromWebuntis() → profile subject labels.
 * Per WebUntis subject: a saved mapping (`profile.webuntisSubjects`) wins; `''`
 * there means "ignore" (e.g. a support-teacher entry). Otherwise the short or
 * long name must match a subject label of the profile's school days
 * (subjectKey). Anything else lands in `unmapped` so the UI can ask once.
 * Two WebUntis subjects mapped to one label are merged (topics de-duplicated).
 *
 * → `[{ date, schoolBreak, cancelledSubjects, subjects: [{ label, topics, from: [short] }],
 *      ignored: [short], unmapped: [{ short, long, topics }] }]`
 */
export function mapSubjects(schoolDays, profile) {
  const labels = new Map()
  for (const label of profileSubjectLabels(profile)) labels.set(subjectKey(label), label)
  const saved = profile?.webuntisSubjects

  return (Array.isArray(schoolDays) ? schoolDays : []).map((day) => {
    const subjects = new Map()
    const ignored = []
    const unmapped = []
    for (const s of day.subjects ?? []) {
      const explicit = lookupMapping(saved, s.short)
      if (explicit === '') {
        ignored.push(s.short)
        continue
      }
      const label = clean(explicit) || labels.get(subjectKey(s.short)) || labels.get(subjectKey(s.long))
      if (!label) {
        unmapped.push(s)
        continue
      }
      const key = subjectKey(label)
      if (!subjects.has(key)) subjects.set(key, { label, topics: [], from: [] })
      const target = subjects.get(key)
      target.from.push(s.short)
      for (const t of s.topics) {
        if (!target.topics.some((x) => x.toLowerCase() === t.toLowerCase())) target.topics.push(t)
      }
    }
    return { ...day, subjects: [...subjects.values()], ignored, unmapped }
  })
}

/** Unique unmapped WebUntis subjects of a mapped week (for "Fach zuordnen …"). */
export function unmappedSubjects(mappedDays) {
  const seen = new Map()
  for (const day of mappedDays ?? []) {
    for (const s of day.unmapped ?? []) {
      if (!seen.has(subjectKey(s.short))) seen.set(subjectKey(s.short), { short: s.short, long: s.long })
    }
  }
  return [...seen.values()]
}

// ---------------------------------------------------------------------------
// Fill a week from WebUntis (step 4.6)
// ---------------------------------------------------------------------------

const isBlank = (bullets) => (Array.isArray(bullets) ? bullets : []).every((b) => !clean(b))
const hasLessons = (m) =>
  [m.subjects, m.unmapped, m.ignored, m.cancelledSubjects].some((l) => Array.isArray(l) && l.length > 0)

/**
 * Put the mapped WebUntis subjects (mapSubjects()) into a week — conservatively:
 *
 * - Only days that are school days with status `normal` in the week are
 *   touched. WebUntis never turns a work day into a school day (work days come
 *   back as days without lessons) and never overrides holiday/vacation/sick.
 * - Per subject: an existing entry with the same label (subjectKey) gets the
 *   topics as bullets only if *all* its bullets are empty; a subject the day
 *   doesn't list yet is appended. Written text is never overwritten.
 * - A WebUntis school break (`schoolBreak`) is only reported.
 *
 * The UI unticks subjects by filtering `mappedDays` before calling this.
 *
 * → `{ week, count, changes: [{ date, skipped, subjects: [{ label, topics, from, result }],
 *      cancelledSubjects, ignored, unmapped }] }`
 *   `skipped`: null | 'notSchoolDay' | 'status' | 'schoolBreak';
 *   `result`: 'filled' | 'added' | 'kept' (has text) | 'noTopics' (nothing to fill);
 *   `count`: subjects filled or added. Unchanged week ⇒ the same `week` object.
 */
export function fillWeekFromWebuntis(week, mappedDays) {
  const byDate = new Map((Array.isArray(mappedDays) ? mappedDays : []).map((m) => [m?.date, m]))
  const changes = []
  let count = 0

  const days = (week?.days ?? []).map((day) => {
    const m = byDate.get(day.date)
    if (!m) return day
    const report = {
      date: day.date,
      skipped: null,
      subjects: [],
      cancelledSubjects: m.cancelledSubjects ?? [],
      ignored: m.ignored ?? [],
      unmapped: m.unmapped ?? [],
    }
    const mapped = (Array.isArray(m.subjects) ? m.subjects : []).filter((s) => s && clean(s.label))
    const preview = (result) => mapped.map((s) => ({ label: s.label, topics: s.topics ?? [], from: s.from ?? [], result }))

    if (day.type !== 'school') {
      // A work day without lessons is the normal case — nothing to report
      if (hasLessons(m)) changes.push({ ...report, skipped: 'notSchoolDay', subjects: preview(null) })
      return day
    }
    if (day.status !== 'normal') {
      changes.push({ ...report, skipped: 'status', subjects: preview(null) })
      return day
    }
    if (m.schoolBreak) {
      changes.push({ ...report, skipped: 'schoolBreak' })
      return day
    }

    let subjects = Array.isArray(day.subjects) ? day.subjects : []
    let changed = false
    for (const s of mapped) {
      const topics = (Array.isArray(s.topics) ? s.topics : []).map(clean).filter(Boolean)
      const entry = { label: s.label, topics, from: s.from ?? [], result: null }
      const i = subjects.findIndex((x) => subjectKey(x?.label) === subjectKey(s.label))
      if (i === -1) {
        subjects = [...subjects, { label: s.label, bullets: topics.length ? topics : [''] }]
        entry.result = 'added'
      } else if (!isBlank(subjects[i].bullets)) {
        entry.result = 'kept'
      } else if (!topics.length) {
        entry.result = 'noTopics'
      } else {
        subjects = subjects.map((x, j) => (j === i ? { ...x, bullets: topics } : x))
        entry.result = 'filled'
      }
      if (entry.result === 'added' || entry.result === 'filled') {
        changed = true
        count++
      }
      report.subjects.push(entry)
    }
    changes.push(report)
    return changed ? { ...day, subjects } : day
  })

  return { week: count ? { ...week, days } : week, count, changes }
}

/** Key of one subject on one day — what the import preview ticks/unticks. */
export const pickKey = (date, label) => `${date}|${subjectKey(label)}`

/**
 * Mapped days without the subjects the user unticked in the preview
 * (`unticked`: Set of pickKey()), ready for fillWeekFromWebuntis().
 */
export function dropSubjects(mappedDays, unticked) {
  if (!unticked?.size) return mappedDays
  return (Array.isArray(mappedDays) ? mappedDays : []).map((m) => ({
    ...m,
    subjects: (m.subjects ?? []).filter((s) => !unticked.has(pickKey(m.date, s.label))),
  }))
}

// ---------------------------------------------------------------------------
// WebUntis address (E-019): the user pastes the address of their school's
// WebUntis page; only the host and the school name are kept. The main process
// checks the host again before any request (electron/net.js).
// ---------------------------------------------------------------------------

/** Cloud hosts only: `<name>.webuntis.com` (one label, no port, no credentials). */
export const WEBUNTIS_HOST = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.webuntis\.com$/
const MAX_SCHOOL_LENGTH = 100

/** `school` from the query (`?school=…`) or from the hash route (`#/basic/login?school=…`). */
function schoolOf(url) {
  const fromQuery = url.searchParams.get('school')
  if (fromQuery) return fromQuery
  const hashQuery = url.hash.split('?')[1]
  return hashQuery ? new URLSearchParams(hashQuery).get('school') || '' : ''
}

/**
 * Parse what the user pasted (a full WebUntis address, or just the host) →
 * `{ ok: true, host, school }` or `{ ok: false, error }` (German, for the UI).
 * `school` may be '' — some hosts serve a single school, and the login page
 * then asks for it itself.
 */
export function parseWebuntisAddress(text) {
  const input = typeof text === 'string' ? text.trim() : ''
  if (!input) return { ok: false, error: 'Bitte die Adresse deiner WebUntis-Seite eintragen.' }
  let url
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(input) ? input : `https://${input}`)
  } catch {
    return { ok: false, error: 'Das ist keine gültige Adresse.' }
  }
  if (url.protocol !== 'https:') return { ok: false, error: 'Die Adresse muss mit https:// beginnen.' }
  const host = url.hostname.toLowerCase()
  if (url.username || url.password || url.port !== '' || !WEBUNTIS_HOST.test(host)) {
    return {
      ok: false,
      error: 'Nur WebUntis-Adressen der Form https://<name>.webuntis.com werden unterstützt.',
    }
  }
  const school = clean(schoolOf(url))
  if (school.length > MAX_SCHOOL_LENGTH || [...school].some((c) => c.charCodeAt(0) < 32)) {
    return { ok: false, error: 'Der Schulname in der Adresse ist ungültig.' }
  }
  return { ok: true, host, school }
}

/** Display form of a stored address: `host` or `host · school`. */
export const webuntisAddressLabel = ({ host, school } = {}) =>
  host ? (school ? `${host} · ${school}` : host) : ''
