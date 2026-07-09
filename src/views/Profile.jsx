// Profile-Verwaltung: Halbjahres-Profile (Wochentage, Fächer, Bundesland),
// Zeiträume (Urlaub/Schulferien) + globale Ausbildungsdaten.
import { useMemo, useState } from 'react'
import {
  PlusIcon,
  XIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  TrashIcon,
  CalendarBlankIcon,
  CopyIcon,
  WarningIcon,
  SunIcon,
} from '@phosphor-icons/react'
import { useStore } from '../store.jsx'
import { Knopf, IconKnopf, Eingabe, Auswahl, Segment, Panel, Feld, AbschnittTitel, Pille, cx } from '../ui/basics.jsx'
import { WOCHENTAG_KEYS, WOCHENTAG_LABELS, formatDE } from '../lib/dates.js'
import { BUNDESLAENDER } from '../lib/holidays.js'
import { pruefeProfile } from '../lib/model.js'

const verschieben = (arr, von, nach) => {
  if (nach < 0 || nach >= arr.length) return arr
  const kopie = [...arr]
  const [el] = kopie.splice(von, 1)
  kopie.splice(nach, 0, el)
  return kopie
}

/* --------------------- Fächer eines Schultags --------------------- */

function FaecherEditor({ faecher, onFaecher }) {
  const [neu, setNeu] = useState('')

  const hinzufuegen = () => {
    const label = neu.trim()
    if (!label) return
    onFaecher([...faecher, label])
    setNeu('')
  }

  return (
    <div className="mt-2 flex flex-col gap-1">
      {faecher.map((label, i) => (
        <div key={`${label}-${i}`} className="group/fach flex items-center gap-1">
          <span className="flex h-7 min-w-24 items-center rounded-md border border-akzent/15 bg-akzent/[0.07] px-2.5 text-[12.5px] font-medium text-akzent-hell">
            {label}
          </span>
          <div className="flex opacity-0 transition-opacity duration-150 group-hover/fach:opacity-100">
            <IconKnopf titel="Nach oben" disabled={i === 0} onClick={() => onFaecher(verschieben(faecher, i, i - 1))}>
              <ArrowUpIcon size={13} />
            </IconKnopf>
            <IconKnopf titel="Nach unten" disabled={i === faecher.length - 1} onClick={() => onFaecher(verschieben(faecher, i, i + 1))}>
              <ArrowDownIcon size={13} />
            </IconKnopf>
            <IconKnopf titel="Fach entfernen" gefahr onClick={() => onFaecher(faecher.filter((_, j) => j !== i))}>
              <XIcon size={13} />
            </IconKnopf>
          </div>
        </div>
      ))}
      <div className="mt-1 flex items-center gap-1.5">
        <Eingabe
          value={neu}
          placeholder="z. B. LF07 oder Englisch"
          onChange={(e) => setNeu(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && hinzufuegen()}
          className="h-8 max-w-52"
        />
        <Knopf groesse="sm" onClick={hinzufuegen} disabled={!neu.trim()}>
          <PlusIcon size={13} weight="bold" /> Fach
        </Knopf>
      </div>
    </div>
  )
}

/* --------------------------- Profil-Formular --------------------------- */

function ProfilFormular({ profil, onDupliziert }) {
  const { daten, profilAendern, profilLoeschen } = useStore()
  const [loeschBestaetigung, setLoeschBestaetigung] = useState(false)

  const patch = (p) => profilAendern(profil.id, (alt) => ({ ...alt, ...p }))
  const tagPatch = (key, p) =>
    profilAendern(profil.id, (alt) => ({
      ...alt,
      wochentage: { ...alt.wochentage, [key]: { ...alt.wochentage[key], ...p } },
    }))

  // Quellen für „Fächer übernehmen von …": alle Schultage mit Fächern —
  // aus diesem und allen anderen Profilen, außer dem Zieltag selbst.
  const faecherQuellen = (zielKey) => {
    const quellen = []
    for (const p of daten.profile) {
      for (const key of WOCHENTAG_KEYS) {
        const tag = p.wochentage[key]
        if (tag?.typ !== 'schule' || !(tag.faecher?.length > 0)) continue
        if (p.id === profil.id && key === zielKey) continue
        quellen.push({ profilId: p.id, key, label: `${WOCHENTAG_LABELS[key]} — ${p.name}` })
      }
    }
    return quellen
  }

  const faecherUebernehmen = (zielKey, wert) => {
    const [profilId, key] = wert.split('|')
    const quelle = daten.profile.find((p) => p.id === profilId)?.wochentage[key]
    if (quelle?.faecher?.length) tagPatch(zielKey, { faecher: [...quelle.faecher] })
  }

  return (
    <div className="flex flex-col gap-5">
      <Panel className="flex flex-col gap-4 p-5">
        <div className="flex items-end gap-3">
          <Feld label="Name des Profils" className="flex-1">
            <Eingabe value={profil.name} onChange={(e) => patch({ name: e.target.value })} />
          </Feld>
          <Knopf variante="ghost" onClick={onDupliziert} title="Kopie dieses Profils anlegen (z. B. fürs nächste Halbjahr)">
            <CopyIcon size={15} /> Duplizieren
          </Knopf>
          {loeschBestaetigung ? (
            <Knopf variante="gefahr" onClick={() => profilLoeschen(profil.id)} onBlur={() => setLoeschBestaetigung(false)}>
              Wirklich löschen?
            </Knopf>
          ) : (
            <Knopf variante="ghost" onClick={() => setLoeschBestaetigung(true)}>
              <TrashIcon size={15} /> Löschen
            </Knopf>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Feld label="Gültig von">
            <Eingabe type="date" value={profil.gueltigVon} onChange={(e) => patch({ gueltigVon: e.target.value })} />
          </Feld>
          <Feld label="Gültig bis">
            <Eingabe type="date" value={profil.gueltigBis} onChange={(e) => patch({ gueltigBis: e.target.value })} />
          </Feld>
          <Feld label="Bundesland" hinweis="steuert die Feiertage">
            <Auswahl value={profil.bundesland} onChange={(e) => patch({ bundesland: e.target.value })}>
              {BUNDESLAENDER.map((b) => (
                <option key={b.code} value={b.code}>
                  {b.name}
                </option>
              ))}
            </Auswahl>
          </Feld>
          <Feld label="Leere Stichpunkte" hinweis="Startvorlage je Betriebstag">
            <Eingabe
              type="number"
              min="1"
              max="10"
              value={profil.standardStichpunkte}
              onChange={(e) => patch({ standardStichpunkte: Math.max(1, Math.min(10, Number(e.target.value) || 1)) })}
            />
          </Feld>
        </div>
      </Panel>

      <div>
        <AbschnittTitel className="mb-2 px-1">Wochentage</AbschnittTitel>
        <div className="flex flex-col gap-1.5">
          {WOCHENTAG_KEYS.map((key) => {
            const tag = profil.wochentage[key] ?? { typ: 'frei', faecher: [] }
            return (
              <Panel key={key} className={cx('shrink-0 px-4 py-3', tag.typ === 'frei' && 'opacity-70')}>
                <div className="flex items-center gap-3">
                  <span className="w-24 text-[13.5px] font-medium">{WOCHENTAG_LABELS[key]}</span>
                  <Segment
                    groesse="sm"
                    optionen={[
                      { wert: 'betrieb', label: 'Betrieb' },
                      { wert: 'schule', label: 'Schule' },
                      { wert: 'frei', label: 'Frei' },
                    ]}
                    wert={tag.typ}
                    onWert={(typ) => tagPatch(key, { typ })}
                  />
                  <span className="text-[12px] text-tinte-3">
                    {tag.typ === 'betrieb' && '→ Block „Betriebliche Tätigkeiten"'}
                    {tag.typ === 'schule' && '→ Block „Berufsschule"'}
                    {tag.typ === 'frei' && 'wird ignoriert'}
                  </span>
                </div>
                {tag.typ === 'schule' && (
                  <>
                    <FaecherEditor faecher={tag.faecher ?? []} onFaecher={(faecher) => tagPatch(key, { faecher })} />
                    {faecherQuellen(key).length > 0 && (
                      <Auswahl
                        value=""
                        onChange={(e) => e.target.value && faecherUebernehmen(key, e.target.value)}
                        className="mt-2 h-7 text-[11.5px] text-tinte-3"
                        title="Fächerliste eines anderen Schultags in diesen Tag kopieren"
                      >
                        <option value="">Fächer übernehmen von …</option>
                        {faecherQuellen(key).map((q) => (
                          <option key={`${q.profilId}|${q.key}`} value={`${q.profilId}|${q.key}`}>
                            {q.label}
                          </option>
                        ))}
                      </Auswahl>
                    )}
                  </>
                )}
              </Panel>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/* -------------------- Zeiträume (Urlaub / Schulferien) -------------------- */

function ZeitraumPanel() {
  const { daten, zeitraumAnlegen, zeitraumAendern, zeitraumLoeschen } = useStore()

  return (
    <Panel className="flex shrink-0 flex-col gap-3 p-4">
      <AbschnittTitel className="flex items-center gap-1.5">
        <SunIcon size={13} /> Zeiträume (Urlaub / Ferien)
      </AbschnittTitel>
      {daten.zeitraeume.map((z) => (
        <div key={z.id} className="flex flex-col gap-1.5 rounded-lg border border-white/[0.06] bg-einsatz/40 p-2.5">
          <div className="flex items-center gap-1.5">
            <Auswahl
              value={z.typ}
              onChange={(e) => zeitraumAendern(z.id, { typ: e.target.value })}
              className="h-8 flex-1 text-[12.5px]"
            >
              <option value="urlaub">Urlaub</option>
              <option value="ferien">Schulferien</option>
            </Auswahl>
            <IconKnopf titel="Zeitraum löschen" gefahr onClick={() => zeitraumLoeschen(z.id)}>
              <XIcon size={13} />
            </IconKnopf>
          </div>
          <Eingabe
            value={z.label}
            placeholder="Bezeichnung (optional)"
            onChange={(e) => zeitraumAendern(z.id, { label: e.target.value })}
            className="h-8 text-[12.5px]"
          />
          <div className="grid grid-cols-2 gap-1.5">
            <Eingabe
              type="date"
              value={z.von}
              onChange={(e) => zeitraumAendern(z.id, { von: e.target.value })}
              className="h-8 text-[12px]"
            />
            <Eingabe
              type="date"
              value={z.bis}
              onChange={(e) => zeitraumAendern(z.id, { bis: e.target.value })}
              className="h-8 text-[12px]"
            />
          </div>
        </div>
      ))}
      <Knopf groesse="sm" onClick={zeitraumAnlegen} className="w-fit">
        <PlusIcon size={13} weight="bold" /> Zeitraum
      </Knopf>
      <p className="text-[11.5px] text-tinte-3">
        Urlaub setzt leere Tage im Zeitraum automatisch auf „Urlaub" (auch in bestehenden Wochen).
        Schulferien machen Schultage beim Anlegen neuer Wochen zu Betriebstagen.
      </p>
    </Panel>
  )
}

/* ------------------------------- Ansicht ------------------------------- */

export default function Profile() {
  const { daten, profilAnlegen, profilDuplizieren, einstellungenAendern } = useStore()
  const [aktivId, setAktivId] = useState(daten.profile[0]?.id ?? null)
  const aktiv = daten.profile.find((p) => p.id === aktivId) ?? daten.profile[0]

  // Warnungen zu Gültigkeitszeiträumen (Überlappungen, Lücken, fehlende Daten)
  const warnungen = useMemo(() => pruefeProfile(daten.profile), [daten.profile])

  const neuesAnlegen = () => {
    const p = profilAnlegen()
    setAktivId(p.id)
  }

  const dupliziere = () => {
    const kopie = profilDuplizieren(aktiv.id)
    if (kopie) setAktivId(kopie.id)
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-end justify-between px-8 pb-5 pt-7">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight">Profile</h1>
          <p className="mt-1 text-[13px] text-tinte-2">
            Ein Profil pro Halbjahr — die App wählt anhand des Wochendatums automatisch das passende.
          </p>
        </div>
        <Knopf variante="primaer" onClick={neuesAnlegen}>
          <PlusIcon size={15} weight="bold" /> Neues Profil
        </Knopf>
      </div>

      {warnungen.length > 0 && (
        <div className="px-8 pb-4">
          <Panel className="border-entwurf/25 bg-entwurf/[0.05] px-4 py-3">
            <div className="flex items-start gap-2.5">
              <WarningIcon size={16} className="mt-0.5 shrink-0 text-entwurf" />
              <div className="flex min-w-0 flex-col gap-1">
                {warnungen.map((w, i) => (
                  <span key={i} className="text-[12.5px] leading-snug text-tinte-2">
                    {w}
                  </span>
                ))}
              </div>
            </div>
          </Panel>
        </div>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-[280px_1fr] gap-5 px-8 pb-8">
        {/* Liste */}
        <div className="flex min-h-0 flex-col gap-3 overflow-y-auto pr-1">
          <div className="flex shrink-0 flex-col gap-1.5">
            {daten.profile.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setAktivId(p.id)}
                className={cx(
                  'flex flex-col gap-1 rounded-xl border px-4 py-3 text-left transition-colors duration-150',
                  aktiv?.id === p.id
                    ? 'border-akzent/25 bg-akzent/[0.07]'
                    : 'border-white/[0.05] bg-flaeche/60 hover:border-white/[0.1] hover:bg-flaeche-2/70'
                )}
              >
                <span className="text-[13.5px] font-medium">{p.name}</span>
                <span className="tabellarisch text-[11.5px] text-tinte-3">
                  {p.gueltigVon ? formatDE(p.gueltigVon) : '—'} bis {p.gueltigBis ? formatDE(p.gueltigBis) : '—'}
                </span>
                <div className="mt-0.5 flex gap-1">
                  {WOCHENTAG_KEYS.map((k) => {
                    const typ = p.wochentage[k]?.typ ?? 'frei'
                    if (typ === 'frei') return null
                    return (
                      <Pille key={k} punkt={false} farbe={typ === 'schule' ? 'akzent' : 'neutral'} className="px-1.5">
                        {WOCHENTAG_LABELS[k].slice(0, 2)}
                      </Pille>
                    )
                  })}
                </div>
              </button>
            ))}
          </div>

          {/* Globale Ausbildungsdaten */}
          <Panel className="flex shrink-0 flex-col gap-3 p-4">
            <AbschnittTitel className="flex items-center gap-1.5">
              <CalendarBlankIcon size={13} /> Ausbildung (optional)
            </AbschnittTitel>
            <Feld label="Beginn" hinweis="">
              <Eingabe
                type="date"
                value={daten.einstellungen.ausbildungVon}
                onChange={(e) => einstellungenAendern({ ausbildungVon: e.target.value })}
              />
            </Feld>
            <Feld label="Ende">
              <Eingabe
                type="date"
                value={daten.einstellungen.ausbildungBis}
                onChange={(e) => einstellungenAendern({ ausbildungBis: e.target.value })}
              />
            </Feld>
            <p className="text-[11.5px] text-tinte-3">
              Aktiviert in der Übersicht die Anzeige „Woche X von ca. Y".
            </p>
          </Panel>

          {/* Urlaub / Schulferien — wirken auf Status bzw. Tag-Typ neuer Wochen */}
          <ZeitraumPanel />
        </div>

        {/* Formular */}
        <div className="min-h-0 overflow-y-auto pr-1">
          {aktiv ? (
            <ProfilFormular key={aktiv.id} profil={aktiv} onDupliziert={dupliziere} />
          ) : (
            <Panel className="grid h-40 place-items-center text-[13px] text-tinte-3">
              Kein Profil vorhanden — leg eines an.
            </Panel>
          )}
        </div>
      </div>
    </div>
  )
}
