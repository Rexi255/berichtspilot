// Navigation sidebar with an animated active indicator, the update hint and
// backup actions.
import { useEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import {
  SquaresFourIcon,
  PencilSimpleLineIcon,
  UserGearIcon,
  GearSixIcon,
  DownloadSimpleIcon,
  UploadSimpleIcon,
} from '@phosphor-icons/react'
import { useStore } from '../store.jsx'
import { cx } from './basics.jsx'
import UpdateHint from './UpdateHint.jsx'

const ENTRIES = [
  { id: 'overview', label: 'Übersicht', Icon: SquaresFourIcon },
  { id: 'editor', label: 'Woche bearbeiten', Icon: PencilSimpleLineIcon },
  { id: 'profiles', label: 'Profile', Icon: UserGearIcon },
  { id: 'settings', label: 'Einstellungen', Icon: GearSixIcon },
]

// Subtitle + dot color of the save badge per state. The full storage path is
// shown in the badge's tooltip (title).
const SAVE_INFO = {
  idle: { text: 'Automatisch gesichert', dot: 'bg-done' },
  saving: { text: 'Speichert …', dot: 'bg-draft' },
  saved: { text: 'Automatisch gesichert', dot: 'bg-done' },
  error: { text: 'Fehler beim Speichern!', dot: 'bg-sick' },
}

export default function Sidebar({ view, onView }) {
  const { saveStatus, dataPath, exportData, importData } = useStore()
  const [message, setMessage] = useState(null)
  const listRef = useRef(null)
  const indicatorRef = useRef(null)

  // Let the active indicator glide to the selected entry
  useEffect(() => {
    const list = listRef.current
    const target = list?.querySelector(`[data-nav="${view}"]`)
    if (!target || !indicatorRef.current) return
    gsap.to(indicatorRef.current, {
      y: target.offsetTop,
      height: target.offsetHeight,
      duration: 0.35,
      ease: 'power3.out',
    })
  }, [view])

  const flash = (text, isError = false) => {
    setMessage({ text, isError })
    setTimeout(() => setMessage(null), 3500)
  }

  const handleExport = async () => {
    const res = await exportData()
    if (res.ok) flash('Backup gespeichert')
    else if (!res.canceled) flash(res.error ?? 'Export fehlgeschlagen', true)
  }

  const handleImport = async () => {
    const res = await importData()
    if (res.ok) flash('Daten importiert')
    else if (!res.canceled) flash(res.error ?? 'Import fehlgeschlagen', true)
  }

  return (
    <aside className="flex w-[228px] shrink-0 flex-col border-r border-white/[0.06] bg-surface/40">
      <nav className="relative m-3 flex flex-col gap-1" ref={listRef}>
        {/* sliding background of the active entry */}
        <div
          ref={indicatorRef}
          className="pointer-events-none absolute left-0 right-0 top-0 rounded-lg border border-accent/15 bg-accent/[0.09]"
          style={{ height: 36 }}
        />
        {ENTRIES.map(({ id, label, Icon }) => {
          const active = view === id
          return (
            <button
              key={id}
              type="button"
              data-nav={id}
              onClick={() => onView(id)}
              className={cx(
                'relative z-10 flex h-9 items-center gap-2.5 rounded-lg px-3 text-[13px] font-medium',
                'transition-colors duration-150',
                active ? 'text-accent-light' : 'text-ink-2 hover:text-ink'
              )}
            >
              <Icon size={17} weight={active ? 'fill' : 'regular'} />
              {label}
            </button>
          )
        })}
      </nav>

      <div className="mt-auto flex flex-col gap-1 border-t border-white/[0.06] p-3">
        <UpdateHint />
        <button
          type="button"
          onClick={handleExport}
          className="flex h-8 items-center gap-2.5 rounded-lg px-3 text-[12.5px] text-ink-3 transition-colors duration-150 hover:bg-white/[0.05] hover:text-ink"
        >
          <DownloadSimpleIcon size={15} /> Daten exportieren
        </button>
        <button
          type="button"
          onClick={handleImport}
          className="flex h-8 items-center gap-2.5 rounded-lg px-3 text-[12.5px] text-ink-3 transition-colors duration-150 hover:bg-white/[0.05] hover:text-ink"
        >
          <UploadSimpleIcon size={15} /> Daten importieren
        </button>

        {/* Transient message for export/import */}
        <div className="min-h-[16px] px-1 pt-1 text-[11px]" aria-live="polite">
          {message && (
            <span className={message.isError ? 'text-sick' : 'text-done'}>{message.text}</span>
          )}
        </div>

        {/* Storage badge: save state + location (full path in the tooltip) */}
        <div
          className="mt-1 flex items-center gap-2.5 rounded-lg border border-white/[0.06] bg-inset/50 px-2.5 py-2"
          title={dataPath}
        >
          <span className="relative flex h-2 w-2 shrink-0">
            {saveStatus === 'saving' && (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-draft/60" />
            )}
            <span className={cx('h-2 w-2 rounded-full', SAVE_INFO[saveStatus].dot)} />
          </span>
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block text-[11.5px] font-medium text-ink-2">daten.json</span>
            <span className="block truncate text-[10px] text-ink-3">
              {SAVE_INFO[saveStatus].text}
            </span>
          </span>
        </div>
      </div>
    </aside>
  )
}
