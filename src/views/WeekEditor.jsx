// Week editor: edit days, set statuses, copy the output.
import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { gsap } from 'gsap'
import {
  CaretLeftIcon,
  CaretRightIcon,
  PlusIcon,
  XIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  CopyIcon,
  CheckIcon,
  FileArrowDownIcon,
  TrashIcon,
  DotsSixVerticalIcon,
  CalendarPlusIcon,
  ClipboardTextIcon,
  NotePencilIcon,
  ListBulletsIcon,
  SparkleIcon,
} from '@phosphor-icons/react'
import { useStore, api } from '../store.jsx'
import { Button, IconButton, Input, TextArea, Segment, Panel, Pill, SectionTitle, cx } from '../ui/basics.jsx'
import { showToast } from '../ui/toast.jsx'
import { isoWeek, weekRangeLabel, weekdayName, formatDE, mondayOf, parseISO, addDays } from '../lib/dates.js'
import { holidayOn } from '../lib/holidays.js'
import { profileForDate } from '../lib/model.js'
import { formatAll } from '../lib/format.js'
import { splitNotes, BULLET_PREFIX } from '../lib/notes.js'
import PhrasingPanel from './PhrasingPanel.jsx'

const STATUS_OPTIONS = [
  { value: 'normal', label: 'Normal' },
  { value: 'holiday', label: 'Feiertag' },
  { value: 'sick', label: 'Krank' },
  { value: 'vacation', label: 'Urlaub' },
]

// Move an array element (returns a new array)
const move = (arr, from, to) => {
  if (to < 0 || to >= arr.length) return arr
  const copy = [...arr]
  const [el] = copy.splice(from, 1)
  copy.splice(to, 0, el)
  return copy
}

/* ------------------------------ Bullet list ------------------------------ */

// Input row with autocomplete: while typing (from 2 characters) it suggests
// matching bullets from all previous weeks + the user's snippets.
function BulletInput({ bullet, placeholder, suggestions, onChange, onEnter, onBackspaceEmpty }) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)

  const input = bullet.trim().toLowerCase()
  const matches =
    open && input.length >= 2
      ? suggestions
          .filter((s) => s.toLowerCase().includes(input) && s.toLowerCase() !== input)
          .slice(0, 6)
      : []

  const accept = (value) => {
    onChange(value)
    setOpen(false)
  }

  return (
    <div className="relative min-w-0 flex-1">
      <Input
        value={bullet}
        placeholder={placeholder}
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
          setActive(0)
        }}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (matches.length > 0) {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setActive((a) => (a + 1) % matches.length)
              return
            }
            if (e.key === 'ArrowUp') {
              e.preventDefault()
              setActive((a) => (a - 1 + matches.length) % matches.length)
              return
            }
            if (e.key === 'Escape' || e.key === 'Tab') {
              setOpen(false)
              return
            }
            if (e.key === 'Enter') {
              e.preventDefault()
              accept(matches[active])
              return
            }
          }
          if (e.key === 'Enter') onEnter()
          // Backspace on an empty bullet removes the row (but never the last one)
          if (e.key === 'Backspace' && bullet === '') {
            e.preventDefault()
            onBackspaceEmpty()
          }
        }}
        className="h-8"
      />
      {matches.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-lg border border-white/[0.1] bg-surface-2/95 shadow-[0_10px_30px_-10px_oklch(0_0_0/0.7)] backdrop-blur">
          {matches.map((s, i) => (
            <button
              key={s}
              type="button"
              // mousedown instead of click, so the input's blur doesn't close the list first
              onMouseDown={(e) => {
                e.preventDefault()
                accept(s)
              }}
              onMouseEnter={() => setActive(i)}
              className={cx(
                'block w-full truncate px-3 py-1.5 text-left text-[12.5px]',
                i === active ? 'bg-accent/15 text-ink' : 'text-ink-2'
              )}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function BulletList({ bullets, onChange, placeholder, suggestions = [] }) {
  const containerRef = useRef(null)
  // Drag & drop reordering: index of the dragged and the hovered bullet
  const [dragIndex, setDragIndex] = useState(null)
  const [overIndex, setOverIndex] = useState(null)

  const focusAt = (index) => {
    requestAnimationFrame(() => {
      containerRef.current?.querySelectorAll('input')[index]?.focus()
    })
  }

  const setAt = (i, value) => onChange(bullets.map((b, j) => (j === i ? value : b)))
  const insertAfter = (index) => {
    const copy = [...bullets]
    copy.splice(index + 1, 0, '')
    onChange(copy)
    focusAt(index + 1)
  }
  const remove = (i) => {
    onChange(bullets.filter((_, j) => j !== i))
    focusAt(Math.max(0, i - 1))
  }
  const drop = (target) => {
    if (dragIndex !== null && dragIndex !== target) onChange(move(bullets, dragIndex, target))
    setDragIndex(null)
    setOverIndex(null)
  }

  // Append clipboard lines (time tracking/WebUntis) as bullets; leading bullet
  // characters/numbering are stripped.
  const pasteFromClipboard = async () => {
    const text = await api.readClipboard()
    const lines = (text ?? '')
      .split(/\r?\n/)
      .map((l) => l.replace(BULLET_PREFIX, '').trim())
      .filter(Boolean)
    if (lines.length === 0) {
      showToast('Zwischenablage enthält keinen Text', { kind: 'error' })
      return
    }
    onChange([...bullets.filter((b) => b.trim()), ...lines])
    showToast(lines.length === 1 ? '1 Stichpunkt eingefügt' : `${lines.length} Stichpunkte eingefügt`)
  }

  return (
    <div ref={containerRef} className="flex flex-col gap-1">
      {bullets.map((bullet, i) => (
        <div
          key={i}
          onDragOver={(e) => {
            if (dragIndex === null) return
            e.preventDefault()
            setOverIndex(i)
          }}
          onDrop={(e) => {
            e.preventDefault()
            drop(i)
          }}
          className={cx(
            'group/bullet flex items-center gap-1 rounded-md transition-[opacity,box-shadow] duration-150',
            dragIndex === i && 'opacity-40',
            overIndex === i && dragIndex !== null && dragIndex !== i && 'ring-1 ring-accent/40'
          )}
        >
          {/* drag handle (reorder via drag & drop) */}
          <button
            type="button"
            draggable
            onDragStart={(e) => {
              setDragIndex(i)
              e.dataTransfer.effectAllowed = 'move'
            }}
            onDragEnd={() => {
              setDragIndex(null)
              setOverIndex(null)
            }}
            title="Zum Umsortieren ziehen"
            aria-label="Stichpunkt umsortieren"
            className="flex h-8 w-4 shrink-0 cursor-grab items-center justify-center text-ink-3/40 transition-colors duration-150 hover:text-ink-2 active:cursor-grabbing group-hover/bullet:text-ink-3"
          >
            <DotsSixVerticalIcon size={14} />
          </button>
          <BulletInput
            bullet={bullet}
            placeholder={placeholder}
            suggestions={suggestions}
            onChange={(value) => setAt(i, value)}
            onEnter={() => insertAfter(i)}
            onBackspaceEmpty={() => bullets.length > 1 && remove(i)}
          />
          <div className="flex opacity-0 transition-opacity duration-150 group-focus-within/bullet:opacity-100 group-hover/bullet:opacity-100">
            <IconButton label="Nach oben" disabled={i === 0} onClick={() => onChange(move(bullets, i, i - 1))}>
              <ArrowUpIcon size={13} />
            </IconButton>
            <IconButton label="Nach unten" disabled={i === bullets.length - 1} onClick={() => onChange(move(bullets, i, i + 1))}>
              <ArrowDownIcon size={13} />
            </IconButton>
            <IconButton label="Stichpunkt löschen" danger disabled={bullets.length === 1} onClick={() => remove(i)}>
              <XIcon size={13} />
            </IconButton>
          </div>
        </div>
      ))}
      <div className="mt-0.5 flex items-center gap-1">
        <button
          type="button"
          onClick={() => insertAfter(bullets.length - 1)}
          className="flex h-7 w-fit items-center gap-1.5 rounded-md px-2 text-[12px] font-medium text-ink-3 transition-colors duration-150 hover:bg-white/[0.05] hover:text-accent"
        >
          <PlusIcon size={13} weight="bold" /> Stichpunkt
        </button>
        <button
          type="button"
          onClick={pasteFromClipboard}
          title="Zeilen aus der Zwischenablage (z. B. Zeiterfassung/WebUntis) als Stichpunkte anhängen"
          className="flex h-7 w-fit items-center gap-1.5 rounded-md px-2 text-[12px] font-medium text-ink-3 transition-colors duration-150 hover:bg-white/[0.05] hover:text-accent"
        >
          <ClipboardTextIcon size={13} /> Aus Zwischenablage
        </button>
      </div>
    </div>
  )
}

/* -------------------------------- Day card -------------------------------- */

function DayCard({ day, onChange, suggestions }) {
  // Raw notes (e.g. dictated) are collapsed unless they already have content
  const hasNotes = Boolean(day.notes?.trim())
  const [notesOpen, setNotesOpen] = useState(hasNotes)

  const statusText = {
    holiday: day.holidayName ? `Feiertag: ${day.holidayName}` : 'Feiertag',
    sick: 'Krankheitstag',
    vacation: 'Urlaub',
  }[day.status]

  // Notes -> bullets without AI (work days): replaces empty placeholders,
  // keeps the notes so the user can still compare/delete them
  const notesToBullets = () => {
    const items = splitNotes(day.notes)
    if (items.length === 0) {
      showToast('Keine Notizen zum Übernehmen', { kind: 'error' })
      return
    }
    onChange({ ...day, bullets: [...day.bullets.filter((b) => b.trim()), ...items] })
    showToast(items.length === 1 ? '1 Stichpunkt übernommen' : `${items.length} Stichpunkte übernommen`)
  }

  const setStatus = (status) => {
    // When switching to "holiday", suggest the real holiday name
    const autoName = holidayOn(day.date) || day.holidayName || ''
    onChange({ ...day, status, holidayName: status === 'holiday' ? autoName : day.holidayName })
  }

  return (
    // no overflow-hidden: the autocomplete dropdown reaches over the card edge
    <Panel data-daycard className="shrink-0">
      <div className="flex flex-wrap items-center gap-1.5 border-b border-white/[0.05] px-4 py-2">
        {/* date below the weekday keeps the header on one line next to the controls */}
        <div className="mr-auto flex flex-col leading-tight">
          <span className="text-[14px] font-semibold">{weekdayName(day.date)}</span>
          <span className="text-[11.5px] text-ink-3 tabular-nums">{formatDE(day.date)}</span>
        </div>
        <button
          type="button"
          onClick={() => setNotesOpen((open) => !open)}
          aria-expanded={notesOpen}
          title="Notizen — Rohtext zu diesem Tag (erscheint nicht in der Ausgabe)"
          aria-label="Notizen"
          className={cx(
            'relative grid h-7 w-7 shrink-0 place-items-center rounded-md transition-colors duration-150',
            notesOpen ? 'bg-white/[0.07] text-ink' : 'text-ink-3 hover:bg-white/[0.05] hover:text-ink-2'
          )}
        >
          <NotePencilIcon size={15} />
          {hasNotes && <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-accent" />}
        </button>
        <Segment
          size="sm"
          options={[
            { value: 'work', label: 'Betrieb' },
            { value: 'school', label: 'Schule' },
          ]}
          value={day.type}
          onChange={(type) => onChange({ ...day, type })}
        />
        <Segment size="sm" options={STATUS_OPTIONS} value={day.status} onChange={setStatus} />
      </div>

      {notesOpen && (
        <div className="border-b border-white/[0.05] bg-inset/20 px-4 py-2.5">
          <TextArea
            rows={3}
            value={day.notes ?? ''}
            placeholder="Rohnotizen, z. B. diktiert — landen nicht in der Ausgabe."
            onChange={(e) => onChange({ ...day, notes: e.target.value })}
            className="text-[12.5px]"
          />
          {day.type === 'work' && day.status === 'normal' && (
            <div className="mt-1.5 flex justify-end">
              <Button
                size="sm"
                variant="ghost"
                onClick={notesToBullets}
                disabled={!hasNotes}
                title="Jede Zeile bzw. jeden Satz als eigenen Stichpunkt anhängen"
              >
                <ListBulletsIcon size={14} /> In Stichpunkte übernehmen
              </Button>
            </div>
          )}
        </div>
      )}

      {day.status !== 'normal' ? (
        <div className="flex items-center gap-3 px-4 py-3.5">
          <Pill color={day.status}>{statusText}</Pill>
          {day.status === 'holiday' && (
            <Input
              value={day.holidayName ?? ''}
              placeholder="Name des Feiertags"
              onChange={(e) => onChange({ ...day, holidayName: e.target.value })}
              className="h-8 max-w-60"
            />
          )}
          <span className="text-[12px] text-ink-3">Keine Stichpunkte nötig.</span>
        </div>
      ) : day.type === 'work' ? (
        <div className="px-4 py-3">
          <BulletList
            bullets={day.bullets}
            onChange={(bullets) => onChange({ ...day, bullets })}
            placeholder="Tätigkeit beschreiben …"
            suggestions={suggestions.work}
          />
        </div>
      ) : (
        <SchoolDay day={day} onChange={onChange} suggestions={suggestions} />
      )}
    </Panel>
  )
}

/* -------------------------- School day (subjects) -------------------------- */

function SchoolDay({ day, onChange, suggestions }) {
  const setSubjects = (subjects) => onChange({ ...day, subjects })
  const setSubject = (i, subject) => setSubjects(day.subjects.map((s, j) => (j === i ? subject : s)))

  return (
    <div className="flex flex-col gap-3 px-4 py-3">
      {day.subjects.map((subject, i) => (
        <div key={i} className="rounded-lg border border-white/[0.05] bg-inset/30 p-2.5">
          <div className="mb-1.5 flex items-center gap-1">
            <Input
              value={subject.label}
              placeholder="Fach / Lernfeld"
              onChange={(e) => setSubject(i, { ...subject, label: e.target.value })}
              className="h-7 max-w-44 border-transparent bg-transparent px-1.5 text-[13px] font-semibold hover:border-white/[0.1]"
            />
            <span className="mr-auto text-[12px] text-ink-3">:</span>
            <IconButton label="Fach nach oben" disabled={i === 0} onClick={() => setSubjects(move(day.subjects, i, i - 1))}>
              <ArrowUpIcon size={13} />
            </IconButton>
            <IconButton label="Fach nach unten" disabled={i === day.subjects.length - 1} onClick={() => setSubjects(move(day.subjects, i, i + 1))}>
              <ArrowDownIcon size={13} />
            </IconButton>
            <IconButton label="Fach entfernen" danger onClick={() => setSubjects(day.subjects.filter((_, j) => j !== i))}>
              <XIcon size={13} />
            </IconButton>
          </div>
          <BulletList
            bullets={subject.bullets}
            onChange={(bullets) => setSubject(i, { ...subject, bullets })}
            placeholder="Unterrichtsthema …"
            suggestions={suggestions.forSubject(subject.label)}
          />
        </div>
      ))}
      <button
        type="button"
        onClick={() => setSubjects([...day.subjects, { label: '', bullets: [''] }])}
        className="flex h-8 w-fit items-center gap-1.5 rounded-md px-2 text-[12.5px] font-medium text-ink-3 transition-colors duration-150 hover:bg-white/[0.05] hover:text-accent"
      >
        <PlusIcon size={14} weight="bold" /> Fach hinzufügen
      </button>
      <p className="text-[11.5px] text-ink-3">
        Fächer ohne Stichpunkte werden in der Ausgabe automatisch weggelassen.
      </p>
    </div>
  )
}

/* ------------------------------ Output block ------------------------------ */

// Detects day headers like "Montag, den 20.04.2026:"
const IS_DAY_HEADER = /, den \d{2}\.\d{2}\.\d{4}:$/

// Colored preview: day headers in accent, "- " bullets muted, subject labels
// (ending in ":") stronger. Rendering only — the copied text stays exact.
function OutputPreview({ text }) {
  if (!text) return <span className="italic text-ink-3">— leer —</span>
  const lines = text.split('\n')
  return lines.map((line, i) => {
    const nl = i < lines.length - 1 ? '\n' : ''
    let el
    if (IS_DAY_HEADER.test(line)) {
      el = <span className="font-semibold text-accent">{line}</span>
    } else if (line.startsWith('- ')) {
      el = (
        <span className="text-ink-2">
          <span className="text-ink-3">- </span>
          {line.slice(2)}
        </span>
      )
    } else if (line.length > 1 && line.endsWith(':')) {
      el = <span className="font-medium text-ink">{line}</span>
    } else {
      el = <span className="text-ink-2">{line}</span>
    }
    return (
      <Fragment key={i}>
        {el}
        {nl}
      </Fragment>
    )
  })
}

function OutputBlock({ title, shortName, text, fileName }) {
  const [copied, setCopied] = useState(false)
  const iconRef = useRef(null)

  const copy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    showToast(`„${shortName}" kopiert`)
    if (iconRef.current) {
      gsap.fromTo(iconRef.current, { scale: 0.5 }, { scale: 1, duration: 0.35, ease: 'back.out(3)' })
    }
    setTimeout(() => setCopied(false), 1600)
  }

  const exportTxt = async () => {
    const res = await api.exportText(fileName, text)
    if (res?.ok) showToast('Als .txt gespeichert')
    else if (res && !res.canceled) showToast(res.error ?? 'Export fehlgeschlagen', { kind: 'error' })
  }

  return (
    <Panel className="flex shrink-0 flex-col">
      <div className="flex items-center gap-1.5 border-b border-white/[0.05] py-2 pl-4 pr-2">
        <SectionTitle className="mr-auto">{title}</SectionTitle>
        <IconButton label="Als .txt exportieren" onClick={exportTxt} disabled={!text}>
          <FileArrowDownIcon size={15} />
        </IconButton>
        <Button
          size="sm"
          variant={copied ? 'primary' : 'outline'}
          onClick={copy}
          disabled={!text}
          className="w-24"
        >
          <span ref={iconRef} className="inline-flex">
            {copied ? <CheckIcon size={14} weight="bold" /> : <CopyIcon size={14} />}
          </span>
          {copied ? 'Kopiert' : 'Kopieren'}
        </Button>
      </div>
      <pre className="selectable min-h-[52px] overflow-auto whitespace-pre-wrap px-4 py-3 font-mono text-[12px] leading-relaxed text-ink-2">
        <OutputPreview text={text} />
      </pre>
    </Panel>
  )
}

/* --------------------------------- Editor --------------------------------- */

export default function WeekEditor({ monday, setMonday }) {
  const { data, createWeek, updateWeek, deleteWeek } = useStore()
  const [confirmDelete, setConfirmDelete] = useState(false)
  // The AI panel belongs to one week: remembering its Monday closes it on week change
  const [phrasingFor, setPhrasingFor] = useState(null)
  const phrasingOpen = phrasingFor === monday
  const columnRef = useRef(null)
  const gridRef = useRef(null)
  const directionRef = useRef(0) // -1 = back, +1 = forward, 0 = jump (date picker)

  const week = data.weeks.find((w) => w.id === monday)
  const { week: weekNo, year } = isoWeek(monday)
  const profile = profileForDate(data.profiles, addDays(monday, 2))
  const blocks = useMemo(() => (week ? formatAll(week) : null), [week])

  // Autocomplete suggestions: every bullet written so far (work or per subject)
  // + the snippets maintained in the settings.
  const suggestions = useMemo(() => {
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

  // One week forward/back — remembers the direction for the slide transition
  const changeWeek = (delta) => {
    directionRef.current = delta > 0 ? 1 : -1
    setConfirmDelete(false)
    setMonday(addDays(monday, delta))
  }

  // Week change transition: with ←/→ the whole content slides in from the
  // navigation direction; on a date jump only the day cards stagger in.
  useEffect(() => {
    const direction = directionRef.current
    directionRef.current = 0
    if (!week) return
    if (direction !== 0 && gridRef.current) {
      gsap.fromTo(
        gridRef.current,
        { opacity: 0, x: direction * 42 },
        { opacity: 1, x: 0, duration: 0.32, ease: 'power3.out', clearProps: 'transform,opacity' }
      )
    } else if (columnRef.current) {
      gsap.fromTo(
        columnRef.current.querySelectorAll('[data-daycard]'),
        { opacity: 0, y: 8 },
        { opacity: 1, y: 0, duration: 0.3, stagger: 0.05, ease: 'power3.out', clearProps: 'all' }
      )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monday, !!week])

  const updateDay = (date, newDay) =>
    updateWeek(monday, (w) => ({ ...w, days: w.days.map((d) => (d.date === date ? newDay : d)) }))

  // Editor shortcuts: Alt+←/→ change week, Ctrl+Shift+1/2/3 copy a block,
  // Ctrl+N create the week. Uses e.code so it also works with the German
  // layout (Shift+1 would otherwise be "!").
  useEffect(() => {
    const copyBlock = async (index) => {
      if (!blocks) return
      const entries = [
        ['Betriebliche Tätigkeiten', blocks.work],
        ['Unterweisungen', blocks.instructions],
        ['Berufsschule', blocks.school],
      ]
      const [name, text] = entries[index]
      if (!text) {
        showToast(`„${name}" ist leer`, { kind: 'error' })
        return
      }
      await navigator.clipboard.writeText(text)
      showToast(`„${name}" kopiert`)
    }

    const handler = (e) => {
      if (e.altKey && !e.ctrlKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        e.preventDefault()
        changeWeek(e.key === 'ArrowLeft' ? -7 : 7)
      } else if (e.ctrlKey && e.shiftKey && ['Digit1', 'Digit2', 'Digit3'].includes(e.code)) {
        e.preventDefault()
        copyBlock(Number(e.code.slice(-1)) - 1)
      } else if (e.ctrlKey && !e.shiftKey && !e.altKey && e.code === 'KeyN' && !week) {
        e.preventDefault()
        createWeek(monday)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monday, week, blocks])

  const confirmDeleteWeek = () => {
    deleteWeek(monday)
    setConfirmDelete(false)
  }

  // Apply AI bullets ({ date: bullets }) — replaces those days' bullets, undoable
  const applyPhrasing = (result) => {
    const snapshot = week
    updateWeek(monday, (w) => ({
      ...w,
      days: w.days.map((d) => (result[d.date] ? { ...d, bullets: result[d.date] } : d)),
    }))
    setPhrasingFor(null)
    const count = Object.keys(result).length
    showToast(count === 1 ? 'Stichpunkte für 1 Tag übernommen' : `Stichpunkte für ${count} Tage übernommen`, {
      duration: 6000,
      action: { label: 'Rückgängig', onClick: () => updateWeek(monday, () => structuredClone(snapshot)) },
    })
  }

  return (
    <div className="flex h-full flex-col">
      {/* header: week selection + status */}
      <div className="flex flex-wrap items-center gap-3 px-8 pb-4 pt-6">
        <div className="flex items-center gap-1">
          <IconButton label="Vorherige Woche" onClick={() => changeWeek(-7)}>
            <CaretLeftIcon size={16} />
          </IconButton>
          <IconButton label="Nächste Woche" onClick={() => changeWeek(7)}>
            <CaretRightIcon size={16} />
          </IconButton>
        </div>
        <div className="mr-auto flex items-center gap-4">
          {/* ISO week as hero number — the editor's clear anchor */}
          <div className="flex items-baseline gap-1.5">
            <span className="text-[12px] font-semibold uppercase tracking-[0.1em] text-ink-3">KW</span>
            <span className="text-[38px] font-semibold leading-none tracking-tight tabular-nums">{weekNo}</span>
          </div>
          <div className="border-l border-white/[0.08] pl-4">
            <div className="text-[13.5px] font-medium text-ink tabular-nums">{weekRangeLabel(monday)}</div>
            <p className="mt-0.5 text-[12px] text-ink-3">
              {profile ? `Profil: ${profile.name}` : 'Kein Profil für diesen Zeitraum — Standard: Mo–Fr Betrieb'}
            </p>
          </div>
        </div>

        <div className="w-40">
          <Input
            type="date"
            value={monday}
            onChange={(e) => {
              if (!e.target.value) return
              setConfirmDelete(false)
              setMonday(mondayOf(parseISO(e.target.value)))
            }}
            title="Datum wählen — die App springt zum Montag dieser Woche"
          />
        </div>

        {week && (
          <>
            <Button
              variant={phrasingOpen ? 'primary' : 'outline'}
              onClick={() => setPhrasingFor(phrasingOpen ? null : monday)}
              title="Notizen per KI (Claude.ai, ChatGPT …) in Stichpunkte formulieren lassen — über die Zwischenablage"
            >
              <SparkleIcon size={15} /> Mit KI formulieren
            </Button>
            <Segment
              options={[
                { value: 'draft', label: 'Entwurf' },
                { value: 'done', label: 'Fertig' },
              ]}
              value={week.status}
              onChange={(status) => updateWeek(monday, (w) => ({ ...w, status }))}
            />
            {confirmDelete ? (
              <Button variant="danger" onClick={confirmDeleteWeek} onBlur={() => setConfirmDelete(false)}>
                Wirklich löschen?
              </Button>
            ) : (
              <IconButton label="Woche löschen" danger onClick={() => setConfirmDelete(true)}>
                <TrashIcon size={16} />
              </IconButton>
            )}
          </>
        )}
      </div>

      {!week ? (
        /* week doesn't exist yet: create it */
        <div className="grid flex-1 place-items-center px-8 pb-10">
          <Panel className="flex w-full max-w-md flex-col items-center gap-4 px-8 py-10 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-accent/10 text-accent">
              <CalendarPlusIcon size={24} />
            </span>
            <div className="text-[15px] font-medium">
              Für KW {weekNo}/{year} gibt es noch keinen Bericht.
            </div>
            <p className="text-[12.5px] text-ink-3">
              {profile
                ? `Die Woche wird mit dem Profil „${profile.name}" angelegt — Feiertage werden automatisch erkannt.`
                : 'Kein Profil deckt diesen Zeitraum ab; die Woche wird mit Mo–Fr Betrieb angelegt.'}
            </p>
            <div className="flex gap-2">
              <Button onClick={() => createWeek(monday, { fromTemplate: true })}>
                <CopyIcon size={15} /> Struktur der Vorwoche
              </Button>
              <Button variant="primary" onClick={() => createWeek(monday)}>
                <PlusIcon size={15} weight="bold" /> Woche anlegen
              </Button>
            </div>
          </Panel>
        </div>
      ) : (
        <div ref={gridRef} className="grid min-h-0 flex-1 grid-cols-[minmax(430px,7fr)_minmax(360px,5fr)] gap-5 px-8 pb-8">
          {/* left column: days + instructions */}
          <div ref={columnRef} className="flex min-h-0 flex-col gap-3 overflow-y-auto pr-1">
            {phrasingOpen && (
              <PhrasingPanel
                week={week}
                weeks={data.weeks}
                onApply={applyPhrasing}
                onClose={() => setPhrasingFor(null)}
              />
            )}
            {week.days.map((day) => (
              <DayCard key={day.date} day={day} onChange={(d) => updateDay(day.date, d)} suggestions={suggestions} />
            ))}
            <Panel data-daycard className="shrink-0">
              <div className="border-b border-white/[0.05] px-4 py-2.5">
                <span className="text-[14px] font-semibold">Unterweisungen</span>
                <span className="ml-2 text-[12px] text-ink-3">betrieblicher Unterricht, sonstige Schulungen</span>
              </div>
              <div className="px-4 py-3">
                <TextArea
                  rows={3}
                  value={week.instructions}
                  placeholder="Meist leer — freier Text."
                  onChange={(e) => updateWeek(monday, (w) => ({ ...w, instructions: e.target.value }))}
                />
              </div>
            </Panel>
          </div>

          {/* right column: the three output blocks */}
          <div className="flex min-h-0 flex-col gap-3 overflow-y-auto pr-1">
            <OutputBlock
              title="1 · Betriebliche Tätigkeiten"
              shortName="Betriebliche Tätigkeiten"
              text={blocks.work}
              fileName="1Betriebliche Tätigkeiten.txt"
            />
            <OutputBlock
              title="2 · Unterweisungen"
              shortName="Unterweisungen"
              text={blocks.instructions}
              fileName="2Unterweisungen, betrieblicher Unterricht, sonstige Schulungen.txt"
            />
            <OutputBlock
              title="3 · Berufsschule"
              shortName="Berufsschule"
              text={blocks.school}
              fileName="3Berufsschule (Unterrichtsthemen).txt"
            />
          </div>
        </div>
      )}
    </div>
  )
}
