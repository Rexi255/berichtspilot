// Component gallery of the design system "Kladde" (E-032) — a dev aid for
// reviewing tokens and building blocks in every mode and accent. Reached via
// "#styleguide" on the dev server or `vite preview` only (App.jsx), loaded as
// its own chunk; the installed app never shows it.
import { useState } from 'react'
import {
  CopyIcon,
  PlusIcon,
  TrashIcon,
  DotsThreeIcon,
  CaretLeftIcon,
  CaretRightIcon,
  SidebarSimpleIcon,
  NotePencilIcon,
  FileArrowDownIcon,
  CalendarBlankIcon,
} from '@phosphor-icons/react'
import { useStore } from '../store.jsx'
import {
  Button,
  IconButton,
  Input,
  TextArea,
  Select,
  Segment,
  Switch,
  Field,
  Card,
  Notice,
  StatusChip,
  DayCell,
  Badge,
  Kbd,
  Menu,
  DAY_STATE_LABELS,
} from '../ui/basics.jsx'
import { ACCENT_OPTIONS } from './Settings.jsx'

const TOKENS = ['canvas', 'sidebar', 'surface', 'surface-2', 'surface-3', 'line', 'mark', 'ink', 'ink-2', 'accent', 'on-accent']
const STATUS_TOKENS = ['draft', 'missing', 'holiday', 'sick', 'vacation', 'warn']

function Section({ title, children }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-title font-medium text-ink">{title}</h2>
      {children}
    </section>
  )
}

function Swatch({ name }) {
  return (
    <div className="flex items-center gap-2">
      <span className="h-8 w-8 shrink-0 rounded-[8px] border border-line" style={{ background: `var(--color-${name})` }} />
      <span className="text-meta text-ink-2">{name}</span>
    </div>
  )
}

export default function Styleguide() {
  const { data, setAppearance } = useStore()
  const { mode, accent } = data.settings.appearance
  const [choice, setChoice] = useState('work')
  const [on, setOn] = useState(true)

  return (
    <div className="h-full overflow-y-auto px-6 py-6">
      <div className="flex max-w-5xl flex-col gap-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-page font-medium text-ink">Styleguide „Kladde“</h1>
            <p className="mt-1 text-body text-ink-2">Alle Bausteine im aktuellen Modus und Akzent.</p>
          </div>
          <div className="flex items-center gap-2">
            <Segment
              label="Modus"
              options={[
                { value: 'dark', label: 'Dunkel' },
                { value: 'light', label: 'Hell' },
              ]}
              value={mode}
              onChange={(m) => setAppearance({ mode: m })}
            />
            <Select value={accent} onChange={(e) => setAppearance({ accent: e.target.value })} aria-label="Akzent">
              {ACCENT_OPTIONS.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </div>
        </header>

        <Section title="Farben">
          <div className="grid grid-cols-3 gap-3 md:grid-cols-6">
            {TOKENS.map((t) => (
              <Swatch key={t} name={t} />
            ))}
          </div>
          <div className="grid grid-cols-3 gap-3 md:grid-cols-6">
            {STATUS_TOKENS.map((t) => (
              <Swatch key={t} name={t} />
            ))}
          </div>
        </Section>

        <Section title="Schrift">
          <Card className="flex flex-col gap-3 p-4">
            <div className="flex items-baseline gap-4">
              <span className="font-display text-hero font-medium tabular-nums text-ink">KW 45</span>
              <span className="text-body text-ink-2 tabular-nums">02.11. – 08.11.2026</span>
            </div>
            <span className="font-display text-page font-medium text-ink">Übersicht</span>
            <span className="font-display text-figure font-medium tabular-nums text-ink">54 von 62</span>
            <span className="text-title font-medium text-ink">Mittwoch, 04.11.2026</span>
            <p className="max-w-prose text-body text-ink">
              Einrichtung eines Notebooks für einen neuen Mitarbeiter inklusive Softwareverteilung. Fließtext in
              Instrument Sans, 13 px.
            </p>
            <p className="text-meta text-ink-2">Meta-Text, 12 px · gedämpft · Schulhalbjahr 2026/27 · 1</p>
            <pre className="selectable overflow-x-auto rounded-control border border-line bg-canvas px-3 py-2 font-mono text-[12.5px] leading-5 text-ink">
              {'Mittwoch, den 04.11.2026:\n- Drucker im zweiten OG getauscht\n- Kategorien im Ticketsystem zusammengelegt'}
            </pre>
          </Card>
        </Section>

        <Section title="Buttons">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="primary">
              <PlusIcon size={16} /> KW 45 bearbeiten
            </Button>
            <Button>
              <CopyIcon size={16} /> Kopieren
            </Button>
            <Button variant="ghost">Alle anzeigen</Button>
            <Button variant="warning">Trotzdem kopieren</Button>
            <Button variant="danger">
              <TrashIcon size={16} /> Woche löschen
            </Button>
            <Button variant="primary" disabled>
              Deaktiviert
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="primary">
              Klein primär
            </Button>
            <Button size="sm">
              <CopyIcon size={14} /> Kopieren
            </Button>
            <Button size="sm" variant="ghost">
              <NotePencilIcon size={14} /> Notizen
            </Button>
            <IconButton label="Vorherige Woche" shortcut="Alt+←">
              <CaretLeftIcon size={16} />
            </IconButton>
            <IconButton label="Nächste Woche" shortcut="Alt+→">
              <CaretRightIcon size={16} />
            </IconButton>
            <IconButton label="Seitenleiste einklappen" shortcut="Strg+B">
              <SidebarSimpleIcon size={16} />
            </IconButton>
            <IconButton label="Als .txt exportieren">
              <FileArrowDownIcon size={16} />
            </IconButton>
            <IconButton label="Löschen" danger>
              <TrashIcon size={16} />
            </IconButton>
            <Menu
              label="Weitere Aktionen"
              icon={<DotsThreeIcon size={18} />}
              items={[
                { label: 'Zu Datum springen', icon: <CalendarBlankIcon size={16} />, onSelect: () => {} },
                { label: 'Woche löschen', icon: <TrashIcon size={16} />, danger: true, onSelect: () => {} },
              ]}
            />
          </div>
        </Section>

        <Section title="Eingaben">
          <Card className="grid gap-4 p-4 md:grid-cols-2">
            <Field label="Stichpunkt" hint="Enter legt einen neuen Stichpunkt an">
              <Input defaultValue="Austausch eines defekten Netzteils an einem Etagenswitch" />
            </Field>
            <Field label="Suche">
              <Input placeholder="KW oder Datum" />
            </Field>
            <Field label="Notizen">
              <TextArea rows={3} defaultValue={'Drucker im zweiten OG getauscht\nTicketsystem: Kategorien aufgeräumt'} />
            </Field>
            <div className="flex flex-col gap-3">
              <Field label="Bundesland">
                <Select defaultValue="SH">
                  <option value="SH">Schleswig-Holstein</option>
                  <option value="HH">Hamburg</option>
                </Select>
              </Field>
              <Switch checked={on} onChange={setOn} label="Notizen-Bereich anzeigen" />
              <Switch checked={!on} onChange={(v) => setOn(!v)} label="Aus" />
            </div>
          </Card>
          <Segment
            label="Typ"
            options={[
              { value: 'work', label: 'Betrieb' },
              { value: 'school', label: 'Schule' },
              { value: 'holiday', label: 'Feiertag' },
              { value: 'sick', label: 'Krank' },
              { value: 'vacation', label: 'Urlaub' },
            ]}
            value={choice}
            onChange={setChoice}
          />
        </Section>

        <Section title="Status und Tagesfelder">
          <div className="flex flex-wrap items-center gap-2">
            <StatusChip status="done" />
            <StatusChip status="draft" />
            <StatusChip status="missing" />
            <StatusChip status="draft" as="button">
              Entwurf
            </StatusChip>
            <Badge>4</Badge>
            <Badge tone="neutral">12</Badge>
          </div>
          <Card className="flex flex-col gap-4 p-4">
            {['row', 'tab', 'band'].map((size) => (
              <div key={size} className="flex flex-wrap items-center gap-2">
                <span className="w-12 text-meta text-ink-2">{size}</span>
                {[
                  ['written', 'Mo', 'B'],
                  ['written', 'Di', 'S'],
                  ['open', 'Mi', 'B'],
                  ['future', 'Do', 'S'],
                  ['holiday', 'Fr', 'F'],
                  ['sick', 'Mo', 'K'],
                  ['vacation', 'Di', 'U'],
                ].map(([state, short, letter], i) => (
                  <DayCell key={i} state={state} short={short} letter={letter} size={size} title={DAY_STATE_LABELS[state]} />
                ))}
              </div>
            ))}
          </Card>
        </Section>

        <Section title="Karten und Hinweise">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <div className="flex items-center gap-2 border-b border-line px-4 py-3">
                <span className="grid h-6 w-6 place-items-center rounded-chip border border-line text-meta font-medium tabular-nums text-ink-2">
                  1
                </span>
                <span className="mr-auto text-title font-medium text-ink">Betriebliche Tätigkeiten</span>
                <span className="text-meta tabular-nums text-ink-2">7 Zeilen</span>
                <Button size="sm">
                  <CopyIcon size={14} /> Kopieren
                </Button>
              </div>
              <pre className="selectable overflow-x-auto px-4 py-3 font-mono text-[12.5px] leading-5 text-ink">
                {'Dienstag, den 03.11.2026:\n- Installation von Windows-Updates auf den Testsystemen\n\nMittwoch, den 04.11.2026:\n- Drucker im zweiten OG getauscht'}
              </pre>
            </Card>
            <div className="flex flex-col gap-3">
              <Notice>
                Mögliche Kundendaten: <span className="font-medium">Kunden</span>, E-Mail-Adresse. Prüfe den Text vor dem
                Kopieren.
              </Notice>
              <Notice tone="info">Kein Eintrag nötig. In der Ausgabe steht „- Krankheitstag“.</Notice>
              <div className="flex flex-wrap items-center gap-3 text-meta text-ink-2">
                <span className="flex items-center gap-2">
                  Seitenleiste <Kbd keys="Strg+B" />
                </span>
                <span className="flex items-center gap-2">
                  Block kopieren <Kbd keys="Strg+1 / 2 / 3" />
                </span>
                <span className="flex items-center gap-2">
                  Tag <Kbd keys="Alt+1" />
                </span>
              </div>
            </div>
          </div>
        </Section>
      </div>
    </div>
  )
}
