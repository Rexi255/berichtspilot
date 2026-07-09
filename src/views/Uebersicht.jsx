// Startbildschirm: Fortschritt + chronologische Liste aller Berichtswochen,
// inklusive Lücken-Erkennung, Filter, Volltextsuche und Jahres-Heatmap.
import { useEffect, useMemo, useRef, useState } from 'react'
import Lenis from 'lenis'
import { gsap } from 'gsap'
import { PlusIcon, CopyIcon, CaretRightIcon, MagnifyingGlassIcon, CaretDownIcon } from '@phosphor-icons/react'
import { useStore } from '../store.jsx'
import { Knopf, Eingabe, Segment, Panel, Pille, AbschnittTitel, cx } from '../ui/basics.jsx'
import Logo from '../ui/Logo.jsx'
import {
  kalenderwoche,
  wochenBereichLabel,
  montagVon,
  montagAusKW,
  heuteISO,
  parseISO,
  addDays,
} from '../lib/dates.js'
import { profilFuerDatum } from '../lib/model.js'

// Zahl beim Einblenden von 0 zum Zielwert hochzählen (GSAP). Liefert die ref
// für das Ziel-Element.
function useCountUp(ziel, dauer = 0.8) {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obj = { v: 0 }
    const t = gsap.to(obj, {
      v: ziel,
      duration: dauer,
      ease: 'power2.out',
      onUpdate: () => {
        el.textContent = String(Math.round(obj.v))
      },
    })
    return () => t.kill()
  }, [ziel, dauer])
  return ref
}

// Basisstil einer Stat-Kachel — „von oben beleuchtet" wie die Panels
const KACHEL =
  'relative overflow-hidden rounded-xl border border-white/[0.06] bg-flaeche/70 ' +
  'bg-gradient-to-b from-white/[0.035] to-transparent to-[45%] px-4 py-3.5 ' +
  'shadow-[inset_0_1px_0_0_oklch(1_0_0/0.05)]'

function StatKachel({ wert, label, farbe = 'text-tinte' }) {
  const ref = useCountUp(wert)
  return (
    <div className={KACHEL}>
      <div className={cx('tabellarisch text-[28px] font-semibold leading-none tracking-tight', farbe)}>
        <span ref={ref}>0</span>
      </div>
      <div className="mt-2 text-[11px] font-medium uppercase tracking-[0.06em] text-tinte-3">{label}</div>
    </div>
  )
}

function FortschrittKachel({ jetzt, gesamt }) {
  const ref = useCountUp(jetzt)
  return (
    <div className={KACHEL}>
      <div className="flex items-baseline gap-1">
        <span ref={ref} className="tabellarisch text-[28px] font-semibold leading-none tracking-tight text-akzent">
          0
        </span>
        <span className="tabellarisch text-[15px] font-medium text-tinte-3">/ {gesamt}</span>
      </div>
      <div className="mt-2 text-[11px] font-medium uppercase tracking-[0.06em] text-tinte-3">Ausbildungswoche</div>
      <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-white/[0.07]">
        <div
          className="h-full rounded-full bg-akzent/80 transition-[width] duration-700 ease-(--ease-aus)"
          style={{ width: `${Math.min(100, (jetzt / gesamt) * 100)}%` }}
        />
      </div>
    </div>
  )
}

// Zusammenfassung eines Tages für die Mini-Vorschau in der Zeile
function TagPunkte({ woche }) {
  return (
    <div className="flex items-center gap-1">
      {woche.tage.map((t) => (
        <span
          key={t.datum}
          title={`${t.datum} · ${t.typ}${t.status !== 'normal' ? ` · ${t.status}` : ''}`}
          className={cx(
            'h-1.5 w-3.5 rounded-full',
            t.status === 'feiertag' && 'bg-feiertag/70',
            t.status === 'krank' && 'bg-krank/70',
            t.status === 'urlaub' && 'bg-urlaub/70',
            t.status === 'normal' && (t.typ === 'schule' ? 'bg-akzent/80' : 'bg-tinte-3/50')
          )}
        />
      ))}
    </div>
  )
}

/* --------------------------- Volltextsuche --------------------------- */

// Liefert bei Treffer ein Text-Schnipsel für die Zeile, sonst null.
function suchTreffer(woche, anfrage) {
  const { kw } = kalenderwoche(woche.id)
  if (`kw ${kw}`.includes(anfrage) || woche.id.includes(anfrage)) return ''
  if ((woche.unterweisungen ?? '').toLowerCase().includes(anfrage)) return woche.unterweisungen
  for (const tag of woche.tage) {
    if ((tag.feiertagName ?? '').toLowerCase().includes(anfrage)) return `Feiertag: ${tag.feiertagName}`
    for (const s of tag.stichpunkte ?? []) {
      if (s.toLowerCase().includes(anfrage)) return s
    }
    for (const fach of tag.faecher ?? []) {
      if ((fach.label ?? '').toLowerCase().includes(anfrage)) return fach.label
      for (const p of fach.punkte ?? []) {
        if (p.toLowerCase().includes(anfrage)) return `${fach.label}: ${p}`
      }
    }
  }
  return null
}

/* --------------------------- Jahres-Heatmap --------------------------- */

const HEAT_FARBEN = {
  fertig: 'bg-akzent/90',
  entwurf: 'bg-entwurf/80',
  fehlt: 'bg-krank/45',
  leer: 'bg-white/[0.05]',
}

// Eine Zelle pro Kalenderwoche und Jahr — dokumentiert (fertig/Entwurf),
// fehlend (im erwarteten Zeitraum) oder außerhalb der Ausbildung.
function JahresHeatmap({ statusJeMontag, fehlendeSet, jahre, oeffneWoche }) {
  return (
    <Panel className="px-4 py-3">
      <div className="flex items-center justify-between">
        <AbschnittTitel>Jahresübersicht</AbschnittTitel>
        <div className="flex items-center gap-3">
          {[
            ['fertig', 'Fertig'],
            ['entwurf', 'Entwurf'],
            ['fehlt', 'Fehlt'],
          ].map(([key, label]) => (
            <span key={key} className="flex items-center gap-1.5 text-[10.5px] text-tinte-3">
              <span className={cx('h-2 w-2 rounded-[2px]', HEAT_FARBEN[key])} /> {label}
            </span>
          ))}
        </div>
      </div>
      <div className="mt-2.5 flex flex-col gap-1.5 overflow-x-auto pb-1">
        {jahre.map((jahr) => {
          // KW-Anzahl des Jahres (52 oder 53) über den 28. Dezember bestimmen
          const kwAnzahl = kalenderwoche(`${jahr}-12-28`).kw
          return (
            <div key={jahr} className="flex items-center gap-2">
              <span className="tabellarisch w-9 shrink-0 text-[11px] text-tinte-3">{jahr}</span>
              <div className="flex gap-[3px]">
                {Array.from({ length: kwAnzahl }, (_, i) => {
                  const kw = i + 1
                  const montag = montagAusKW(jahr, kw)
                  const status = statusJeMontag.get(montag)
                  const art = status ?? (fehlendeSet.has(montag) ? 'fehlt' : 'leer')
                  return (
                    <button
                      key={kw}
                      type="button"
                      onClick={() => oeffneWoche(montag)}
                      title={`KW ${kw}/${jahr} · ${
                        { fertig: 'Fertig', entwurf: 'Entwurf', fehlt: 'Fehlt', leer: '—' }[art]
                      }`}
                      className={cx(
                        'h-3 w-3 shrink-0 rounded-[3px] transition-transform duration-100 hover:scale-125',
                        HEAT_FARBEN[art]
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

/* ------------------------------- Ansicht ------------------------------- */

export default function Uebersicht({ oeffneWoche }) {
  const { daten, wocheAnlegen } = useStore()
  const scrollRef = useRef(null)
  const aktuelleMontag = montagVon(new Date())
  const [filter, setFilter] = useState('alle')
  const [suche, setSuche] = useState('')
  const [aufgeklappt, setAufgeklappt] = useState(() => new Set())

  // Sanftes Scrollen in der Wochenliste (Lenis)
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

  // Beim Öffnen zur aktuellen Woche scrollen + Zeilen sanft einblenden
  useEffect(() => {
    const wrapper = scrollRef.current
    if (!wrapper) return
    const ziel = wrapper.querySelector('[data-aktuell="true"]')
    if (ziel) wrapper.scrollTop = ziel.offsetTop - wrapper.clientHeight / 2 + 40
    gsap.fromTo(
      wrapper.querySelectorAll('[data-zeile]'),
      { opacity: 0, y: 6 },
      { opacity: 1, y: 0, duration: 0.3, stagger: 0.015, ease: 'power2.out', clearProps: 'all' }
    )
  }, [])

  const wochenSet = useMemo(() => new Set(daten.wochen.map((w) => w.id)), [daten.wochen])

  // Fehlende Montage zwischen Ausbildungsbeginn (sonst erstem Bericht) und der
  // Woche VOR der aktuellen — die laufende und zukünftige Wochen (auch bis zum
  // Ausbildungsende) gelten nicht als fehlend.
  const fehlende = useMemo(() => {
    const start = daten.einstellungen.ausbildungVon
      ? montagVon(parseISO(daten.einstellungen.ausbildungVon))
      : daten.wochen[0]?.id
    if (!start) return []
    let ende = addDays(aktuelleMontag, -7)
    if (daten.einstellungen.ausbildungBis) {
      const letzteWoche = montagVon(parseISO(daten.einstellungen.ausbildungBis))
      if (letzteWoche < ende) ende = letzteWoche
    }
    const liste = []
    for (let m = start; m <= ende; m = addDays(m, 7)) {
      if (!wochenSet.has(m)) liste.push(m)
    }
    return liste
  }, [daten, wochenSet, aktuelleMontag])
  const fehlendeSet = useMemo(() => new Set(fehlende), [fehlende])

  const statistik = useMemo(() => {
    const wochen = daten.wochen
    const entwuerfe = wochen.filter((w) => w.status !== 'fertig').length
    const { ausbildungVon, ausbildungBis } = daten.einstellungen
    let fortschritt = null
    if (ausbildungVon && ausbildungBis && ausbildungBis > ausbildungVon) {
      const woche = (iso) => Math.floor((parseISO(iso) - parseISO(montagVon(parseISO(ausbildungVon)))) / (7 * 86400000)) + 1
      const gesamt = woche(ausbildungBis)
      const jetzt = Math.min(Math.max(woche(heuteISO()), 1), gesamt)
      fortschritt = { jetzt, gesamt }
    }
    // Serie: dokumentierte Wochen am Stück, rückwärts ab der aktuellen Woche
    let streak = 0
    let m = wochenSet.has(aktuelleMontag) ? aktuelleMontag : addDays(aktuelleMontag, -7)
    while (wochenSet.has(m)) {
      streak++
      m = addDays(m, -7)
    }
    return { anzahl: wochen.length, entwuerfe, fortschritt, streak }
  }, [daten, wochenSet, aktuelleMontag])

  // Sichtbare Zeilen: gefilterte/gesuchte Wochen + (nur ungefiltert) die Lücken,
  // aufeinanderfolgende fehlende Wochen zu einem Block zusammengefasst.
  const zeilen = useMemo(() => {
    const anfrage = suche.trim().toLowerCase()
    const eintraege = []
    for (const w of daten.wochen) {
      if (filter === 'entwurf' && w.status === 'fertig') continue
      if (filter === 'fertig' && w.status !== 'fertig') continue
      let snippet = null
      if (anfrage) {
        snippet = suchTreffer(w, anfrage)
        if (snippet === null) continue
      }
      eintraege.push({ art: 'woche', id: w.id, woche: w, snippet })
    }
    if (filter === 'alle' && !anfrage) {
      let block = null
      for (const m of fehlende) {
        if (block && addDays(block.bis, 7) === m) {
          block.montage.push(m)
          block.bis = m
        } else {
          block = { art: 'luecke', id: m, montage: [m], bis: m }
          eintraege.push(block)
        }
      }
    }
    eintraege.sort((a, b) => (a.id < b.id ? -1 : 1))

    // Jahres-Zwischenüberschriften einstreuen (nach KW-Jahr der Woche)
    const mitJahren = []
    let letztesJahr = null
    for (const e of eintraege) {
      const { jahr } = kalenderwoche(e.id)
      if (jahr !== letztesJahr) {
        mitJahren.push({ art: 'jahr', id: `jahr-${jahr}`, jahr })
        letztesJahr = jahr
      }
      mitJahren.push(e)
    }
    return mitJahren
  }, [daten.wochen, fehlende, filter, suche])

  // Jahre für die Heatmap: vom Start (Ausbildung/erster Bericht) bis heute/letzter Bericht
  const heatmap = useMemo(() => {
    if (daten.wochen.length === 0 && fehlende.length === 0) return null
    const statusJeMontag = new Map(daten.wochen.map((w) => [w.id, w.status === 'fertig' ? 'fertig' : 'entwurf']))
    const ids = [...statusJeMontag.keys(), ...fehlende, aktuelleMontag].sort()
    const vonJahr = kalenderwoche(ids[0]).jahr
    const bisJahr = kalenderwoche(ids[ids.length - 1]).jahr
    const jahre = []
    for (let j = vonJahr; j <= bisJahr; j++) jahre.push(j)
    return { statusJeMontag, jahre }
  }, [daten.wochen, fehlende, aktuelleMontag])

  const neueAktuelleWoche = (ausVorlage) => {
    // Nächste noch nicht dokumentierte Woche ab der aktuellen suchen
    let montag = aktuelleMontag
    while (daten.wochen.some((w) => w.id === montag)) {
      const d = parseISO(montag)
      d.setDate(d.getDate() + 7)
      montag = montagVon(d)
    }
    wocheAnlegen(montag, { ausVorlage })
    oeffneWoche(montag)
  }

  const lueckeAnlegen = (montag) => {
    wocheAnlegen(montag)
    oeffneWoche(montag)
  }

  return (
    <div className="flex h-full flex-col">
      {/* Kopf mit Fortschritt + Aktionen */}
      <div className="px-8 pb-4 pt-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-[22px] font-semibold tracking-tight">Übersicht</h1>
            <p className="mt-1 text-[13px] text-tinte-2">
              {statistik.anzahl === 0
                ? 'Noch keine Berichtswochen angelegt.'
                : 'Alle bisher geschriebenen Berichtswochen — chronologisch.'}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Knopf onClick={() => neueAktuelleWoche(true)}>
              <CopyIcon size={15} /> Struktur der Vorwoche übernehmen
            </Knopf>
            <Knopf variante="primaer" onClick={() => neueAktuelleWoche(false)}>
              <PlusIcon size={15} weight="bold" /> Neue Woche anlegen
            </Knopf>
          </div>
        </div>

        {/* Stat-Kacheln (Dashboard-Charakter) */}
        {statistik.anzahl > 0 && (
          <div className="mt-5 flex flex-wrap gap-3">
            <div className="min-w-[150px] flex-1 basis-36 sm:max-w-[200px]">
              <StatKachel wert={statistik.anzahl} label="Wochen dokumentiert" />
            </div>
            <div className="min-w-[150px] flex-1 basis-36 sm:max-w-[200px]">
              <StatKachel
                wert={statistik.entwuerfe}
                label={statistik.entwuerfe === 1 ? 'Entwurf offen' : 'Entwürfe offen'}
                farbe={statistik.entwuerfe === 0 ? 'text-fertig' : 'text-entwurf'}
              />
            </div>
            {fehlende.length > 0 && (
              <div className="min-w-[150px] flex-1 basis-36 sm:max-w-[200px]">
                <StatKachel
                  wert={fehlende.length}
                  label={fehlende.length === 1 ? 'Woche fehlt' : 'Wochen fehlen'}
                  farbe="text-krank"
                />
              </div>
            )}
            <div className="min-w-[150px] flex-1 basis-36 sm:max-w-[200px]">
              <StatKachel wert={statistik.streak} label="Wochen in Serie" farbe="text-akzent" />
            </div>
            {statistik.fortschritt && (
              <div className="min-w-[150px] flex-1 basis-36 sm:max-w-[200px]">
                <FortschrittKachel jetzt={statistik.fortschritt.jetzt} gesamt={statistik.fortschritt.gesamt} />
              </div>
            )}
          </div>
        )}

        {/* Suche + Statusfilter */}
        {statistik.anzahl > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <div className="relative min-w-52 flex-1 sm:max-w-xs">
              <MagnifyingGlassIcon
                size={15}
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-tinte-3"
              />
              <Eingabe
                value={suche}
                onChange={(e) => setSuche(e.target.value)}
                placeholder="Stichpunkte, Fächer, Feiertage durchsuchen …"
                className="h-8 pl-8 text-[12.5px]"
              />
            </div>
            <Segment
              groesse="sm"
              optionen={[
                { wert: 'alle', label: 'Alle' },
                { wert: 'entwurf', label: 'Entwürfe' },
                { wert: 'fertig', label: 'Fertig' },
              ]}
              wert={filter}
              onWert={setFilter}
            />
          </div>
        )}
      </div>

      {/* Wochenliste */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-8 pb-8">
        {heatmap && (
          <div className="mb-4">
            <JahresHeatmap
              statusJeMontag={heatmap.statusJeMontag}
              fehlendeSet={fehlendeSet}
              jahre={heatmap.jahre}
              oeffneWoche={oeffneWoche}
            />
          </div>
        )}

        {daten.wochen.length === 0 ? (
          <Panel className="flex flex-col items-center gap-3 py-16 text-center">
            <Logo size={46} className="mb-1 opacity-30" />
            <span className="text-[15px] font-medium text-tinte-2">Leg deine erste Berichtswoche an.</span>
            <span className="max-w-sm text-[12.5px] text-tinte-3">
              Die App wählt anhand des Datums automatisch das passende Halbjahres-Profil und erkennt
              Feiertage in Schleswig-Holstein von selbst.
            </span>
          </Panel>
        ) : zeilen.filter((z) => z.art !== 'jahr').length === 0 ? (
          <Panel className="flex flex-col items-center gap-2 py-12 text-center">
            <span className="text-[14px] font-medium text-tinte-2">Keine Treffer.</span>
            <span className="text-[12.5px] text-tinte-3">Suche oder Filter anpassen.</span>
          </Panel>
        ) : (
          <div className="flex flex-col gap-1.5">
            {zeilen.map((zeile) => {
              if (zeile.art === 'jahr') {
                return (
                  <div key={zeile.id} className="mt-3 flex items-center gap-3 px-1 first:mt-0">
                    <span className="tabellarisch text-[12px] font-semibold text-tinte-2">{zeile.jahr}</span>
                    <span className="h-px flex-1 bg-white/[0.06]" />
                  </div>
                )
              }

              if (zeile.art === 'luecke') {
                const einzeln = zeile.montage.length <= 2 || aufgeklappt.has(zeile.id)
                if (!einzeln) {
                  const { kw: kwVon } = kalenderwoche(zeile.montage[0])
                  const { kw: kwBis } = kalenderwoche(zeile.bis)
                  return (
                    <button
                      key={zeile.id}
                      type="button"
                      data-zeile
                      onClick={() => setAufgeklappt((s) => new Set(s).add(zeile.id))}
                      className="flex items-center gap-3 rounded-xl border border-dashed border-krank/25 bg-krank/[0.04] px-4 py-2.5 text-left transition-colors duration-150 hover:bg-krank/[0.08]"
                    >
                      <span className="text-[12.5px] font-medium text-krank/90">
                        {zeile.montage.length} Wochen fehlen
                      </span>
                      <span className="tabellarisch text-[12px] text-tinte-3">
                        KW {kwVon} – KW {kwBis}
                      </span>
                      <CaretDownIcon size={13} className="ml-auto text-tinte-3" />
                    </button>
                  )
                }
                return zeile.montage.map((montag) => {
                  const { kw } = kalenderwoche(montag)
                  return (
                    <div
                      key={montag}
                      data-zeile
                      className="group flex items-center gap-4 rounded-xl border border-dashed border-krank/25 bg-krank/[0.04] px-4 py-2.5 transition-colors duration-150 hover:bg-krank/[0.08]"
                    >
                      <div className="w-14 shrink-0">
                        <div className="tabellarisch text-[14px] font-semibold leading-tight text-krank/90">
                          KW {kw}
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="tabellarisch text-[12.5px] text-tinte-3">{wochenBereichLabel(montag)}</span>
                        <span className="ml-2 text-[11.5px] font-medium text-krank/80">fehlt</span>
                      </div>
                      <Knopf groesse="sm" onClick={() => lueckeAnlegen(montag)}>
                        <PlusIcon size={13} weight="bold" /> Anlegen
                      </Knopf>
                    </div>
                  )
                })
              }

              const w = zeile.woche
              const { kw } = kalenderwoche(w.id)
              const aktuell = w.id === aktuelleMontag
              const profil = profilFuerDatum(daten.profile, w.id)
              return (
                <button
                  key={w.id}
                  type="button"
                  data-zeile
                  data-aktuell={aktuell}
                  onClick={() => oeffneWoche(w.id)}
                  className={cx(
                    'group flex items-center gap-4 rounded-xl border px-4 py-3 text-left',
                    'transition-[background-color,border-color,transform] duration-150 ease-(--ease-aus)',
                    aktuell
                      ? 'border-akzent/25 bg-akzent/[0.07] hover:bg-akzent/[0.1]'
                      : 'border-white/[0.05] bg-flaeche/60 hover:border-white/[0.1] hover:bg-flaeche-2/70'
                  )}
                >
                  <div className="w-14 shrink-0">
                    <div className="tabellarisch text-[16px] font-semibold leading-tight">KW {kw}</div>
                    <div className="tabellarisch text-[11px] text-tinte-3">{kalenderwoche(w.id).jahr}</div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="tabellarisch text-[13.5px] font-medium text-tinte">
                      {wochenBereichLabel(w.id)}
                      {aktuell && <span className="ml-2 text-[11.5px] font-semibold text-akzent">Aktuelle Woche</span>}
                    </div>
                    <div className="mt-1 flex items-center gap-3">
                      <TagPunkte woche={w} />
                      {zeile.snippet ? (
                        <span className="truncate text-[11.5px] text-akzent-hell">{zeile.snippet}</span>
                      ) : (
                        profil && <span className="truncate text-[11.5px] text-tinte-3">{profil.name}</span>
                      )}
                    </div>
                  </div>
                  <Pille farbe={w.status === 'fertig' ? 'fertig' : 'entwurf'}>
                    {w.status === 'fertig' ? 'Fertig' : 'Entwurf'}
                  </Pille>
                  <CaretRightIcon
                    size={15}
                    className="text-tinte-3 transition-transform duration-150 ease-(--ease-aus) group-hover:translate-x-0.5 group-hover:text-tinte-2"
                  />
                </button>
              )
            })}
          </div>
        )}

        {/* Legende */}
        {daten.wochen.length > 0 && (
          <div className="mt-5 flex items-center gap-4 px-1">
            <AbschnittTitel>Tage:</AbschnittTitel>
            {[
              ['bg-tinte-3/50', 'Betrieb'],
              ['bg-akzent/80', 'Schule'],
              ['bg-feiertag/70', 'Feiertag'],
              ['bg-krank/70', 'Krank'],
              ['bg-urlaub/70', 'Urlaub'],
            ].map(([farbe, label]) => (
              <span key={label} className="flex items-center gap-1.5 text-[11px] text-tinte-3">
                <span className={cx('h-1.5 w-3.5 rounded-full', farbe)} /> {label}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
