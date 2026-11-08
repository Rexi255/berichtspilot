// "Aus WebUntis füllen" inside the week editor (step 4.6b, DECISIONS E-013):
// fetch the week from WebUntis, map the subjects onto the profile, show what
// would change per day and let the user untick wrong lessons before applying.
// The merge rules live in src/lib/webuntis.js — written text is never replaced.
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  CloudArrowDownIcon,
  XIcon,
  CheckIcon,
  CircleNotchIcon,
  ArrowClockwiseIcon,
  SignInIcon,
} from '@phosphor-icons/react'
import { useStore, api } from '../store.jsx'
import { Button, Card, IconButton, Notice, Select, cx } from '../ui/basics.jsx'
import { weekdayName, formatDE } from '../lib/dates.js'
import {
  schoolDaysFromWebuntis,
  mapSubjects,
  unmappedSubjects,
  profileSubjectLabels,
  fillWeekFromWebuntis,
  subjectKey,
  pickKey,
  dropSubjects,
} from '../lib/webuntis.js'

// Select value for "ignore" (the stored mapping is '')
const IGNORE = '__ignore__'

// What happens to a subject (fillWeekFromWebuntis() result)
const RESULT_TEXT = {
  filled: 'wird gefüllt',
  added: 'neues Fach',
  kept: 'hat schon Text',
  noTopics: 'kein Lehrstoff',
}
const PICKABLE = new Set(['filled', 'added'])

const STATUS_TEXT = { holiday: 'Feiertag', sick: 'Krank', vacation: 'Urlaub' }

// Why a day stays untouched (fillWeekFromWebuntis() `skipped`)
const skipText = (change, day) =>
  ({
    schoolBreak: 'Ferien laut WebUntis, bleibt unverändert',
    status: `${STATUS_TEXT[day?.status] ?? 'Sonderstatus'}, bleibt unverändert`,
    notSchoolDay: 'Betriebstag im Bericht, bleibt unverändert',
  })[change.skipped]

const subjectCount = (n) => (n === 1 ? '1 Fach' : `${n} Fächer`)

export default function WebuntisPanel({ monday, week, profile, onApply, onClose }) {
  const { setWebuntisSubject } = useStore()
  // { state: 'loading' | 'error' | 'ready', schoolDays?, code?, error? }
  const [load, setLoad] = useState({ state: 'loading' })
  const [attempt, setAttempt] = useState(0) // bumped to fetch again
  const [loggingIn, setLoggingIn] = useState(false)
  const [unticked, setUnticked] = useState(() => new Set())
  const alive = useRef(true)

  useEffect(() => {
    alive.current = true
    let current = true
    const failed = (res) => ({ state: 'error', code: res?.code, error: res?.error || 'WebUntis konnte nicht abgefragt werden.' })
    api.webuntisWeek(monday).then(
      (res) => current && setLoad(res.ok ? { state: 'ready', schoolDays: schoolDaysFromWebuntis(res.days) } : failed(res)),
      () => current && setLoad(failed())
    )
    return () => {
      current = false
      alive.current = false
    }
  }, [monday, attempt])

  const fetchWeek = () => {
    setLoad({ state: 'loading' })
    setAttempt((n) => n + 1)
  }

  const login = async () => {
    setLoggingIn(true)
    try {
      const res = await api.webuntisLogin()
      if (!alive.current) return
      if (res.loggedIn) fetchWeek()
      else if (res.error) setLoad({ state: 'error', code: 'auth', error: res.error })
    } finally {
      if (alive.current) setLoggingIn(false)
    }
  }

  // Re-mapped on every profile change, so "zuordnen" works without a new fetch
  const mapped = useMemo(
    () => (load.state === 'ready' ? mapSubjects(load.schoolDays, profile) : []),
    [load, profile]
  )
  const changes = useMemo(() => fillWeekFromWebuntis(week, mapped).changes, [week, mapped])
  // Only ask about subjects on days that would actually be filled
  const unmapped = useMemo(() => {
    const fillable = new Set(changes.filter((c) => !c.skipped).map((c) => c.date))
    return unmappedSubjects(mapped.filter((m) => fillable.has(m.date)))
  }, [mapped, changes])
  const labels = useMemo(() => profileSubjectLabels(profile), [profile])

  const picked = changes.flatMap((c) =>
    c.subjects.filter((s) => PICKABLE.has(s.result) && !unticked.has(pickKey(c.date, s.label)))
  ).length

  const toggle = (key) =>
    setUnticked((s) => {
      const next = new Set(s)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  const assign = (short, value) => {
    if (!profile || !value) return
    setWebuntisSubject(profile.id, short, value === IGNORE ? '' : value)
  }

  return (
    <Card className="shrink-0">
      <div className="flex items-center gap-2 border-b border-line py-2 pl-4 pr-2">
        <CloudArrowDownIcon size={16} className="text-ink-2" />
        <h2 className="mr-auto text-title font-medium text-ink">Aus WebUntis füllen</h2>
        <IconButton label="Neu laden" onClick={fetchWeek} disabled={load.state === 'loading' || loggingIn}>
          <ArrowClockwiseIcon size={16} />
        </IconButton>
        <IconButton label="Schließen" side="bottom-end" onClick={onClose}>
          <XIcon size={16} />
        </IconButton>
      </div>

      {load.state === 'loading' ? (
        <p className="flex items-center gap-2 px-4 py-4 text-body text-ink-2">
          <CircleNotchIcon size={14} className="animate-spin" /> Stundenplan und Lehrstoff werden geladen …
        </p>
      ) : load.state === 'error' ? (
        <div className="flex flex-col items-start gap-2.5 px-4 py-4">
          <p className="text-body text-missing">{load.error}</p>
          {load.code === 'auth' ? (
            <Button size="sm" variant="primary" onClick={login} disabled={loggingIn}>
              {loggingIn ? (
                <>
                  <CircleNotchIcon size={14} className="animate-spin" /> Anmeldefenster offen …
                </>
              ) : (
                <>
                  <SignInIcon size={14} /> Anmelden
                </>
              )}
            </Button>
          ) : (
            // switched off / no address: only Settings can fix that — the text says so
            load.code !== 'disabled' && load.code !== 'no-server' && (
              <Button size="sm" onClick={fetchWeek}>
                <ArrowClockwiseIcon size={14} /> Erneut versuchen
              </Button>
            )
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3 px-4 py-4">
          {unmapped.length > 0 && (
            <Notice>
              <p>
                {profile
                  ? 'Unbekannte Fächer aus WebUntis: einmal zuordnen, die App merkt es sich im Profil.'
                  : 'Kein Profil für diese Woche, Fächer aus WebUntis können nicht zugeordnet werden.'}
              </p>
              {profile && (
                <div className="mt-2 flex flex-col gap-1.5">
                  {unmapped.map((s) => (
                    <div key={subjectKey(s.short)} className="flex items-center gap-2">
                      <span className="w-40 truncate text-body" title={s.long || s.short}>
                        <span className="font-medium text-ink">{s.short}</span>
                        {s.long && s.long !== s.short && <span className="text-ink-2"> · {s.long}</span>}
                      </span>
                      <Select
                        value=""
                        onChange={(e) => assign(s.short, e.target.value)}
                        className="h-7 w-48"
                        aria-label={`Zuordnung für ${s.short}`}
                      >
                        <option value="" disabled>
                          zuordnen …
                        </option>
                        {labels.map((l) => (
                          <option key={l} value={l}>
                            {l}
                          </option>
                        ))}
                        <option value={IGNORE}>ignorieren</option>
                      </Select>
                    </div>
                  ))}
                </div>
              )}
            </Notice>
          )}

          {changes.length === 0 ? (
            <p className="text-body text-ink-2">WebUntis liefert für diese Woche keinen Unterricht.</p>
          ) : (
            changes.map((change) => {
              const day = week.days.find((d) => d.date === change.date)
              const extras = [
                change.cancelledSubjects.length > 0 && `entfallen: ${change.cancelledSubjects.join(', ')}`,
                change.ignored.length > 0 && `ignoriert: ${change.ignored.join(', ')}`,
                change.unmapped.length > 0 && `nicht zugeordnet: ${change.unmapped.map((s) => s.short).join(', ')}`,
              ].filter(Boolean)
              return (
                <div key={change.date} className="flex flex-col gap-1.5">
                  <div className="flex flex-wrap items-baseline gap-x-2 text-body">
                    <span className="font-medium text-ink">
                      {weekdayName(change.date)}, {formatDE(change.date)}
                    </span>
                    {change.skipped && <span className="text-meta text-ink-2">{skipText(change, day)}</span>}
                  </div>

                  {change.skipped
                    ? change.subjects.length > 0 && (
                        <p className="text-meta text-ink-2">
                          Unterricht laut WebUntis: {change.subjects.map((s) => s.label).join(', ')}
                        </p>
                      )
                    : change.subjects.map((s) => {
                        const key = pickKey(change.date, s.label)
                        const pickable = PICKABLE.has(s.result)
                        const on = pickable && !unticked.has(key)
                        const renamed = s.from.filter((f) => subjectKey(f) !== subjectKey(s.label))
                        return (
                          <label
                            key={key}
                            className={cx(
                              'flex gap-2.5 rounded-control border border-line px-3 py-2 transition-colors duration-150',
                              pickable ? 'cursor-pointer' : 'cursor-default',
                              on ? 'bg-surface-2' : 'opacity-60'
                            )}
                          >
                            <input
                              type="checkbox"
                              checked={on}
                              disabled={!pickable}
                              onChange={() => toggle(key)}
                              className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-[var(--color-accent)]"
                            />
                            <div className="min-w-0">
                              <div className="text-body font-medium text-ink">
                                {s.label}
                                {renamed.length > 0 && (
                                  <span className="ml-1.5 font-normal text-ink-2">(WebUntis: {renamed.join(', ')})</span>
                                )}
                                <span className="ml-2 text-meta font-normal text-ink-2">{RESULT_TEXT[s.result]}</span>
                              </div>
                              {s.topics.length > 0 && (
                                <ul className="mt-1 flex flex-col gap-0.5 text-body text-ink">
                                  {s.topics.map((t, i) => (
                                    <li key={i}>
                                      <span className="text-ink-2">- </span>
                                      {t}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          </label>
                        )
                      })}

                  {extras.length > 0 && <p className="text-meta text-ink-2">{extras.join(', ')}</p>}
                </div>
              )
            })
          )}

          <p className="text-meta text-ink-2">
            Nur leere Fächer werden gefüllt, fehlende angehängt, vorhandener Text bleibt unverändert. Falsche
            Stunden im Stundenplan einfach abwählen.
          </p>
          <Button
            variant="primary"
            onClick={() => onApply(dropSubjects(mapped, unticked))}
            disabled={picked === 0}
            className="w-fit"
          >
            <CheckIcon size={16} /> {subjectCount(picked)} übernehmen
          </Button>
        </div>
      )}
    </Card>
  )
}
