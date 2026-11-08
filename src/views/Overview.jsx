// Start screen (E-032): the figures, the weeks still missing, the year band
// (every day of the apprenticeship) and the latest weeks. All numbers and
// states come from src/lib/overview.js; this file only lays them out.
import { useEffect, useMemo, useRef, useState } from 'react'
import { MagnifyingGlassIcon, PencilSimpleLineIcon, WarningIcon, XIcon } from '@phosphor-icons/react'
import { useStore } from '../store.jsx'
import { Button, Card, DayCell, IconButton, Input, Kbd, StatusChip, StatusGlyph, DAY_STATE_LABELS, cx } from '../ui/basics.jsx'
import { isoWeek, weekRangeLabel, todayISO, formatDE, addDays } from '../lib/dates.js'
import { trainingProgress } from '../lib/model.js'
import { overviewStats, yearBand, weekRows, WEEKDAY_SHORT } from '../lib/overview.js'
import { matchShortcut, SHORTCUT_KEYS } from '../lib/shortcuts.js'
import { useCurrentMonday } from '../ui/useCurrentMonday.js'

// Year band geometry: 12 px cells, 3 px gap → one column every 15 px
const BAND_STEP = 15
// Week chips shown in the warning bar before "+n weitere"
const CHIPS_SHOWN = 8

const STATUS_TEXT = { done: 'Fertig', draft: 'Entwurf', missing: 'Fehlt', future: 'später', ignored: 'ignoriert' }

// "KW 12" — with the year when it isn't this year's
function weekLabel(monday, thisYear) {
  const { week, year } = isoWeek(monday)
  return year === thisYear ? `KW ${week}` : `KW ${week}/${year}`
}

/* -------------------------------- Figures -------------------------------- */

function Figures({ stats }) {
  const share = stats.due ? stats.done / stats.due : 0
  return (
    <Card className="grid grid-cols-[1.6fr_1fr_1fr]">
      <div className="flex flex-col gap-2 px-5 py-4">
        <span className="flex items-center gap-2 text-meta font-medium text-ink-2">
          <StatusGlyph status="done" className="text-accent" /> Fertig
        </span>
        <span className="flex items-baseline gap-2">
          <span className="font-display text-figure font-medium tabular-nums text-ink">{stats.done}</span>
          <span className="text-body tabular-nums text-ink-2">von {stats.due} Wochen</span>
        </span>
        <div
          className="h-1.5 overflow-hidden rounded-full bg-surface-2"
          role="progressbar"
          aria-label="Fertige Wochen"
          aria-valuemin={0}
          aria-valuemax={stats.due}
          aria-valuenow={stats.done}
        >
          <div className="h-full origin-left rounded-full bg-accent" style={{ transform: `scaleX(${share})` }} />
        </div>
      </div>
      <div className="flex flex-col gap-2 border-l border-line px-5 py-4">
        <span className="flex items-center gap-2 text-meta font-medium text-ink-2">
          <StatusGlyph status="draft" className="text-draft" /> Entwürfe
        </span>
        <span className="font-display text-figure font-medium tabular-nums text-ink">{stats.drafts}</span>
      </div>
      <div className="flex flex-col gap-2 border-l border-line px-5 py-4">
        <span className="flex items-center gap-2 text-meta font-medium text-ink-2">
          <StatusGlyph status="missing" className="text-missing" /> Ohne Eintrag
        </span>
        <span className="font-display text-figure font-medium tabular-nums text-ink">{stats.missing.length}</span>
      </div>
    </Card>
  )
}

/* ------------------------------ Warning bar ------------------------------ */

function MissingBar({ missing, openWeek, thisYear }) {
  const [all, setAll] = useState(false)
  // newest first: the gaps that matter most
  const ordered = [...missing].reverse()
  const shown = all ? ordered : ordered.slice(0, CHIPS_SHOWN)
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-control border border-missing/40 bg-missing/[0.06] px-3 py-2" role="status">
      <WarningIcon size={16} className="shrink-0 text-missing" />
      <span className="mr-1 text-body text-ink">
        {missing.length === 1 ? '1 Woche ohne Eintrag' : `${missing.length} Wochen ohne Eintrag`}
      </span>
      {shown.map((monday) => (
        <button
          key={monday}
          type="button"
          onClick={() => openWeek(monday)}
          title={`${weekRangeLabel(monday)} öffnen`}
          className="inline-flex h-6 items-center gap-1.5 rounded-chip border border-dashed border-missing/70 bg-surface px-2 text-meta font-medium tabular-nums text-ink transition-colors duration-150 hover:bg-surface-2"
        >
          {weekLabel(monday, thisYear)}
        </button>
      ))}
      {ordered.length > CHIPS_SHOWN && (
        <button
          type="button"
          onClick={() => setAll((a) => !a)}
          className="h-6 rounded-chip px-2 text-meta font-medium text-ink-2 transition-colors duration-150 hover:bg-surface-2 hover:text-ink"
        >
          {all ? 'Weniger' : `+${ordered.length - CHIPS_SHOWN} weitere`}
        </button>
      )}
    </div>
  )
}

/* -------------------------------- Year band -------------------------------- */

const LEGEND = [
  ['written', 'geschrieben'],
  ['open', 'offen'],
  ['holiday', 'Feiertag'],
  ['sick', 'Krank'],
  ['vacation', 'Urlaub'],
  ['future', 'Zukunft'],
]

function YearBand({ band, openWeek }) {
  const scrollRef = useRef(null)
  const currentIndex = band.columns.findIndex((c) => c.current)
  // the legend names "ignoriert" only when the band shows such weeks
  const hasIgnored = band.columns.some((c) => c.status === 'ignored')

  // Open at the current week, a third from the right edge
  useEffect(() => {
    const el = scrollRef.current
    if (!el || currentIndex < 0) return
    el.scrollLeft = currentIndex * BAND_STEP - el.clientWidth * 0.66
  }, [currentIndex])

  return (
    <Card className="px-5 py-4">
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <h2 className="text-title font-medium text-ink">Jahresband</h2>
        <span className="text-meta tabular-nums text-ink-2">
          {band.columns.length} Wochen, jede Spalte eine Woche
        </span>
      </div>
      <div className="flex gap-2">
        {/* weekday labels, aligned with the cell rows below the month row */}
        <div className="flex shrink-0 flex-col gap-[3px] pt-5" aria-hidden="true">
          {WEEKDAY_SHORT.slice(0, 5).map((d) => (
            <span key={d} className="h-4 text-[11px] leading-4 text-ink-2">
              {d}
            </span>
          ))}
        </div>
        <div ref={scrollRef} className="min-w-0 flex-1 overflow-x-auto pb-2">
          <div className="relative" style={{ width: band.columns.length * BAND_STEP }}>
            <div className="relative h-5" aria-hidden="true">
              {band.months.map((m) => (
                <span
                  key={m.column}
                  className="absolute top-0 whitespace-nowrap text-[11px] leading-4 text-ink-2"
                  style={{ left: m.column * BAND_STEP }}
                >
                  {m.label}
                </span>
              ))}
            </div>
            <div className="flex gap-[3px]">
              {band.columns.map((c) => (
                <button
                  key={c.monday}
                  type="button"
                  data-band-week={c.monday}
                  onClick={() => openWeek(c.monday)}
                  aria-label={`KW ${c.week}/${c.year} öffnen, ${STATUS_TEXT[c.status]}`}
                  className={cx(
                    'flex flex-col gap-[3px] rounded-[3px]',
                    c.current && 'outline-1 outline-offset-2 outline-ink-2 [outline-style:solid]'
                  )}
                >
                  {c.cells.map((state, i) => {
                    const date = addDays(c.monday, i)
                    return (
                      <DayCell
                        key={i}
                        size="band"
                        state={state}
                        title={`KW ${c.week}, ${WEEKDAY_SHORT[i]} ${formatDE(date)}: ${DAY_STATE_LABELS[state]}`}
                      />
                    )
                  })}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2" aria-hidden="true">
        {(hasIgnored ? [...LEGEND, ['ignored', 'ignoriert']] : LEGEND).map(([state, label]) => (
          <span key={state} className="flex items-center gap-1.5 text-meta text-ink-2">
            <DayCell size="band" state={state} /> {label}
          </span>
        ))}
        <span className="flex items-center gap-1.5 text-meta text-ink-2">
          <span className="h-4 w-3 rounded-[3px] outline-1 outline-offset-1 outline-ink-2 [outline-style:solid]" /> aktuelle Woche
        </span>
      </div>
    </Card>
  )
}

/* -------------------------------- Week list -------------------------------- */

function WeekRow({ row, openWeek }) {
  return (
    <button
      type="button"
      data-row
      data-current={row.current}
      aria-current={row.current ? 'date' : undefined}
      onClick={() => openWeek(row.monday)}
      className="grid w-full grid-cols-[76px_minmax(140px,180px)_1fr_auto] items-center gap-4 px-5 py-2 text-left transition-colors duration-150 hover:bg-surface-2"
    >
      <span className="text-body font-medium tabular-nums text-ink">KW {row.week}</span>
      <span className="min-w-0">
        <span className="block text-body tabular-nums text-ink-2">{weekRangeLabel(row.monday)}</span>
        {row.current && <span className="block text-meta text-ink-2">aktuelle Woche</span>}
      </span>
      <span className="flex min-w-0 flex-col gap-1">
        <span className="flex items-center gap-1">
          {row.days.map((d) => (
            <DayCell
              key={d.date}
              state={d.state}
              short={d.short}
              letter={d.letter}
              title={`${d.short} ${formatDE(d.date)}: ${DAY_STATE_LABELS[d.state]}`}
            />
          ))}
        </span>
        {row.snippet && <span className="truncate text-meta text-ink-2">{row.snippet}</span>}
      </span>
      <StatusChip status={row.status} />
    </button>
  )
}

function WeekList({ list, query, showAll, setShowAll, openWeek }) {
  const searching = Boolean(query.trim())
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-3">
        <h2 className="mr-auto text-title font-medium text-ink">{searching ? 'Treffer' : 'Wochen'}</h2>
        <span className="text-meta tabular-nums text-ink-2">
          {searching ? `${list.shown} gefunden` : `${list.shown} von ${list.total}`}
        </span>
        {!searching && list.total > list.shown && (
          <Button size="sm" variant="ghost" onClick={() => setShowAll(true)}>
            Alle anzeigen
          </Button>
        )}
        {!searching && showAll && (
          <Button size="sm" variant="ghost" onClick={() => setShowAll(false)}>
            Nur die letzten 8
          </Button>
        )}
      </div>
      {list.groups.length === 0 ? (
        <p className="border-t border-line px-5 py-6 text-body text-ink-2">Keine Woche passt zur Suche.</p>
      ) : (
        list.groups.map((group) => (
          <div key={group.key} className="border-t border-line">
            <div className="px-5 pb-1 pt-3 text-meta font-medium text-ink-2">{group.label}</div>
            {group.rows.map((row) => (
              <WeekRow key={row.monday} row={row} openWeek={openWeek} />
            ))}
          </div>
        ))
      )}
    </Card>
  )
}

/* --------------------------------- View --------------------------------- */

export default function Overview({ openWeek }) {
  const { data } = useStore()
  const searchRef = useRef(null)
  const [query, setQuery] = useState('')
  const [showAll, setShowAll] = useState(false)

  const today = todayISO()
  const currentMonday = useCurrentMonday()
  const { week: currentWeek, year: thisYear } = isoWeek(currentMonday)

  const stats = useMemo(() => overviewStats(data, currentMonday), [data, currentMonday])
  const band = useMemo(() => yearBand(data, today), [data, today])
  const list = useMemo(
    () => weekRows(data, today, { limit: showAll ? 0 : 8, query }),
    [data, today, showAll, query]
  )
  const progress = trainingProgress(data.settings, today)
  const empty = data.weeks.length === 0 && stats.missing.length === 0

  // Strg+F jumps into the search
  useEffect(() => {
    const handler = (e) => {
      if (matchShortcut(e, ['overview'])?.id !== 'search') return
      e.preventDefault()
      searchRef.current?.focus()
      searchRef.current?.select()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center gap-3 px-6 pb-4 pt-5">
        <div className="mr-auto">
          <h1 className="font-display text-page font-medium text-ink">Übersicht</h1>
          {progress && (
            <p className="text-meta tabular-nums text-ink-2">
              Ausbildungswoche {progress.current} von {progress.total}
            </p>
          )}
        </div>
        {!empty && (
          <div className="relative w-64">
            <MagnifyingGlassIcon size={16} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-2" />
            <Input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Escape' && setQuery('')}
              placeholder="KW, Datum oder Text"
              aria-label="Wochen durchsuchen"
              className="pl-8 pr-16 [&::-webkit-search-cancel-button]:hidden"
            />
            {query ? (
              <span className="absolute right-0.5 top-1/2 -translate-y-1/2">
                <IconButton label="Suche leeren" size="sm" onClick={() => setQuery('')}>
                  <XIcon size={14} />
                </IconButton>
              </span>
            ) : (
              <Kbd keys={SHORTCUT_KEYS.search} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2" />
            )}
          </div>
        )}
        <Button variant="primary" onClick={() => openWeek(currentMonday)}>
          <PencilSimpleLineIcon size={16} /> KW {currentWeek} bearbeiten
        </Button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">
        {empty ? (
          <Card className="max-w-xl px-5 py-5">
            <h2 className="text-title font-medium text-ink">Noch keine Berichtswochen angelegt.</h2>
            <p className="mt-1 text-body text-ink-2">
              Über „KW {currentWeek} bearbeiten“ legst du die erste Woche an. Die App wählt anhand des Datums das
              passende Halbjahres-Profil und erkennt Feiertage von selbst.
            </p>
          </Card>
        ) : (
          <div className="flex max-w-[1400px] flex-col gap-4">
            {!query && <Figures stats={stats} />}
            {!query && stats.missing.length > 0 && (
              <MissingBar missing={stats.missing} openWeek={openWeek} thisYear={thisYear} />
            )}
            {!query && <YearBand band={band} openWeek={openWeek} />}
            <WeekList list={list} query={query} showAll={showAll} setShowAll={setShowAll} openWeek={openWeek} />
          </div>
        )}
      </div>
    </div>
  )
}
