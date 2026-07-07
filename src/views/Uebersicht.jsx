// Startbildschirm: Fortschritt + chronologische Liste aller Berichtswochen.
import { useEffect, useMemo, useRef } from 'react'
import Lenis from 'lenis'
import { gsap } from 'gsap'
import { PlusIcon, CopyIcon, CaretRightIcon } from '@phosphor-icons/react'
import { useStore } from '../store.jsx'
import { Knopf, Panel, Pille, AbschnittTitel, cx } from '../ui/basics.jsx'
import Logo from '../ui/Logo.jsx'
import { kalenderwoche, wochenBereichLabel, montagVon, heuteISO, parseISO } from '../lib/dates.js'
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

export default function Uebersicht({ oeffneWoche }) {
  const { daten, wocheAnlegen } = useStore()
  const scrollRef = useRef(null)
  const aktuelleMontag = montagVon(new Date())

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
    return { anzahl: wochen.length, entwuerfe, fortschritt }
  }, [daten])

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

  return (
    <div className="flex h-full flex-col">
      {/* Kopf mit Fortschritt + Aktionen */}
      <div className="px-8 pb-5 pt-7">
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
            <div className="min-w-[160px] flex-1 basis-40 sm:max-w-[220px]">
              <StatKachel wert={statistik.anzahl} label="Wochen dokumentiert" />
            </div>
            <div className="min-w-[160px] flex-1 basis-40 sm:max-w-[220px]">
              <StatKachel
                wert={statistik.entwuerfe}
                label={statistik.entwuerfe === 1 ? 'Entwurf offen' : 'Entwürfe offen'}
                farbe={statistik.entwuerfe === 0 ? 'text-fertig' : 'text-entwurf'}
              />
            </div>
            {statistik.fortschritt && (
              <div className="min-w-[160px] flex-1 basis-40 sm:max-w-[220px]">
                <FortschrittKachel jetzt={statistik.fortschritt.jetzt} gesamt={statistik.fortschritt.gesamt} />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Wochenliste */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-8 pb-8">
        {daten.wochen.length === 0 ? (
          <Panel className="flex flex-col items-center gap-3 py-16 text-center">
            <Logo size={46} className="mb-1 opacity-30" />
            <span className="text-[15px] font-medium text-tinte-2">Leg deine erste Berichtswoche an.</span>
            <span className="max-w-sm text-[12.5px] text-tinte-3">
              Die App wählt anhand des Datums automatisch das passende Halbjahres-Profil und erkennt
              Feiertage in Schleswig-Holstein von selbst.
            </span>
          </Panel>
        ) : (
          <div className="flex flex-col gap-1.5">
            {daten.wochen.map((w) => {
              const { kw, jahr } = kalenderwoche(w.id)
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
                    <div className="tabellarisch text-[11px] text-tinte-3">{jahr}</div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="tabellarisch text-[13.5px] font-medium text-tinte">
                      {wochenBereichLabel(w.id)}
                      {aktuell && <span className="ml-2 text-[11.5px] font-semibold text-akzent">Aktuelle Woche</span>}
                    </div>
                    <div className="mt-1 flex items-center gap-3">
                      <TagPunkte woche={w} />
                      {profil && <span className="truncate text-[11.5px] text-tinte-3">{profil.name}</span>}
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
