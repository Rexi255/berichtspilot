// Einstellungen: Bereich „Aussehen" mit Farbthema-Auswahl.
// Jede Theme-Karte trägt selbst data-theme={id}; dadurch rendern ihre
// Vorschau-Farben (bg-grund, bg-akzent …) automatisch im jeweiligen Theme —
// ohne die Farbwerte in JS zu duplizieren.
import { CheckIcon, PaletteIcon } from '@phosphor-icons/react'
import { useStore } from '../store.jsx'
import { AbschnittTitel, cx } from '../ui/basics.jsx'

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

export default function Einstellungen() {
  const { daten, einstellungenAendern } = useStore()
  const aktivTheme = daten.einstellungen.theme || 'nordlicht'

  return (
    <div className="flex h-full flex-col">
      <div className="px-8 pb-5 pt-7">
        <h1 className="text-[22px] font-semibold tracking-tight">Einstellungen</h1>
        <p className="mt-1 text-[13px] text-tinte-2">Aussehen und Verhalten der App anpassen.</p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-8 pb-8">
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
      </div>
    </div>
  )
}
