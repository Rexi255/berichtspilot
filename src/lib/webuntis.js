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
