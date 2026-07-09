// Einstellungen: Aussehen (Farbthemen), Verhalten (Start-Ansicht), Textbausteine
// (Autocomplete-Vorlagen), Datenablage und Tastaturkürzel-Referenz.
// Jede Theme-Karte trägt selbst data-theme={id}; dadurch rendern ihre
// Vorschau-Farben (bg-grund, bg-akzent …) automatisch im jeweiligen Theme —
// ohne die Farbwerte in JS zu duplizieren.
import { useState } from 'react'
import {
  CheckIcon,
  PaletteIcon,
  SlidersHorizontalIcon,
  TextAaIcon,
  FolderOpenIcon,
  KeyboardIcon,
  PlusIcon,
  XIcon,
} from '@phosphor-icons/react'
import { useStore, api } from '../store.jsx'
import { AbschnittTitel, Knopf, IconKnopf, Eingabe, Segment, Panel, cx } from '../ui/basics.jsx'

// Reihenfolge + Beschriftung der Themes; die Farben stehen in index.css.
export const THEMES = [
  { id: 'nordlicht', name: 'Nordlicht', beschreibung: 'Kühles Blau · Eis-Cyan' },
  { id: 'polarnacht', name: 'Polarnacht', beschreibung: 'Tiefes Violett · Indigo' },
  { id: 'waldgruen', name: 'Waldgrün', beschreibung: 'Dunkles Grün · Smaragd' },
  { id: 'bernstein', name: 'Bernstein', beschreibung: 'Warmes Braun · Gold' },
  { id: 'rose', name: 'Rosé', beschreibung: 'Gedämpftes Rosé · Magenta' },
  { id: 'graphit', name: 'Graphit', beschreibung: 'Neutrales Grau · Stahl' },
]

// Miniatur einer App-Ansicht in den Farben des Themes (rein dekorativ)
function ThemeVorschau() {
  return (
    <div className="relative h-24 overflow-hidden rounded-lg bg-grund shadow-[inset_0_0_0_1px_oklch(1_0_0/0.06)]">
      {/* Aurora-Andeutung */}
      <div
        className="absolute -right-6 -top-8 h-20 w-24 rounded-full opacity-60 blur-xl"
        style={{ background: 'var(--aurora-1)' }}
      />
      {/* Sidebar */}
      <div className="absolute inset-y-0 left-0 w-1/4 border-r border-white/[0.06] bg-flaeche/80">
        <div className="absolute left-2 top-2.5 h-2 w-6 rounded-full bg-akzent" />
        <div className="absolute left-2 top-6 h-2 w-5 rounded-full bg-tinte-3/40" />
        <div className="absolute left-2 top-9 h-2 w-5 rounded-full bg-tinte-3/40" />
      </div>
      {/* Inhaltskarte */}
      <div className="absolute bottom-2.5 left-[32%] right-2.5 top-2.5 rounded-md border border-white/[0.06] bg-flaeche/70 shadow-[inset_0_1px_0_0_oklch(1_0_0/0.05)]">
        <div className="absolute left-2 top-2 h-2 w-12 rounded-full bg-tinte-2/70" />
        <div className="absolute left-2 top-6 flex gap-1.5">
          <div className="h-4 w-8 rounded bg-akzent" />
          <div className="h-4 w-6 rounded bg-akzent-tief" />
        </div>
        <div className="absolute bottom-2 left-2 right-2 h-2 rounded-full bg-white/[0.06]">
          <div className="h-full w-2/3 rounded-full bg-akzent/80" />
        </div>
      </div>
    </div>
  )
}

function ThemeKarte({ theme, aktiv, onWaehle }) {
  return (
    <button
      type="button"
      data-theme={theme.id}
      onClick={onWaehle}
      aria-pressed={aktiv}
      className={cx(
        'group relative flex flex-col gap-3 rounded-xl border p-3 text-left',
        'transition-[border-color,transform,box-shadow] duration-150 ease-(--ease-aus) active:scale-[0.99]',
        aktiv
          ? 'border-akzent/60 shadow-[0_0_0_1px_var(--color-akzent),0_8px_24px_-12px_var(--color-akzent-tief)]'
          : 'border-white/[0.08] hover:border-white/20'
      )}
    >
      <ThemeVorschau />
      <div className="flex items-center justify-between gap-2 pl-0.5">
        <div className="min-w-0">
          <div className="text-[13.5px] font-semibold text-tinte">{theme.name}</div>
          <div className="truncate text-[11.5px] text-tinte-3">{theme.beschreibung}</div>
        </div>
        <span
          className={cx(
            'grid h-5 w-5 shrink-0 place-items-center rounded-full transition-opacity duration-150',
            aktiv ? 'bg-akzent text-einsatz opacity-100' : 'opacity-0'
          )}
        >
          <CheckIcon size={12} weight="bold" />
        </span>
      </div>
    </button>
  )
}

/* ------------------------ Textbausteine (B2) ------------------------ */

function TextbausteineEditor() {
  const { daten, einstellungenAendern } = useStore()
  const bausteine = daten.einstellungen.textbausteine ?? []
  const [neu, setNeu] = useState('')

  const setzen = (liste) => einstellungenAendern({ textbausteine: liste })
  const hinzufuegen = () => {
    const text = neu.trim()
    if (!text || bausteine.includes(text)) return
    setzen([...bausteine, text])
    setNeu('')
  }

  return (
    <div className="flex max-w-2xl flex-col gap-1.5">
      {bausteine.map((baustein, i) => (
        <div key={i} className="group/baustein flex items-center gap-1">
          <Eingabe
            value={baustein}
            onChange={(e) => setzen(bausteine.map((b, j) => (j === i ? e.target.value : b)))}
            className="h-8 text-[12.5px]"
          />
          <IconKnopf
            titel="Textbaustein entfernen"
            gefahr
            onClick={() => setzen(bausteine.filter((_, j) => j !== i))}
            className="opacity-0 transition-opacity duration-150 group-focus-within/baustein:opacity-100 group-hover/baustein:opacity-100"
          >
            <XIcon size={13} />
          </IconKnopf>
        </div>
      ))}
      <div className="mt-1 flex items-center gap-1.5">
        <Eingabe
          value={neu}
          placeholder="z. B. Bearbeitung von Support-Tickets im Bereich …"
          onChange={(e) => setNeu(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && hinzufuegen()}
          className="h-8 text-[12.5px]"
        />
        <Knopf groesse="sm" onClick={hinzufuegen} disabled={!neu.trim()}>
          <PlusIcon size={13} weight="bold" /> Hinzufügen
        </Knopf>
      </div>
    </div>
  )
}

/* --------------------- Tastaturkürzel-Referenz --------------------- */

const KUERZEL = [
  ['Strg + 1 … 4', 'Übersicht · Editor · Profile · Einstellungen öffnen'],
  ['Alt + ← / →', 'Vorherige / nächste Woche (im Editor)'],
  ['Strg + Shift + 1 / 2 / 3', 'Block Betrieb / Unterweisungen / Berufsschule kopieren (im Editor)'],
  ['Strg + N', 'Woche anlegen, falls sie noch fehlt (im Editor)'],
  ['Enter', 'Neuer Stichpunkt unter dem aktuellen'],
  ['Backspace (leerer Punkt)', 'Stichpunkt entfernen'],
  ['↑ / ↓ (bei Vorschlägen)', 'Autocomplete-Vorschlag wählen, Enter übernimmt'],
]

/* ------------------------------ Ansicht ------------------------------ */

export default function Einstellungen() {
  const { daten, speicherPfad, einstellungenAendern } = useStore()
  const aktivTheme = daten.einstellungen.theme || 'nordlicht'

  return (
    <div className="flex h-full flex-col">
      <div className="px-8 pb-5 pt-7">
        <h1 className="text-[22px] font-semibold tracking-tight">Einstellungen</h1>
        <p className="mt-1 text-[13px] text-tinte-2">Aussehen und Verhalten der App anpassen.</p>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-8 overflow-y-auto px-8 pb-8">
        <section className="max-w-4xl">
          <AbschnittTitel className="mb-1 flex items-center gap-1.5">
            <PaletteIcon size={14} /> Aussehen
          </AbschnittTitel>
          <p className="mb-4 text-[12.5px] text-tinte-3">
            Wähle ein Farbthema — die Änderung ist sofort sichtbar und wird gespeichert.
          </p>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {THEMES.map((t) => (
              <ThemeKarte
                key={t.id}
                theme={t}
                aktiv={aktivTheme === t.id}
                onWaehle={() => einstellungenAendern({ theme: t.id })}
              />
            ))}
          </div>
        </section>

        <section className="max-w-4xl">
          <AbschnittTitel className="mb-1 flex items-center gap-1.5">
            <SlidersHorizontalIcon size={14} /> Verhalten
          </AbschnittTitel>
          <p className="mb-3 text-[12.5px] text-tinte-3">Mit welcher Ansicht die App startet.</p>
          <Segment
            optionen={[
              { wert: 'uebersicht', label: 'Übersicht' },
              { wert: 'editor', label: 'Aktuelle Woche (Editor)' },
            ]}
            wert={daten.einstellungen.startAnsicht ?? 'uebersicht'}
            onWert={(startAnsicht) => einstellungenAendern({ startAnsicht })}
          />
        </section>

        <section className="max-w-4xl">
          <AbschnittTitel className="mb-1 flex items-center gap-1.5">
            <TextAaIcon size={14} /> Textbausteine
          </AbschnittTitel>
          <p className="mb-3 text-[12.5px] text-tinte-3">
            Wiederkehrende Formulierungen — sie erscheinen im Editor als Autocomplete-Vorschläge,
            zusätzlich zu allen bereits geschriebenen Stichpunkten.
          </p>
          <TextbausteineEditor />
        </section>

        <section className="max-w-4xl">
          <AbschnittTitel className="mb-1 flex items-center gap-1.5">
            <FolderOpenIcon size={14} /> Daten
          </AbschnittTitel>
          <p className="mb-3 text-[12.5px] text-tinte-3">
            Alle Berichte liegen in einer daten.json mit rollierenden Sicherungen (.bak1–.bak3).
            Export/Import als zusätzliches Backup findest du in der Seitenleiste.
          </p>
          <Panel className="flex max-w-2xl items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <div className="text-[12px] font-medium text-tinte-2">Speicherort</div>
              <div className="tabellarisch truncate text-[12px] text-tinte-3" title={speicherPfad}>
                {speicherPfad || '—'}
              </div>
            </div>
            <Knopf groesse="sm" onClick={() => api.pfadOeffnen()}>
              <FolderOpenIcon size={14} /> Ordner öffnen
            </Knopf>
          </Panel>
        </section>

        <section className="max-w-4xl">
          <AbschnittTitel className="mb-1 flex items-center gap-1.5">
            <KeyboardIcon size={14} /> Tastaturkürzel
          </AbschnittTitel>
          <Panel className="mt-2 max-w-2xl overflow-hidden">
            {KUERZEL.map(([taste, wirkung], i) => (
              <div
                key={taste}
                className={cx(
                  'flex items-center gap-4 px-4 py-2',
                  i > 0 && 'border-t border-white/[0.05]'
                )}
              >
                <kbd className="tabellarisch shrink-0 rounded-md border border-white/[0.1] bg-einsatz/60 px-2 py-0.5 text-[11.5px] font-medium text-tinte-2">
                  {taste}
                </kbd>
                <span className="text-[12.5px] text-tinte-3">{wirkung}</span>
              </div>
            ))}
          </Panel>
        </section>
      </div>
    </div>
  )
}
