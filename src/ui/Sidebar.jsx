// Navigations-Sidebar mit animiertem Aktiv-Indikator + Backup-Aktionen.
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

const EINTRAEGE = [
  { id: 'uebersicht', label: 'Übersicht', Icon: SquaresFourIcon },
  { id: 'editor', label: 'Woche bearbeiten', Icon: PencilSimpleLineIcon },
  { id: 'profile', label: 'Profile', Icon: UserGearIcon },
  { id: 'einstellungen', label: 'Einstellungen', Icon: GearSixIcon },
]

// Untertitel + Punktfarbe des Speicher-Badges je nach Zustand. Der volle
// Ablagepfad steht im Tooltip (title) des Badges.
const SPEICHER_INFO = {
  bereit: { text: 'Automatisch gesichert', punkt: 'bg-fertig' },
  speichert: { text: 'Speichert …', punkt: 'bg-entwurf' },
  gespeichert: { text: 'Automatisch gesichert', punkt: 'bg-fertig' },
  fehler: { text: 'Fehler beim Speichern!', punkt: 'bg-krank' },
}

export default function Sidebar({ ansicht, onAnsicht }) {
  const { speicherStatus, speicherPfad, exportieren, importieren } = useStore()
  const [meldung, setMeldung] = useState(null)
  const listeRef = useRef(null)
  const indikatorRef = useRef(null)

  // Aktiv-Indikator weich zur gewählten Position gleiten lassen
  useEffect(() => {
    const liste = listeRef.current
    const ziel = liste?.querySelector(`[data-nav="${ansicht}"]`)
    if (!ziel || !indikatorRef.current) return
    gsap.to(indikatorRef.current, {
      y: ziel.offsetTop,
      height: ziel.offsetHeight,
      duration: 0.35,
      ease: 'power3.out',
    })
  }, [ansicht])

  const zeigeMeldung = (text, fehler = false) => {
    setMeldung({ text, fehler })
    setTimeout(() => setMeldung(null), 3500)
  }

  const handleExport = async () => {
    const res = await exportieren()
    if (res.ok) zeigeMeldung('Backup gespeichert')
    else if (!res.abgebrochen) zeigeMeldung(res.fehler ?? 'Export fehlgeschlagen', true)
  }

  const handleImport = async () => {
    const res = await importieren()
    if (res.ok) zeigeMeldung('Daten importiert')
    else if (!res.abgebrochen) zeigeMeldung(res.fehler ?? 'Import fehlgeschlagen', true)
  }

  return (
    <aside className="flex w-[228px] shrink-0 flex-col border-r border-white/[0.06] bg-flaeche/40">
      <nav className="relative m-3 flex flex-col gap-1" ref={listeRef}>
        {/* gleitender Hintergrund des aktiven Eintrags */}
        <div
          ref={indikatorRef}
          className="pointer-events-none absolute left-0 right-0 top-0 rounded-lg border border-akzent/15 bg-akzent/[0.09]"
          style={{ height: 36 }}
        />
        {EINTRAEGE.map(({ id, label, Icon }) => {
          const aktiv = ansicht === id
          return (
            <button
              key={id}
              type="button"
              data-nav={id}
              onClick={() => onAnsicht(id)}
              className={cx(
                'relative z-10 flex h-9 items-center gap-2.5 rounded-lg px-3 text-[13px] font-medium',
                'transition-colors duration-150',
                aktiv ? 'text-akzent-hell' : 'text-tinte-2 hover:text-tinte'
              )}
            >
              <Icon size={17} weight={aktiv ? 'fill' : 'regular'} />
              {label}
            </button>
          )
        })}
      </nav>

      <div className="mt-auto flex flex-col gap-1 border-t border-white/[0.06] p-3">
        <button
          type="button"
          onClick={handleExport}
          className="flex h-8 items-center gap-2.5 rounded-lg px-3 text-[12.5px] text-tinte-3 transition-colors duration-150 hover:bg-white/[0.05] hover:text-tinte"
        >
          <DownloadSimpleIcon size={15} /> Daten exportieren
        </button>
        <button
          type="button"
          onClick={handleImport}
          className="flex h-8 items-center gap-2.5 rounded-lg px-3 text-[12.5px] text-tinte-3 transition-colors duration-150 hover:bg-white/[0.05] hover:text-tinte"
        >
          <UploadSimpleIcon size={15} /> Daten importieren
        </button>

        {/* Transiente Meldung für Export/Import */}
        <div className="min-h-[16px] px-1 pt-1 text-[11px]" aria-live="polite">
          {meldung && (
            <span className={meldung.fehler ? 'text-krank' : 'text-fertig'}>{meldung.text}</span>
          )}
        </div>

        {/* Portabel-Badge: zeigt Speicherzustand + Ablageort (voller Pfad im Tooltip) */}
        <div
          className="mt-1 flex items-center gap-2.5 rounded-lg border border-white/[0.06] bg-einsatz/50 px-2.5 py-2"
          title={speicherPfad}
        >
          <span className="relative flex h-2 w-2 shrink-0">
            {speicherStatus === 'speichert' && (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-entwurf/60" />
            )}
            <span className={cx('h-2 w-2 rounded-full', SPEICHER_INFO[speicherStatus].punkt)} />
          </span>
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block text-[11.5px] font-medium text-tinte-2">daten.json</span>
            <span className="block truncate text-[10px] text-tinte-3">
              {SPEICHER_INFO[speicherStatus].text}
            </span>
          </span>
        </div>
      </div>
    </aside>
  )
}
