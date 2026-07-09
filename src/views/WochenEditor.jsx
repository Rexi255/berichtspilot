// Wochen-Editor: Tage bearbeiten, Status setzen, Ausgabe kopieren.
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
} from '@phosphor-icons/react'
import { useStore, api } from '../store.jsx'
import { Knopf, IconKnopf, Eingabe, Textbereich, Segment, Panel, Pille, AbschnittTitel, cx } from '../ui/basics.jsx'
import { zeigeToast } from '../ui/toast.jsx'
import { kalenderwoche, wochenBereichLabel, wochentagName, formatDE, montagVon, parseISO, addDays } from '../lib/dates.js'
import { feiertagAm } from '../lib/holidays.js'
import { profilFuerDatum } from '../lib/model.js'
import { formatAlle } from '../lib/format.js'

const STATUS_OPTIONEN = [
  { wert: 'normal', label: 'Normal' },
  { wert: 'feiertag', label: 'Feiertag' },
  { wert: 'krank', label: 'Krank' },
  { wert: 'urlaub', label: 'Urlaub' },
]

// Ein Array-Element verschieben (liefert neues Array)
const verschieben = (arr, von, nach) => {
  if (nach < 0 || nach >= arr.length) return arr
  const kopie = [...arr]
  const [el] = kopie.splice(von, 1)
  kopie.splice(nach, 0, el)
  return kopie
}

/* ------------------------- Stichpunkt-Liste ------------------------- */

// Eingabezeile mit Autocomplete: schlägt beim Tippen (ab 2 Zeichen) passende
// Stichpunkte aus allen bisherigen Wochen + den Textbausteinen vor.
function PunktEingabe({ punkt, platzhalter, vorschlaege, onWert, onEnter, onLeerBackspace }) {
  const [offen, setOffen] = useState(false)
  const [aktiv, setAktiv] = useState(0)

  const eingabe = punkt.trim().toLowerCase()
  const treffer =
    offen && eingabe.length >= 2
      ? vorschlaege
          .filter((v) => v.toLowerCase().includes(eingabe) && v.toLowerCase() !== eingabe)
          .slice(0, 6)
      : []

  const uebernehmen = (wert) => {
    onWert(wert)
    setOffen(false)
  }

  return (
    <div className="relative min-w-0 flex-1">
      <Eingabe
        value={punkt}
        placeholder={platzhalter}
        onChange={(e) => {
          onWert(e.target.value)
          setOffen(true)
          setAktiv(0)
        }}
        onBlur={() => setOffen(false)}
        onKeyDown={(e) => {
          if (treffer.length > 0) {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setAktiv((a) => (a + 1) % treffer.length)
              return
            }
            if (e.key === 'ArrowUp') {
              e.preventDefault()
              setAktiv((a) => (a - 1 + treffer.length) % treffer.length)
              return
            }
            if (e.key === 'Escape' || e.key === 'Tab') {
              setOffen(false)
              return
            }
            if (e.key === 'Enter') {
              e.preventDefault()
              uebernehmen(treffer[aktiv])
              return
            }
          }
          if (e.key === 'Enter') onEnter()
          // Backspace auf leerem Punkt entfernt die Zeile (aber nie die letzte)
          if (e.key === 'Backspace' && punkt === '') {
            e.preventDefault()
            onLeerBackspace()
          }
        }}
        className="h-8"
      />
      {treffer.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-lg border border-white/[0.1] bg-flaeche-2/95 shadow-[0_10px_30px_-10px_oklch(0_0_0/0.7)] backdrop-blur">
          {treffer.map((v, i) => (
            <button
              key={v}
              type="button"
              // mousedown statt click, damit das Input-blur die Liste nicht vorher schließt
              onMouseDown={(e) => {
                e.preventDefault()
                uebernehmen(v)
              }}
              onMouseEnter={() => setAktiv(i)}
              className={cx(
                'block w-full truncate px-3 py-1.5 text-left text-[12.5px]',
                i === aktiv ? 'bg-akzent/15 text-tinte' : 'text-tinte-2'
              )}
            >
              {v}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function StichpunktListe({ punkte, onPunkte, platzhalter, vorschlaege = [] }) {
  const containerRef = useRef(null)
  // Drag&Drop-Umsortierung: Index des gezogenen bzw. überfahrenen Punkts
  const [ziehIndex, setZiehIndex] = useState(null)
  const [ueberIndex, setUeberIndex] = useState(null)

  const fokusAuf = (index) => {
    requestAnimationFrame(() => {
      containerRef.current?.querySelectorAll('input')[index]?.focus()
    })
  }

  const setzen = (i, wert) => onPunkte(punkte.map((p, j) => (j === i ? wert : p)))
  const einfuegen = (nach) => {
    const kopie = [...punkte]
    kopie.splice(nach + 1, 0, '')
    onPunkte(kopie)
    fokusAuf(nach + 1)
  }
  const entfernen = (i) => {
    onPunkte(punkte.filter((_, j) => j !== i))
    fokusAuf(Math.max(0, i - 1))
  }
  const ablegen = (ziel) => {
    if (ziehIndex !== null && ziehIndex !== ziel) onPunkte(verschieben(punkte, ziehIndex, ziel))
    setZiehIndex(null)
    setUeberIndex(null)
  }

  // Zeilen aus der Zwischenablage (Zeiterfassung/WebUntis) als Stichpunkte
  // anhängen; führende Aufzählungszeichen/Nummerierungen werden entfernt.
  const ausZwischenablage = async () => {
    const text = await api.zwischenablageLesen()
    const zeilen = (text ?? '')
      .split(/\r?\n/)
      .map((z) => z.replace(/^\s*(?:[-–—•*·]|\d+[.)])\s*/, '').trim())
      .filter(Boolean)
    if (zeilen.length === 0) {
      zeigeToast('Zwischenablage enthält keinen Text', { art: 'fehler' })
      return
    }
    onPunkte([...punkte.filter((p) => p.trim()), ...zeilen])
    zeigeToast(zeilen.length === 1 ? '1 Stichpunkt eingefügt' : `${zeilen.length} Stichpunkte eingefügt`)
  }

  return (
    <div ref={containerRef} className="flex flex-col gap-1">
      {punkte.map((punkt, i) => (
        <div
          key={i}
          onDragOver={(e) => {
            if (ziehIndex === null) return
            e.preventDefault()
            setUeberIndex(i)
          }}
          onDrop={(e) => {
            e.preventDefault()
            ablegen(i)
          }}
          className={cx(
            'group/punkt flex items-center gap-1 rounded-md transition-[opacity,box-shadow] duration-150',
            ziehIndex === i && 'opacity-40',
            ueberIndex === i && ziehIndex !== null && ziehIndex !== i && 'ring-1 ring-akzent/40'
          )}
        >
          {/* Griff zum Ziehen (Reihenfolge per Drag&Drop) */}
          <button
            type="button"
            draggable
            onDragStart={(e) => {
              setZiehIndex(i)
              e.dataTransfer.effectAllowed = 'move'
            }}
            onDragEnd={() => {
              setZiehIndex(null)
              setUeberIndex(null)
            }}
            title="Zum Umsortieren ziehen"
            aria-label="Stichpunkt umsortieren"
            className="flex h-8 w-4 shrink-0 cursor-grab items-center justify-center text-tinte-3/40 transition-colors duration-150 hover:text-tinte-2 active:cursor-grabbing group-hover/punkt:text-tinte-3"
          >
            <DotsSixVerticalIcon size={14} />
          </button>
          <PunktEingabe
            punkt={punkt}
            platzhalter={platzhalter}
            vorschlaege={vorschlaege}
            onWert={(wert) => setzen(i, wert)}
            onEnter={() => einfuegen(i)}
            onLeerBackspace={() => punkte.length > 1 && entfernen(i)}
          />
          <div className="flex opacity-0 transition-opacity duration-150 group-focus-within/punkt:opacity-100 group-hover/punkt:opacity-100">
            <IconKnopf titel="Nach oben" disabled={i === 0} onClick={() => onPunkte(verschieben(punkte, i, i - 1))}>
              <ArrowUpIcon size={13} />
            </IconKnopf>
            <IconKnopf titel="Nach unten" disabled={i === punkte.length - 1} onClick={() => onPunkte(verschieben(punkte, i, i + 1))}>
              <ArrowDownIcon size={13} />
            </IconKnopf>
            <IconKnopf titel="Stichpunkt löschen" gefahr disabled={punkte.length === 1} onClick={() => entfernen(i)}>
              <XIcon size={13} />
            </IconKnopf>
          </div>
        </div>
      ))}
      <div className="mt-0.5 flex items-center gap-1">
        <button
          type="button"
          onClick={() => einfuegen(punkte.length - 1)}
          className="flex h-7 w-fit items-center gap-1.5 rounded-md px-2 text-[12px] font-medium text-tinte-3 transition-colors duration-150 hover:bg-white/[0.05] hover:text-akzent"
        >
          <PlusIcon size={13} weight="bold" /> Stichpunkt
        </button>
        <button
          type="button"
          onClick={ausZwischenablage}
          title="Zeilen aus der Zwischenablage (z. B. Zeiterfassung/WebUntis) als Stichpunkte anhängen"
          className="flex h-7 w-fit items-center gap-1.5 rounded-md px-2 text-[12px] font-medium text-tinte-3 transition-colors duration-150 hover:bg-white/[0.05] hover:text-akzent"
        >
          <ClipboardTextIcon size={13} /> Aus Zwischenablage
        </button>
      </div>
    </div>
  )
}

/* ----------------------------- Tag-Karte ----------------------------- */

function TagKarte({ tag, onTag, vorschlaege }) {
  const statusInhalt = {
    feiertag: tag.feiertagName ? `Feiertag: ${tag.feiertagName}` : 'Feiertag',
    krank: 'Krankheitstag',
    urlaub: 'Urlaub',
  }[tag.status]

  const statusSetzen = (status) => {
    // Beim Umschalten auf „Feiertag" den echten Feiertagsnamen vorschlagen
    const autoName = feiertagAm(tag.datum) || tag.feiertagName || ''
    onTag({ ...tag, status, feiertagName: status === 'feiertag' ? autoName : tag.feiertagName })
  }

  return (
    // kein overflow-hidden: das Autocomplete-Dropdown ragt über den Kartenrand
    <Panel data-tagkarte className="shrink-0">
      <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.05] px-4 py-2.5">
        <div className="mr-auto flex items-baseline gap-2">
          <span className="text-[14px] font-semibold">{wochentagName(tag.datum)}</span>
          <span className="tabellarisch text-[12px] text-tinte-3">{formatDE(tag.datum)}</span>
        </div>
        <Segment
          groesse="sm"
          optionen={[
            { wert: 'betrieb', label: 'Betrieb' },
            { wert: 'schule', label: 'Schule' },
          ]}
          wert={tag.typ}
          onWert={(typ) => onTag({ ...tag, typ })}
        />
        <Segment groesse="sm" optionen={STATUS_OPTIONEN} wert={tag.status} onWert={statusSetzen} />
      </div>

      {tag.status !== 'normal' ? (
        <div className="flex items-center gap-3 px-4 py-3.5">
          <Pille farbe={tag.status}>{statusInhalt}</Pille>
          {tag.status === 'feiertag' && (
            <Eingabe
              value={tag.feiertagName ?? ''}
              placeholder="Name des Feiertags"
              onChange={(e) => onTag({ ...tag, feiertagName: e.target.value })}
              className="h-8 max-w-60"
            />
          )}
          <span className="text-[12px] text-tinte-3">Keine Stichpunkte nötig.</span>
        </div>
      ) : tag.typ === 'betrieb' ? (
        <div className="px-4 py-3">
          <StichpunktListe
            punkte={tag.stichpunkte}
            onPunkte={(stichpunkte) => onTag({ ...tag, stichpunkte })}
            platzhalter="Tätigkeit beschreiben …"
            vorschlaege={vorschlaege.betrieb}
          />
        </div>
      ) : (
        <SchulTag tag={tag} onTag={onTag} vorschlaege={vorschlaege} />
      )}
    </Panel>
  )
}

/* --------------------------- Schultag (Fächer) --------------------------- */

function SchulTag({ tag, onTag, vorschlaege }) {
  const faecherSetzen = (faecher) => onTag({ ...tag, faecher })
  const fachSetzen = (i, fach) => faecherSetzen(tag.faecher.map((f, j) => (j === i ? fach : f)))

  return (
    <div className="flex flex-col gap-3 px-4 py-3">
      {tag.faecher.map((fach, i) => (
        <div key={i} className="rounded-lg border border-white/[0.05] bg-einsatz/30 p-2.5">
          <div className="mb-1.5 flex items-center gap-1">
            <Eingabe
              value={fach.label}
              placeholder="Fach / Lernfeld"
              onChange={(e) => fachSetzen(i, { ...fach, label: e.target.value })}
              className="h-7 max-w-44 border-transparent bg-transparent px-1.5 text-[13px] font-semibold hover:border-white/[0.1]"
            />
            <span className="mr-auto text-[12px] text-tinte-3">:</span>
            <IconKnopf titel="Fach nach oben" disabled={i === 0} onClick={() => faecherSetzen(verschieben(tag.faecher, i, i - 1))}>
              <ArrowUpIcon size={13} />
            </IconKnopf>
            <IconKnopf titel="Fach nach unten" disabled={i === tag.faecher.length - 1} onClick={() => faecherSetzen(verschieben(tag.faecher, i, i + 1))}>
              <ArrowDownIcon size={13} />
            </IconKnopf>
            <IconKnopf titel="Fach entfernen" gefahr onClick={() => faecherSetzen(tag.faecher.filter((_, j) => j !== i))}>
              <XIcon size={13} />
            </IconKnopf>
          </div>
          <StichpunktListe
            punkte={fach.punkte}
            onPunkte={(punkte) => fachSetzen(i, { ...fach, punkte })}
            platzhalter="Unterrichtsthema …"
            vorschlaege={vorschlaege.fuerFach(fach.label)}
          />
        </div>
      ))}
      <button
        type="button"
        onClick={() => faecherSetzen([...tag.faecher, { label: '', punkte: [''] }])}
        className="flex h-8 w-fit items-center gap-1.5 rounded-md px-2 text-[12.5px] font-medium text-tinte-3 transition-colors duration-150 hover:bg-white/[0.05] hover:text-akzent"
      >
        <PlusIcon size={14} weight="bold" /> Fach hinzufügen
      </button>
      <p className="text-[11.5px] text-tinte-3">
        Fächer ohne Stichpunkte werden in der Ausgabe automatisch weggelassen.
      </p>
    </div>
  )
}

/* --------------------------- Ausgabe-Block --------------------------- */

// Erkennt Tages-Header wie „Montag, den 20.04.2026:"
const IST_TAGESHEADER = /, den \d{2}\.\d{2}\.\d{4}:$/

// Farbige Vorschau: Tages-Header in Akzent, „- "-Bullets gedämpft, Fach-Labels
// (enden auf „:") kräftiger. Reines Rendering — der kopierte Text bleibt exakt.
function AusgabeVorschau({ text }) {
  if (!text) return <span className="italic text-tinte-3">— leer —</span>
  const zeilen = text.split('\n')
  return zeilen.map((zeile, i) => {
    const nl = i < zeilen.length - 1 ? '\n' : ''
    let el
    if (IST_TAGESHEADER.test(zeile)) {
      el = <span className="font-semibold text-akzent">{zeile}</span>
    } else if (zeile.startsWith('- ')) {
      el = (
        <span className="text-tinte-2">
          <span className="text-tinte-3">- </span>
          {zeile.slice(2)}
        </span>
      )
    } else if (zeile.length > 1 && zeile.endsWith(':')) {
      el = <span className="font-medium text-tinte">{zeile}</span>
    } else {
      el = <span className="text-tinte-2">{zeile}</span>
    }
    return (
      <Fragment key={i}>
        {el}
        {nl}
      </Fragment>
    )
  })
}

function AusgabeBlock({ titel, kurz, text, dateiname }) {
  const [kopiert, setKopiert] = useState(false)
  const iconRef = useRef(null)

  const kopieren = async () => {
    await navigator.clipboard.writeText(text)
    setKopiert(true)
    zeigeToast(`„${kurz}" kopiert`)
    if (iconRef.current) {
      gsap.fromTo(iconRef.current, { scale: 0.5 }, { scale: 1, duration: 0.35, ease: 'back.out(3)' })
    }
    setTimeout(() => setKopiert(false), 1600)
  }

  const exportieren = async () => {
    const res = await api.textExportieren(dateiname, text)
    if (res?.ok) zeigeToast('Als .txt gespeichert')
    else if (res && !res.abgebrochen) zeigeToast(res.fehler ?? 'Export fehlgeschlagen', { art: 'fehler' })
  }

  return (
    <Panel className="flex shrink-0 flex-col">
      <div className="flex items-center gap-1.5 border-b border-white/[0.05] py-2 pl-4 pr-2">
        <AbschnittTitel className="mr-auto">{titel}</AbschnittTitel>
        <IconKnopf titel="Als .txt exportieren" onClick={exportieren} disabled={!text}>
          <FileArrowDownIcon size={15} />
        </IconKnopf>
        <Knopf
          groesse="sm"
          variante={kopiert ? 'primaer' : 'umrandet'}
          onClick={kopieren}
          disabled={!text}
          className="w-24"
        >
          <span ref={iconRef} className="inline-flex">
            {kopiert ? <CheckIcon size={14} weight="bold" /> : <CopyIcon size={14} />}
          </span>
          {kopiert ? 'Kopiert' : 'Kopieren'}
        </Knopf>
      </div>
      <pre className="selektierbar min-h-[52px] overflow-auto whitespace-pre-wrap px-4 py-3 font-mono text-[12px] leading-relaxed text-tinte-2">
        <AusgabeVorschau text={text} />
      </pre>
    </Panel>
  )
}

/* ------------------------------ Editor ------------------------------ */

export default function WochenEditor({ montag, setMontag }) {
  const { daten, wocheAnlegen, wocheAendern, wocheLoeschen } = useStore()
  const [loeschBestaetigung, setLoeschBestaetigung] = useState(false)
  const spalteRef = useRef(null)
  const gridRef = useRef(null)
  const richtungRef = useRef(0) // -1 = zurück, +1 = vor, 0 = Sprung (Datumsauswahl)

  const woche = daten.wochen.find((w) => w.id === montag)
  const { kw, jahr } = kalenderwoche(montag)
  const profil = profilFuerDatum(daten.profile, addDays(montag, 2))
  const bloecke = useMemo(() => (woche ? formatAlle(woche) : null), [woche])

  // Autocomplete-Vorschläge: alle bisher geschriebenen Stichpunkte (Betrieb bzw.
  // je Fach) + die in den Einstellungen gepflegten Textbausteine.
  const vorschlaege = useMemo(() => {
    const betrieb = new Set(daten.einstellungen.textbausteine ?? [])
    const jeFach = new Map() // Fach-Label (klein) -> Set der Punkte
    const schuleAlle = new Set()
    for (const w of daten.wochen) {
      for (const t of w.tage) {
        for (const s of t.stichpunkte ?? []) if (s.trim()) betrieb.add(s.trim())
        for (const f of t.faecher ?? []) {
          const key = (f.label ?? '').trim().toLowerCase()
          for (const p of f.punkte ?? []) {
            if (!p.trim()) continue
            schuleAlle.add(p.trim())
            if (key) {
              if (!jeFach.has(key)) jeFach.set(key, new Set())
              jeFach.get(key).add(p.trim())
            }
          }
        }
      }
    }
    return {
      betrieb: [...betrieb],
      // Punkte des gleichen Fachs zuerst, dann alle übrigen Schul-Punkte
      fuerFach: (label) => {
        const eigene = jeFach.get((label ?? '').trim().toLowerCase()) ?? new Set()
        return [...new Set([...eigene, ...schuleAlle])]
      },
    }
  }, [daten])

  // Eine Woche vor/zurück — merkt sich die Richtung für den Slide-Übergang
  const wocheWechseln = (delta) => {
    richtungRef.current = delta > 0 ? 1 : -1
    setLoeschBestaetigung(false)
    setMontag(addDays(montag, delta))
  }

  // Wochenwechsel-Übergang: bei ←/→ gleitet der ganze Inhalt aus der
  // Navigationsrichtung herein; beim Datum-Sprung staffeln nur die Tag-Karten.
  useEffect(() => {
    const richtung = richtungRef.current
    richtungRef.current = 0
    if (!woche) return
    if (richtung !== 0 && gridRef.current) {
      gsap.fromTo(
        gridRef.current,
        { opacity: 0, x: richtung * 42 },
        { opacity: 1, x: 0, duration: 0.32, ease: 'power3.out', clearProps: 'transform,opacity' }
      )
    } else if (spalteRef.current) {
      gsap.fromTo(
        spalteRef.current.querySelectorAll('[data-tagkarte]'),
        { opacity: 0, y: 8 },
        { opacity: 1, y: 0, duration: 0.3, stagger: 0.05, ease: 'power3.out', clearProps: 'all' }
      )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [montag, !!woche])

  const tagAendern = (datum, neuerTag) =>
    wocheAendern(montag, (w) => ({ ...w, tage: w.tage.map((t) => (t.datum === datum ? neuerTag : t)) }))

  // Editor-Tastaturkürzel: Alt+←/→ Woche wechseln, Strg+Shift+1/2/3 Block
  // kopieren, Strg+N Woche anlegen. Über e.code, damit es auch mit dem
  // deutschen Layout funktioniert (Shift+1 wäre sonst „!").
  useEffect(() => {
    const kopiereBlock = async (index) => {
      if (!bloecke) return
      const eintraege = [
        ['Betriebliche Tätigkeiten', bloecke.betrieb],
        ['Unterweisungen', bloecke.unterweisungen],
        ['Berufsschule', bloecke.berufsschule],
      ]
      const [name, text] = eintraege[index]
      if (!text) {
        zeigeToast(`„${name}" ist leer`, { art: 'fehler' })
        return
      }
      await navigator.clipboard.writeText(text)
      zeigeToast(`„${name}" kopiert`)
    }

    const handler = (e) => {
      if (e.altKey && !e.ctrlKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        e.preventDefault()
        wocheWechseln(e.key === 'ArrowLeft' ? -7 : 7)
      } else if (e.ctrlKey && e.shiftKey && ['Digit1', 'Digit2', 'Digit3'].includes(e.code)) {
        e.preventDefault()
        kopiereBlock(Number(e.code.slice(-1)) - 1)
      } else if (e.ctrlKey && !e.shiftKey && !e.altKey && e.code === 'KeyN' && !woche) {
        e.preventDefault()
        wocheAnlegen(montag)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [montag, woche, bloecke])

  const wocheLoeschenBestaetigt = () => {
    wocheLoeschen(montag)
    setLoeschBestaetigung(false)
  }

  return (
    <div className="flex h-full flex-col">
      {/* Kopfzeile: Wochenwahl + Status */}
      <div className="flex flex-wrap items-center gap-3 px-8 pb-4 pt-6">
        <div className="flex items-center gap-1">
          <IconKnopf titel="Vorherige Woche" onClick={() => wocheWechseln(-7)}>
            <CaretLeftIcon size={16} />
          </IconKnopf>
          <IconKnopf titel="Nächste Woche" onClick={() => wocheWechseln(7)}>
            <CaretRightIcon size={16} />
          </IconKnopf>
        </div>
        <div className="mr-auto flex items-center gap-4">
          {/* KW als Hero-Zahl — klarer Ankerpunkt des Editors */}
          <div className="flex items-baseline gap-1.5">
            <span className="text-[12px] font-semibold uppercase tracking-[0.1em] text-tinte-3">KW</span>
            <span className="tabellarisch text-[38px] font-semibold leading-none tracking-tight">{kw}</span>
          </div>
          <div className="border-l border-white/[0.08] pl-4">
            <div className="tabellarisch text-[13.5px] font-medium text-tinte">{wochenBereichLabel(montag)}</div>
            <p className="mt-0.5 text-[12px] text-tinte-3">
              {profil ? `Profil: ${profil.name}` : 'Kein Profil für diesen Zeitraum — Standard: Mo–Fr Betrieb'}
            </p>
          </div>
        </div>

        <div className="w-40">
          <Eingabe
            type="date"
            value={montag}
            onChange={(e) => {
              if (!e.target.value) return
              setLoeschBestaetigung(false)
              setMontag(montagVon(parseISO(e.target.value)))
            }}
            title="Datum wählen — die App springt zum Montag dieser Woche"
          />
        </div>

        {woche && (
          <>
            <Segment
              optionen={[
                { wert: 'entwurf', label: 'Entwurf' },
                { wert: 'fertig', label: 'Fertig' },
              ]}
              wert={woche.status}
              onWert={(status) => wocheAendern(montag, (w) => ({ ...w, status }))}
            />
            {loeschBestaetigung ? (
              <Knopf variante="gefahr" onClick={wocheLoeschenBestaetigt} onBlur={() => setLoeschBestaetigung(false)}>
                Wirklich löschen?
              </Knopf>
            ) : (
              <IconKnopf titel="Woche löschen" gefahr onClick={() => setLoeschBestaetigung(true)}>
                <TrashIcon size={16} />
              </IconKnopf>
            )}
          </>
        )}
      </div>

      {!woche ? (
        /* Woche existiert noch nicht: anlegen */
        <div className="grid flex-1 place-items-center px-8 pb-10">
          <Panel className="flex w-full max-w-md flex-col items-center gap-4 px-8 py-10 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-akzent/10 text-akzent">
              <CalendarPlusIcon size={24} />
            </span>
            <div className="text-[15px] font-medium">
              Für KW {kw}/{jahr} gibt es noch keinen Bericht.
            </div>
            <p className="text-[12.5px] text-tinte-3">
              {profil
                ? `Die Woche wird mit dem Profil „${profil.name}" angelegt — Feiertage werden automatisch erkannt.`
                : 'Kein Profil deckt diesen Zeitraum ab; die Woche wird mit Mo–Fr Betrieb angelegt.'}
            </p>
            <div className="flex gap-2">
              <Knopf onClick={() => wocheAnlegen(montag, { ausVorlage: true })}>
                <CopyIcon size={15} /> Struktur der Vorwoche
              </Knopf>
              <Knopf variante="primaer" onClick={() => wocheAnlegen(montag)}>
                <PlusIcon size={15} weight="bold" /> Woche anlegen
              </Knopf>
            </div>
          </Panel>
        </div>
      ) : (
        <div ref={gridRef} className="grid min-h-0 flex-1 grid-cols-[minmax(430px,7fr)_minmax(360px,5fr)] gap-5 px-8 pb-8">
          {/* Linke Spalte: Tage + Unterweisungen */}
          <div ref={spalteRef} className="flex min-h-0 flex-col gap-3 overflow-y-auto pr-1">
            {woche.tage.map((tag) => (
              <TagKarte key={tag.datum} tag={tag} onTag={(t) => tagAendern(tag.datum, t)} vorschlaege={vorschlaege} />
            ))}
            <Panel data-tagkarte className="shrink-0">
              <div className="border-b border-white/[0.05] px-4 py-2.5">
                <span className="text-[14px] font-semibold">Unterweisungen</span>
                <span className="ml-2 text-[12px] text-tinte-3">betrieblicher Unterricht, sonstige Schulungen</span>
              </div>
              <div className="px-4 py-3">
                <Textbereich
                  rows={3}
                  value={woche.unterweisungen}
                  placeholder="Meist leer — freier Text."
                  onChange={(e) => wocheAendern(montag, (w) => ({ ...w, unterweisungen: e.target.value }))}
                />
              </div>
            </Panel>
          </div>

          {/* Rechte Spalte: die drei Ausgabeblöcke */}
          <div className="flex min-h-0 flex-col gap-3 overflow-y-auto pr-1">
            <AusgabeBlock
              titel="1 · Betriebliche Tätigkeiten"
              kurz="Betriebliche Tätigkeiten"
              text={bloecke.betrieb}
              dateiname="1Betriebliche Tätigkeiten.txt"
            />
            <AusgabeBlock
              titel="2 · Unterweisungen"
              kurz="Unterweisungen"
              text={bloecke.unterweisungen}
              dateiname="2Unterweisungen, betrieblicher Unterricht, sonstige Schulungen.txt"
            />
            <AusgabeBlock
              titel="3 · Berufsschule"
              kurz="Berufsschule"
              text={bloecke.berufsschule}
              dateiname="3Berufsschule (Unterrichtsthemen).txt"
            />
          </div>
        </div>
      )}
    </div>
  )
}
