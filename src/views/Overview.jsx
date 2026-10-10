// Start screen: progress + chronological list of all training weeks,
// including gap detection, filters, full-text search and a year heatmap.
import { useEffect, useMemo, useRef, useState } from 'react'
import Lenis from 'lenis'
import { gsap } from 'gsap'
import { PlusIcon, CopyIcon, CaretRightIcon, MagnifyingGlassIcon, CaretDownIcon } from '@phosphor-icons/react'
import { useStore } from '../store.jsx'
import { Button, Input, Segment, Panel, Pill, SectionTitle, cx } from '../ui/basics.jsx'
import Logo from '../ui/Logo.jsx'
import {
  isoWeek,
  weekRangeLabel,
  mondayOf,
  mondayOfIsoWeek,
  todayISO,
  parseISO,
  addDays,
} from '../lib/dates.js'
import { profileForDate } from '../lib/model.js'

// Count a number up from 0 to the target on mount (GSAP). Returns the ref for
// the target element.
function useCountUp(target, duration = 0.8) {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obj = { v: 0 }
    const t = gsap.to(obj, {
      v: target,
      duration,
      ease: 'power2.out',
      onUpdate: () => {
        el.textContent = String(Math.round(obj.v))
      },
    })
    return () => t.kill()
  }, [target, duration])
  return ref
}

// Base style of a stat tile — "lit from above" like the panels
const TILE =
  'relative overflow-hidden rounded-xl border border-white/[0.06] bg-surface/70 ' +
  'bg-gradient-to-b from-white/[0.035] to-transparent to-[45%] px-4 py-3.5 ' +
  'shadow-[inset_0_1px_0_0_oklch(1_0_0/0.05)]'

function StatTile({ value, label, color = 'text-ink' }) {
  const ref = useCountUp(value)
  return (
    <div className={TILE}>
      <div className={cx('text-[28px] font-semibold leading-none tracking-tight tabular-nums', color)}>
        <span ref={ref}>0</span>
      </div>
      <div className="mt-2 text-[11px] font-medium uppercase tracking-[0.06em] text-ink-3">{label}</div>
    </div>
  )
}

function ProgressTile({ current, total }) {
  const ref = useCountUp(current)
  return (
    <div className={TILE}>
      <div className="flex items-baseline gap-1">
        <span ref={ref} className="text-[28px] font-semibold leading-none tracking-tight text-accent tabular-nums">
          0
        </span>
        <span className="text-[15px] font-medium text-ink-3 tabular-nums">/ {total}</span>
      </div>
      <div className="mt-2 text-[11px] font-medium uppercase tracking-[0.06em] text-ink-3">Ausbildungswoche</div>
      <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-white/[0.07]">
        <div
          className="h-full rounded-full bg-accent/80 transition-[width] duration-700 ease-(--ease-smooth)"
          style={{ width: `${Math.min(100, (current / total) * 100)}%` }}
        />
      </div>
    </div>
  )
}

// Summary of a week's days for the mini preview in the row
function DayDots({ week }) {
  return (
    <div className="flex items-center gap-1">
      {week.days.map((d) => (
        <span
          key={d.date}
          title={`${d.date} · ${d.type}${d.status !== 'normal' ? ` · ${d.status}` : ''}`}
          className={cx(
            'h-1.5 w-3.5 rounded-full',
            d.status === 'holiday' && 'bg-holiday/70',
            d.status === 'sick' && 'bg-sick/70',
            d.status === 'vacation' && 'bg-vacation/70',
            d.status === 'normal' && (d.type === 'school' ? 'bg-accent/80' : 'bg-ink-3/50')
          )}
        />
      ))}
    </div>
  )
}

/* --------------------------- Full-text search --------------------------- */

// Returns a text snippet for the row on a match, otherwise null.
function searchMatch(week, query) {
  const { week: weekNo } = isoWeek(week.id)
  if (`kw ${weekNo}`.includes(query) || week.id.includes(query)) return ''
  if ((week.instructions ?? '').toLowerCase().includes(query)) return week.instructions
  for (const day of week.days) {
    if ((day.holidayName ?? '').toLowerCase().includes(query)) return `Feiertag: ${day.holidayName}`
    if ((day.notes ?? '').toLowerCase().includes(query)) return `Notiz: ${day.notes}`
    for (const b of day.bullets ?? []) {
      if (b.toLowerCase().includes(query)) return b
    }
    for (const subject of day.subjects ?? []) {
      if ((subject.label ?? '').toLowerCase().includes(query)) return subject.label
      for (const b of subject.bullets ?? []) {
        if (b.toLowerCase().includes(query)) return `${subject.label}: ${b}`
      }
    }
  }
  return null
}

/* ------------------------------ Year heatmap ------------------------------ */

const HEAT_COLORS = {
  done: 'bg-accent/90',
  draft: 'bg-draft/80',
  missing: 'bg-sick/45',
  empty: 'bg-white/[0.05]',
}

const HEAT_LABELS = { done: 'Fertig', draft: 'Entwurf', missing: 'Fehlt', empty: '—' }

// One cell per ISO week and year — documented (done/draft), missing (within
// the expected range) or outside the apprenticeship.
function YearHeatmap({ statusByMonday, missingSet, years, openWeek }) {
  return (
    <Panel className="px-4 py-3">
      <div className="flex items-center justify-between">
        <SectionTitle>Jahresübersicht</SectionTitle>
        <div className="flex items-center gap-3">
          {['done', 'draft', 'missing'].map((key) => (
            <span key={key} className="flex items-center gap-1.5 text-[10.5px] text-ink-3">
              <span className={cx('h-2 w-2 rounded-[2px]', HEAT_COLORS[key])} /> {HEAT_LABELS[key]}
            </span>
          ))}
        </div>
      </div>
      <div className="mt-2.5 flex flex-col gap-1.5 overflow-x-auto pb-1">
        {years.map((year) => {
          // number of ISO weeks in the year (52 or 53), via December 28th
          const weekCount = isoWeek(`${year}-12-28`).week
          return (
            <div key={year} className="flex items-center gap-2">
              <span className="w-9 shrink-0 text-[11px] text-ink-3 tabular-nums">{year}</span>
              <div className="flex gap-[3px]">
                {Array.from({ length: weekCount }, (_, i) => {
                  const weekNo = i + 1
                  const monday = mondayOfIsoWeek(year, weekNo)
                  const status = statusByMonday.get(monday)
                  const kind = status ?? (missingSet.has(monday) ? 'missing' : 'empty')
                  return (
                    <button
                      key={weekNo}
                      type="button"
                      onClick={() => openWeek(monday)}
                      title={`KW ${weekNo}/${year} · ${HEAT_LABELS[kind]}`}
                      className={cx(
                        'h-3 w-3 shrink-0 rounded-[3px] transition-transform duration-100 hover:scale-125',
                        HEAT_COLORS[kind]
                      )}
                    />
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </Panel>
  )
}

/* --------------------------------- View --------------------------------- */

export default function Overview({ openWeek }) {
  const { data, createWeek } = useStore()
  const scrollRef = useRef(null)
  const currentMonday = mondayOf(new Date())
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState(() => new Set())

  // Smooth scrolling in the week list (Lenis)
  useEffect(() => {
    const wrapper = scrollRef.current
    if (!wrapper) return
    const lenis = new Lenis({ wrapper, duration: 1.0, smoothWheel: true })
    let raf
    const loop = (t) => {
      lenis.raf(t)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      lenis.destroy()
    }
  }, [])

  // On open, scroll to the current week + fade the rows in softly
  useEffect(() => {
    const wrapper = scrollRef.current
    if (!wrapper) return
    const target = wrapper.querySelector('[data-current="true"]')
    if (target) wrapper.scrollTop = target.offsetTop - wrapper.clientHeight / 2 + 40
    gsap.fromTo(
      wrapper.querySelectorAll('[data-row]'),
      { opacity: 0, y: 6 },
      { opacity: 1, y: 0, duration: 0.3, stagger: 0.015, ease: 'power2.out', clearProps: 'all' }
    )
  }, [])

  const weekIds = useMemo(() => new Set(data.weeks.map((w) => w.id)), [data.weeks])

  // Missing Mondays between the training start (otherwise the first report)
  // and the week BEFORE the current one — the running week and future weeks
  // (even up to the training end) don't count as missing.
  const missing = useMemo(() => {
    const start = data.settings.trainingStart
      ? mondayOf(parseISO(data.settings.trainingStart))
      : data.weeks[0]?.id
    if (!start) return []
    let end = addDays(currentMonday, -7)
    if (data.settings.trainingEnd) {
      const lastWeek = mondayOf(parseISO(data.settings.trainingEnd))
      if (lastWeek < end) end = lastWeek
    }
    const list = []
    for (let m = start; m <= end; m = addDays(m, 7)) {
      if (!weekIds.has(m)) list.push(m)
    }
    return list
  }, [data, weekIds, currentMonday])
  const missingSet = useMemo(() => new Set(missing), [missing])

  const stats = useMemo(() => {
    const weeks = data.weeks
    const drafts = weeks.filter((w) => w.status !== 'done').length
    const { trainingStart, trainingEnd } = data.settings
    let progress = null
    if (trainingStart && trainingEnd && trainingEnd > trainingStart) {
      const weekIndex = (iso) =>
        Math.floor((parseISO(iso) - parseISO(mondayOf(parseISO(trainingStart)))) / (7 * 86400000)) + 1
      const total = weekIndex(trainingEnd)
      const current = Math.min(Math.max(weekIndex(todayISO()), 1), total)
      progress = { current, total }
    }
    // Streak: consecutive documented weeks, backwards from the current week
    let streak = 0
    let m = weekIds.has(currentMonday) ? currentMonday : addDays(currentMonday, -7)
    while (weekIds.has(m)) {
      streak++
      m = addDays(m, -7)
    }
    return { count: weeks.length, drafts, progress, streak }
  }, [data, weekIds, currentMonday])

  // Visible rows: filtered/searched weeks + (unfiltered only) the gaps, with
  // consecutive missing weeks merged into one block.
  const rows = useMemo(() => {
    const query = search.trim().toLowerCase()
    const entries = []
    for (const w of data.weeks) {
      if (filter === 'draft' && w.status === 'done') continue
      if (filter === 'done' && w.status !== 'done') continue
      let snippet = null
      if (query) {
        snippet = searchMatch(w, query)
        if (snippet === null) continue
      }
      entries.push({ kind: 'week', id: w.id, week: w, snippet })
    }
    if (filter === 'all' && !query) {
      let block = null
      for (const m of missing) {
        if (block && addDays(block.to, 7) === m) {
          block.mondays.push(m)
          block.to = m
        } else {
          block = { kind: 'gap', id: m, mondays: [m], to: m }
          entries.push(block)
        }
      }
    }
    entries.sort((a, b) => (a.id < b.id ? -1 : 1))

    // Interleave year subheadings (by the week's ISO year)
    const withYears = []
    let lastYear = null
    for (const e of entries) {
      const { year } = isoWeek(e.id)
      if (year !== lastYear) {
        withYears.push({ kind: 'year', id: `year-${year}`, year })
        lastYear = year
      }
      withYears.push(e)
    }
    return withYears
  }, [data.weeks, missing, filter, search])

  // Years for the heatmap: from the start (training/first report) to today/last report
  const heatmap = useMemo(() => {
    if (data.weeks.length === 0 && missing.length === 0) return null
    const statusByMonday = new Map(data.weeks.map((w) => [w.id, w.status === 'done' ? 'done' : 'draft']))
    const ids = [...statusByMonday.keys(), ...missing, currentMonday].sort()
    const fromYear = isoWeek(ids[0]).year
    const toYear = isoWeek(ids[ids.length - 1]).year
    const years = []
    for (let y = fromYear; y <= toYear; y++) years.push(y)
    return { statusByMonday, years }
  }, [data.weeks, missing, currentMonday])

  const createCurrentWeek = (fromTemplate) => {
    // Find the next not-yet-documented week starting at the current one
    let monday = currentMonday
    while (data.weeks.some((w) => w.id === monday)) {
      const d = parseISO(monday)
      d.setDate(d.getDate() + 7)
      monday = mondayOf(d)
    }
    createWeek(monday, { fromTemplate })
    openWeek(monday)
  }

  const fillGap = (monday) => {
    createWeek(monday)
    openWeek(monday)
  }

  return (
    <div className="flex h-full flex-col">
      {/* header with progress + actions */}
      <div className="px-8 pb-4 pt-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-[22px] font-semibold tracking-tight">Übersicht</h1>
            <p className="mt-1 text-[13px] text-ink-2">
              {stats.count === 0
                ? 'Noch keine Berichtswochen angelegt.'
                : 'Alle bisher geschriebenen Berichtswochen — chronologisch.'}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button onClick={() => createCurrentWeek(true)}>
              <CopyIcon size={15} /> Struktur der Vorwoche übernehmen
            </Button>
            <Button variant="primary" onClick={() => createCurrentWeek(false)}>
              <PlusIcon size={15} weight="bold" /> Neue Woche anlegen
            </Button>
          </div>
        </div>

        {/* stat tiles (dashboard character) */}
        {stats.count > 0 && (
          <div className="mt-5 flex flex-wrap gap-3">
            <div className="min-w-[150px] flex-1 basis-36 sm:max-w-[200px]">
              <StatTile value={stats.count} label="Wochen dokumentiert" />
            </div>
            <div className="min-w-[150px] flex-1 basis-36 sm:max-w-[200px]">
              <StatTile
                value={stats.drafts}
                label={stats.drafts === 1 ? 'Entwurf offen' : 'Entwürfe offen'}
                color={stats.drafts === 0 ? 'text-done' : 'text-draft'}
              />
            </div>
            {missing.length > 0 && (
              <div className="min-w-[150px] flex-1 basis-36 sm:max-w-[200px]">
                <StatTile
                  value={missing.length}
                  label={missing.length === 1 ? 'Woche fehlt' : 'Wochen fehlen'}
                  color="text-sick"
                />
              </div>
            )}
            <div className="min-w-[150px] flex-1 basis-36 sm:max-w-[200px]">
              <StatTile value={stats.streak} label="Wochen in Serie" color="text-accent" />
            </div>
            {stats.progress && (
              <div className="min-w-[150px] flex-1 basis-36 sm:max-w-[200px]">
                <ProgressTile current={stats.progress.current} total={stats.progress.total} />
              </div>
            )}
          </div>
        )}

        {/* search + status filter */}
        {stats.count > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <div className="relative min-w-52 flex-1 sm:max-w-xs">
              <MagnifyingGlassIcon
                size={15}
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3"
              />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Stichpunkte, Fächer, Feiertage durchsuchen …"
                className="h-8 pl-8 text-[12.5px]"
              />
            </div>
            <Segment
              size="sm"
              options={[
                { value: 'all', label: 'Alle' },
                { value: 'draft', label: 'Entwürfe' },
                { value: 'done', label: 'Fertig' },
              ]}
              value={filter}
              onChange={setFilter}
            />
          </div>
        )}
      </div>

      {/* week list */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-8 pb-8">
        {heatmap && (
          <div className="mb-4">
            <YearHeatmap
              statusByMonday={heatmap.statusByMonday}
              missingSet={missingSet}
              years={heatmap.years}
              openWeek={openWeek}
            />
          </div>
        )}

        {data.weeks.length === 0 ? (
          <Panel className="flex flex-col items-center gap-3 py-16 text-center">
            <Logo size={46} className="mb-1 opacity-30" />
            <span className="text-[15px] font-medium text-ink-2">Leg deine erste Berichtswoche an.</span>
            <span className="max-w-sm text-[12.5px] text-ink-3">
              Die App wählt anhand des Datums automatisch das passende Halbjahres-Profil und erkennt
              Feiertage in Schleswig-Holstein von selbst.
            </span>
          </Panel>
        ) : rows.filter((r) => r.kind !== 'year').length === 0 ? (
          <Panel className="flex flex-col items-center gap-2 py-12 text-center">
            <span className="text-[14px] font-medium text-ink-2">Keine Treffer.</span>
            <span className="text-[12.5px] text-ink-3">Suche oder Filter anpassen.</span>
          </Panel>
        ) : (
          <div className="flex flex-col gap-1.5">
            {rows.map((row) => {
              if (row.kind === 'year') {
                return (
                  <div key={row.id} className="mt-3 flex items-center gap-3 px-1 first:mt-0">
                    <span className="text-[12px] font-semibold text-ink-2 tabular-nums">{row.year}</span>
                    <span className="h-px flex-1 bg-white/[0.06]" />
                  </div>
                )
              }

              if (row.kind === 'gap') {
                const individual = row.mondays.length <= 2 || expanded.has(row.id)
                if (!individual) {
                  const { week: fromWeek } = isoWeek(row.mondays[0])
                  const { week: toWeek } = isoWeek(row.to)
                  return (
                    <button
                      key={row.id}
                      type="button"
                      data-row
                      onClick={() => setExpanded((s) => new Set(s).add(row.id))}
                      className="flex items-center gap-3 rounded-xl border border-dashed border-sick/25 bg-sick/[0.04] px-4 py-2.5 text-left transition-colors duration-150 hover:bg-sick/[0.08]"
                    >
                      <span className="text-[12.5px] font-medium text-sick/90">
                        {row.mondays.length} Wochen fehlen
                      </span>
                      <span className="text-[12px] text-ink-3 tabular-nums">
                        KW {fromWeek} – KW {toWeek}
                      </span>
                      <CaretDownIcon size={13} className="ml-auto text-ink-3" />
                    </button>
                  )
                }
                return row.mondays.map((monday) => {
                  const { week: weekNo } = isoWeek(monday)
                  return (
                    <div
                      key={monday}
                      data-row
                      className="group flex items-center gap-4 rounded-xl border border-dashed border-sick/25 bg-sick/[0.04] px-4 py-2.5 transition-colors duration-150 hover:bg-sick/[0.08]"
                    >
                      <div className="w-14 shrink-0">
                        <div className="text-[14px] font-semibold leading-tight text-sick/90 tabular-nums">
                          KW {weekNo}
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="text-[12.5px] text-ink-3 tabular-nums">{weekRangeLabel(monday)}</span>
                        <span className="ml-2 text-[11.5px] font-medium text-sick/80">fehlt</span>
                      </div>
                      <Button size="sm" onClick={() => fillGap(monday)}>
                        <PlusIcon size={13} weight="bold" /> Anlegen
                      </Button>
                    </div>
                  )
                })
              }

              const w = row.week
              const { week: weekNo, year } = isoWeek(w.id)
              const isCurrent = w.id === currentMonday
              const profile = profileForDate(data.profiles, w.id)
              return (
                <button
                  key={w.id}
                  type="button"
                  data-row
                  data-current={isCurrent}
                  onClick={() => openWeek(w.id)}
                  className={cx(
                    'group flex items-center gap-4 rounded-xl border px-4 py-3 text-left',
                    'transition-[background-color,border-color,transform] duration-150 ease-(--ease-smooth)',
                    isCurrent
                      ? 'border-accent/25 bg-accent/[0.07] hover:bg-accent/[0.1]'
                      : 'border-white/[0.05] bg-surface/60 hover:border-white/[0.1] hover:bg-surface-2/70'
                  )}
                >
                  <div className="w-14 shrink-0">
                    <div className="text-[16px] font-semibold leading-tight tabular-nums">KW {weekNo}</div>
                    <div className="text-[11px] text-ink-3 tabular-nums">{year}</div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13.5px] font-medium text-ink tabular-nums">
                      {weekRangeLabel(w.id)}
                      {isCurrent && <span className="ml-2 text-[11.5px] font-semibold text-accent">Aktuelle Woche</span>}
                    </div>
                    <div className="mt-1 flex items-center gap-3">
                      <DayDots week={w} />
                      {row.snippet ? (
                        <span className="truncate text-[11.5px] text-accent-light">{row.snippet}</span>
                      ) : (
                        profile && <span className="truncate text-[11.5px] text-ink-3">{profile.name}</span>
                      )}
                    </div>
                  </div>
                  <Pill color={w.status === 'done' ? 'done' : 'draft'}>
                    {w.status === 'done' ? 'Fertig' : 'Entwurf'}
                  </Pill>
                  <CaretRightIcon
                    size={15}
                    className="text-ink-3 transition-transform duration-150 ease-(--ease-smooth) group-hover:translate-x-0.5 group-hover:text-ink-2"
                  />
                </button>
              )
            })}
          </div>
        )}

        {/* legend */}
        {data.weeks.length > 0 && (
          <div className="mt-5 flex items-center gap-4 px-1">
            <SectionTitle>Tage:</SectionTitle>
            {[
              ['bg-ink-3/50', 'Betrieb'],
              ['bg-accent/80', 'Schule'],
              ['bg-holiday/70', 'Feiertag'],
              ['bg-sick/70', 'Krank'],
              ['bg-vacation/70', 'Urlaub'],
            ].map(([color, label]) => (
              <span key={label} className="flex items-center gap-1.5 text-[11px] text-ink-3">
                <span className={cx('h-1.5 w-3.5 rounded-full', color)} /> {label}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
