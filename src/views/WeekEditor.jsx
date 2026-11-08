// Week editor (E-032): header with the week, its status and progress; the day
// tiles stay at the top, below them every day's editor card on one page to
// scroll through (user, 2026-11-08) — a tile or Alt+1–5 jumps to its day; the
// instructions of the week; the preview of the three output blocks next to it
// (below it in a narrow window). Parts live in src/views/editor/.
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  CaretLeftIcon,
  CaretRightIcon,
  CaretDownIcon,
  CopyIcon,
  PlusIcon,
  TrashIcon,
  DotsThreeIcon,
  NotePencilIcon,
  ChatCenteredTextIcon,
  SidebarSimpleIcon,
  CloudArrowDownIcon,
} from '@phosphor-icons/react'
import { useStore } from '../store.jsx'
import { Button, Card, IconButton, Kbd, Menu, StatusChip, TextArea, Tooltip, cx } from '../ui/basics.jsx'
import { showToast } from '../ui/toast.jsx'
import { isoWeek, weekRangeLabel, mondayOf, parseISO, addDays, todayISO } from '../lib/dates.js'
import { profileForDate, restoreDays } from '../lib/model.js'
import { formatAll } from '../lib/format.js'
import { styleExamples } from '../lib/phrasing.js'
import { fillWeekFromWebuntis } from '../lib/webuntis.js'
import { weekProgress } from '../lib/overview.js'
import { matchShortcut, SHORTCUT_KEYS } from '../lib/shortcuts.js'
import PhrasingPanel from './PhrasingPanel.jsx'
import WebuntisPanel from './WebuntisPanel.jsx'
import DayTabs from './editor/DayTabs.jsx'
import DayEditor from './editor/DayEditor.jsx'
import Preview, { CopyBar, useBlockCopy } from './editor/Preview.jsx'
import { useDayScroll } from './editor/useDayScroll.js'

/* ------------------------------ Suggestions ------------------------------ */

// Autocomplete: every bullet written so far (work, or per subject) plus the
// snippets from the settings
function useSuggestions(data) {
  return useMemo(() => {
    const work = new Set(data.settings.snippets ?? [])
    const bySubject = new Map() // subject label (lower case) -> Set of bullets
    const allSchool = new Set()
    for (const w of data.weeks) {
      for (const d of w.days) {
        for (const b of d.bullets ?? []) if (b.trim()) work.add(b.trim())
        for (const s of d.subjects ?? []) {
          const key = (s.label ?? '').trim().toLowerCase()
          for (const b of s.bullets ?? []) {
            if (!b.trim()) continue
            allSchool.add(b.trim())
            if (key) {
              if (!bySubject.has(key)) bySubject.set(key, new Set())
              bySubject.get(key).add(b.trim())
            }
          }
        }
      }
    }
    return {
      work: [...work],
      // bullets of the same subject first, then all other school bullets
      forSubject: (label) => {
        const own = bySubject.get((label ?? '').trim().toLowerCase()) ?? new Set()
        return [...new Set([...own, ...allSchool])]
      },
    }
  }, [data])
}

/* -------------------------------- Header -------------------------------- */

// The date range opens the native date picker; the picked day jumps to its week
function DateJump({ monday, onJump }) {
  const inputRef = useRef(null)
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={() => inputRef.current?.showPicker?.()}
        className="inline-flex items-center gap-1 rounded-chip text-body tabular-nums text-ink transition-colors duration-150 hover:text-ink-2"
        title="Zu einem Datum springen"
      >
        {weekRangeLabel(monday)}
        <CaretDownIcon size={12} className="text-ink-2" />
      </button>
      <input
        ref={inputRef}
        type="date"
        value={monday}
        tabIndex={-1}
        aria-label="Zu Datum springen"
        onChange={(e) => e.target.value && onJump(mondayOf(parseISO(e.target.value)))}
        className="absolute bottom-0 left-0 h-px w-px opacity-0"
      />
    </span>
  )
}

/* --------------------------------- Editor --------------------------------- */

export default function WeekEditor({ monday, setMonday }) {
  const { data, createWeek, updateWeek, deleteWeek, setLayout } = useStore()
  const { notesVisible, previewVisible } = data.settings.layout
  const [showWhitespace, setShowWhitespace] = useState(false)
  // Panels belong to one week: remembering its Monday closes them on week change
  const [phrasingFor, setPhrasingFor] = useState(null)
  const phrasingOpen = phrasingFor === monday
  const [webuntisFor, setWebuntisFor] = useState(null)
  const webuntisEnabled = data.settings.webuntis?.enabled === true
  const webuntisOpen = webuntisFor === monday && webuntisEnabled
  const rootRef = useRef(null)
  const scrollRef = useRef(null)
  const tilesRef = useRef(null)

  const today = todayISO()
  const week = data.weeks.find((w) => w.id === monday)
  const { week: weekNo, year } = isoWeek(monday)
  const profile = profileForDate(data.profiles, addDays(monday, 2))
  // The one source of the output text: preview, buttons, copy bar, shortcuts
  const blocks = useMemo(() => (week ? formatAll(week) : null), [week])
  const copier = useBlockCopy(blocks)
  const suggestions = useSuggestions(data)
  // Style examples for the AI prompts, once for the notes area and the week panel
  const examples = useMemo(() => styleExamples(data.weeks), [data.weeks])
  const progress = week ? weekProgress(week) : null

  // The week opens at today when it is in it, otherwise at its first day
  const dates = week ? week.days.map((d) => d.date) : []
  const initial = dates.includes(today) ? today : (dates[0] ?? null)
  const { active, jump } = useDayScroll({ rootRef, tilesRef, weekId: monday, dates, initial })
  const hasWeek = Boolean(week)

  // Opening (or creating) a week: back to the top, then to today
  useEffect(() => {
    if (!hasWeek) return
    if (scrollRef.current) scrollRef.current.scrollTop = 0
    if (!initial || initial === dates[0]) return
    const frame = requestAnimationFrame(() => jump(initial, { smooth: false }))
    return () => cancelAnimationFrame(frame)
    // only when a week opens, not on every edit
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monday, hasWeek])

  const changeWeek = (delta) => setMonday(addDays(monday, delta))
  const updateDay = (date, newDay) =>
    updateWeek(monday, (w) => ({ ...w, days: w.days.map((d) => (d.date === date ? newDay : d)) }))
  const toggleStatus = () => updateWeek(monday, (w) => ({ ...w, status: w.status === 'done' ? 'draft' : 'done' }))

  // Editor shortcuts (src/lib/shortcuts.js): Alt+←/→ week, Alt+1–5 jump to a day,
  // Strg+1/2/3 copy a block (in both preview states), Strg+P preview,
  // Strg+Umschalt+N notes area, Strg+N create
  useEffect(() => {
    const handler = (e) => {
      const hit = matchShortcut(e, ['editor'])
      if (!hit) return
      if (hit.id === 'week') changeWeek(hit.arg * 7)
      else if (hit.id === 'copy' && week) copier.copyByShortcut(hit.arg)
      else if (hit.id === 'day' && week?.days[hit.arg]) jump(week.days[hit.arg].date)
      else if (hit.id === 'preview') setLayout({ previewVisible: !previewVisible })
      else if (hit.id === 'notes') setLayout({ notesVisible: !notesVisible })
      else if (hit.id === 'createWeek' && !week) createWeek(monday)
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monday, week, blocks, notesVisible, previewVisible])

  // Apply AI bullets ({ date: bullets }) — replaces those days' bullets. Undo
  // puts back only those bullets; edits made meanwhile elsewhere stay
  // keepPanel: a single day from the notes area leaves an open week panel
  // (its pasted answer and ticks) alone
  const applyPhrasing = (result, { keepPanel = false } = {}) => {
    const snapshot = week
    const dates = Object.keys(result)
    updateWeek(monday, (w) => ({
      ...w,
      days: w.days.map((d) => (result[d.date] ? { ...d, bullets: result[d.date] } : d)),
    }))
    if (!keepPanel) setPhrasingFor(null)
    showToast(dates.length === 1 ? 'Stichpunkte für 1 Tag übernommen' : `Stichpunkte für ${dates.length} Tage übernommen`, {
      duration: 6000,
      action: { label: 'Rückgängig', onClick: () => updateWeek(monday, (w) => restoreDays(w, snapshot, dates, 'bullets')) },
    })
  }

  // Apply the ticked WebUntis subjects — fills only empty subjects. Undo puts
  // back only the subjects of the changed days
  const applyWebuntis = (picked) => {
    const snapshot = week
    const { week: filled, count, changes } = fillWeekFromWebuntis(week, picked)
    setWebuntisFor(null)
    if (!count) return
    const dates = changes
      .filter((c) => c.subjects.some((s) => s.result === 'filled' || s.result === 'added'))
      .map((c) => c.date)
    updateWeek(monday, () => filled)
    showToast(count === 1 ? '1 Fach übernommen' : `${count} Fächer übernommen`, {
      duration: 6000,
      action: { label: 'Rückgängig', onClick: () => updateWeek(monday, (w) => restoreDays(w, snapshot, dates, 'subjects')) },
    })
  }

  return (
    <div ref={rootRef} className="flex h-full flex-col">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-3 px-6 pb-4 pt-5">
        <div className="flex items-center">
          <IconButton label="Vorherige Woche" shortcut="Alt+←" side="bottom" onClick={() => changeWeek(-7)}>
            <CaretLeftIcon size={16} />
          </IconButton>
          <IconButton label="Nächste Woche" shortcut="Alt+→" side="bottom" onClick={() => changeWeek(7)}>
            <CaretRightIcon size={16} />
          </IconButton>
        </div>
        <div className="flex items-center gap-3">
          <h1 className="font-display text-hero font-medium tabular-nums text-ink">KW {weekNo}</h1>
          <div className="flex min-w-0 flex-col">
            <DateJump monday={monday} onJump={setMonday} />
            <span className="truncate text-meta text-ink-2">
              {profile ? profile.name : 'Kein Profil, Standard Mo–Fr Betrieb'}
            </span>
          </div>
        </div>
        {week && (
          <div className="flex items-center gap-3">
            <Tooltip label={week.status === 'done' ? 'Zurück auf Entwurf' : 'Als fertig markieren'} side="bottom">
              <StatusChip
                as="button"
                status={week.status === 'done' ? 'done' : 'draft'}
                onClick={toggleStatus}
                aria-label={`Status ${week.status === 'done' ? 'Fertig' : 'Entwurf'}, umschalten`}
              />
            </Tooltip>
            <span className="text-meta tabular-nums text-ink-2">
              {progress.needed === 0
                ? 'Keine Einträge nötig'
                : `${progress.written} von ${progress.needed} ${progress.needed === 1 ? 'Tag' : 'Tagen'} geschrieben`}
            </span>
          </div>
        )}
        {week && (
          <div className="ml-auto flex items-center gap-1.5">
            {webuntisEnabled && (
              <Button
                aria-pressed={webuntisOpen}
                className="aria-pressed:bg-surface-3"
                onClick={() => setWebuntisFor(webuntisOpen ? null : monday)}
                title="Schultage dieser Woche mit Fächern und Lehrstoff aus WebUntis füllen, mit Vorschau"
              >
                <CloudArrowDownIcon size={16} /> Aus WebUntis
              </Button>
            )}
            <Button
              aria-pressed={phrasingOpen}
              className="aria-pressed:bg-surface-3"
              onClick={() => setPhrasingFor(phrasingOpen ? null : monday)}
              title="Notizen der ganzen Woche per KI (Claude.ai, ChatGPT …) in Stichpunkte formulieren lassen, über die Zwischenablage"
            >
              <ChatCenteredTextIcon size={16} /> Mit KI formulieren
            </Button>
            <IconButton
              label={notesVisible ? 'Notizen ausblenden' : 'Notizen einblenden'}
              shortcut={SHORTCUT_KEYS.notes}
              side="bottom-end"
              aria-pressed={notesVisible}
              className={cx(notesVisible && 'bg-surface-2 text-ink')}
              onClick={() => setLayout({ notesVisible: !notesVisible })}
            >
              <NotePencilIcon size={17} />
            </IconButton>
            <IconButton
              label={previewVisible ? 'Vorschau ausblenden' : 'Vorschau einblenden'}
              shortcut={SHORTCUT_KEYS.preview}
              side="bottom-end"
              aria-pressed={previewVisible}
              className={cx(previewVisible && 'bg-surface-2 text-ink')}
              onClick={() => setLayout({ previewVisible: !previewVisible })}
            >
              <SidebarSimpleIcon size={17} style={{ transform: 'scaleX(-1)' }} />
            </IconButton>
            <Menu
              label="Weitere Aktionen"
              icon={<DotsThreeIcon size={18} />}
              items={[{ label: 'Woche löschen', icon: <TrashIcon size={16} />, danger: true, confirm: 'Wirklich löschen?', onSelect: () => deleteWeek(monday) }]}
            />
          </div>
        )}
      </header>

      {!week ? (
        <div className="px-6">
          <Card className="max-w-lg p-5">
            <h2 className="text-title font-medium text-ink">
              Für KW {weekNo}/{year} gibt es noch keinen Bericht.
            </h2>
            <p className="mt-1 text-body text-ink-2">
              {profile
                ? `Die Woche wird mit dem Profil „${profile.name}" angelegt, Feiertage erkennt die App selbst.`
                : 'Kein Profil deckt diesen Zeitraum ab, die Woche wird mit Mo–Fr Betrieb angelegt.'}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button variant="primary" onClick={() => createWeek(monday)}>
                <PlusIcon size={16} /> Woche anlegen
              </Button>
              <Button onClick={() => createWeek(monday, { fromTemplate: true })}>
                <CopyIcon size={16} /> Struktur der Vorwoche
              </Button>
              <span className="ml-1 flex items-center gap-1.5 text-meta text-ink-2">
                oder <Kbd keys="Strg+N" />
              </span>
            </div>
          </Card>
        </div>
      ) : (
        <div className="@container/editor flex min-h-0 flex-1 flex-col">
          <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 @5xl/editor:overflow-hidden">
            <div
              key={monday}
              className={cx(
                'view-in grid gap-4 @5xl/editor:h-full',
                previewVisible && '@5xl/editor:grid-cols-[minmax(0,1fr)_minmax(320px,0.5fr)]'
              )}
            >
              <div className="flex min-w-0 flex-col gap-3 @5xl/editor:min-h-0 @5xl/editor:overflow-y-auto @5xl/editor:pb-2 @5xl/editor:pr-1">
                {/* the tiles stay at the top of whichever element scrolls the days */}
                <div ref={tilesRef} className="sticky top-0 z-10 -mb-1 bg-canvas pb-1">
                  <DayTabs days={week.days} active={active} onJump={jump} today={today} />
                </div>
                {webuntisOpen && (
                  <WebuntisPanel
                    key={monday}
                    monday={monday}
                    week={week}
                    profile={profile}
                    onApply={applyWebuntis}
                    onClose={() => setWebuntisFor(null)}
                  />
                )}
                {phrasingOpen && (
                  <PhrasingPanel week={week} examples={examples} onApply={applyPhrasing} onClose={() => setPhrasingFor(null)} />
                )}
                {week.days.map((day) => (
                  <DayEditor
                    key={day.date}
                    day={day}
                    state={profile?.state ?? 'SH'}
                    onChange={(d) => updateDay(day.date, d)}
                    suggestions={suggestions}
                    notesVisible={notesVisible}
                    week={week}
                    examples={examples}
                    onApplyAi={(bullets) => applyPhrasing({ [day.date]: bullets }, { keepPanel: true })}
                  />
                ))}
                <Card>
                  <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-4 py-3">
                    <h2 className="text-title font-medium text-ink">Unterweisungen dieser Woche</h2>
                    <span className="text-meta text-ink-2">betrieblicher Unterricht, sonstige Schulungen</span>
                  </div>
                  <div className="p-4">
                    <TextArea
                      rows={3}
                      value={week.instructions}
                      aria-label="Unterweisungen dieser Woche"
                      placeholder="Meist leer, freier Text"
                      onChange={(e) => updateWeek(monday, (w) => ({ ...w, instructions: e.target.value }))}
                    />
                  </div>
                </Card>
              </div>

              {previewVisible && (
                <div className="flex min-w-0 flex-col gap-3 @5xl/editor:min-h-0 @5xl/editor:overflow-y-auto @5xl/editor:pb-2 @5xl/editor:pr-1">
                  <Preview
                    blocks={blocks}
                    copier={copier}
                    showWhitespace={showWhitespace}
                    setShowWhitespace={setShowWhitespace}
                    onHide={() => setLayout({ previewVisible: false })}
                  />
                </div>
              )}
            </div>
          </div>
          {!previewVisible && <CopyBar blocks={blocks} copier={copier} onShow={() => setLayout({ previewVisible: true })} />}
        </div>
      )}
    </div>
  )
}
