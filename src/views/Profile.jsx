// Profile-Verwaltung: Halbjahres-Profile (Wochentage, Fächer, Bundesland)
// + globale Ausbildungsdaten für die Fortschrittsanzeige.
import { useState } from 'react'
import { PlusIcon, XIcon, ArrowUpIcon, ArrowDownIcon, TrashIcon, CalendarBlankIcon } from '@phosphor-icons/react'
import { useStore } from '../store.jsx'
import { Knopf, IconKnopf, Eingabe, Auswahl, Segment, Panel, Feld, AbschnittTitel, Pille, cx } from '../ui/basics.jsx'
import { WOCHENTAG_KEYS, WOCHENTAG_LABELS, formatDE } from '../lib/dates.js'
import { BUNDESLAENDER } from '../lib/holidays.js'

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

function ProfilFormular({ profil }) {
  const { profilAendern, profilLoeschen } = useStore()
  const [loeschBestaetigung, setLoeschBestaetigung] = useState(false)

  const patch = (p) => profilAendern(profil.id, (alt) => ({ ...alt, ...p }))
  const tagPatch = (key, p) =>
    profilAendern(profil.id, (alt) => ({
      ...alt,
      wochentage: { ...alt.wochentage, [key]: { ...alt.wochentage[key], ...p } },
    }))

  return (
    <div className="flex flex-col gap-5">
      <Panel className="flex flex-col gap-4 p-5">
        <div className="flex items-end gap-3">
          <Feld label="Name des Profils" className="flex-1">
            <Eingabe value={profil.name} onChange={(e) => patch({ name: e.target.value })} />
          </Feld>
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
                  <FaecherEditor faecher={tag.faecher ?? []} onFaecher={(faecher) => tagPatch(key, { faecher })} />
                )}
              </Panel>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/* ------------------------------- Ansicht ------------------------------- */

export default function Profile() {
  const { daten, profilAnlegen, einstellungenAendern } = useStore()
  const [aktivId, setAktivId] = useState(daten.profile[0]?.id ?? null)
  const aktiv = daten.profile.find((p) => p.id === aktivId) ?? daten.profile[0]

  const neuesAnlegen = () => {
    const p = profilAnlegen()
    setAktivId(p.id)
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
        </div>

        {/* Formular */}
        <div className="min-h-0 overflow-y-auto pr-1">
          {aktiv ? (
            <ProfilFormular key={aktiv.id} profil={aktiv} />
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
