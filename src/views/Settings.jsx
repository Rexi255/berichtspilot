// Settings: appearance (color themes), behavior (start view), snippets
// (autocomplete templates), connections (WebUntis), data location and a
// keyboard shortcut reference.
// Each theme card carries data-theme={id} itself; that way its preview colors
// (bg-base, bg-accent …) render in that theme automatically — without
// duplicating the color values in JS.
import { useEffect, useState } from 'react'
import {
  CheckIcon,
  PaletteIcon,
  SlidersHorizontalIcon,
  TextAaIcon,
  FolderOpenIcon,
  KeyboardIcon,
  PlusIcon,
  XIcon,
  PlugsConnectedIcon,
  ShieldCheckIcon,
  SignInIcon,
  SignOutIcon,
  CircleNotchIcon,
  ArrowClockwiseIcon,
} from '@phosphor-icons/react'
import { useStore, api } from '../store.jsx'
import { SectionTitle, Button, IconButton, Input, Segment, Panel, Pill, Switch, cx } from '../ui/basics.jsx'
import { showToast } from '../ui/toast.jsx'

// Order + labels of the themes; the colors live in index.css.
export const THEMES = [
  { id: 'northern-lights', name: 'Nordlicht', description: 'Kühles Blau · Eis-Cyan' },
  { id: 'polar-night', name: 'Polarnacht', description: 'Tiefes Violett · Indigo' },
  { id: 'forest', name: 'Waldgrün', description: 'Dunkles Grün · Smaragd' },
  { id: 'amber', name: 'Bernstein', description: 'Warmes Braun · Gold' },
  { id: 'rose', name: 'Rosé', description: 'Gedämpftes Rosé · Magenta' },
  { id: 'graphite', name: 'Graphit', description: 'Neutrales Grau · Stahl' },
]

// Miniature of an app screen in the theme's colors (purely decorative)
function ThemePreview() {
  return (
    <div className="relative h-24 overflow-hidden rounded-lg bg-base shadow-[inset_0_0_0_1px_oklch(1_0_0/0.06)]">
      {/* hint of the aurora */}
      <div
        className="absolute -right-6 -top-8 h-20 w-24 rounded-full opacity-60 blur-xl"
        style={{ background: 'var(--aurora-1)' }}
      />
      {/* sidebar */}
      <div className="absolute inset-y-0 left-0 w-1/4 border-r border-white/[0.06] bg-surface/80">
        <div className="absolute left-2 top-2.5 h-2 w-6 rounded-full bg-accent" />
        <div className="absolute left-2 top-6 h-2 w-5 rounded-full bg-ink-3/40" />
        <div className="absolute left-2 top-9 h-2 w-5 rounded-full bg-ink-3/40" />
      </div>
      {/* content card */}
      <div className="absolute bottom-2.5 left-[32%] right-2.5 top-2.5 rounded-md border border-white/[0.06] bg-surface/70 shadow-[inset_0_1px_0_0_oklch(1_0_0/0.05)]">
        <div className="absolute left-2 top-2 h-2 w-12 rounded-full bg-ink-2/70" />
        <div className="absolute left-2 top-6 flex gap-1.5">
          <div className="h-4 w-8 rounded bg-accent" />
          <div className="h-4 w-6 rounded bg-accent-deep" />
        </div>
        <div className="absolute bottom-2 left-2 right-2 h-2 rounded-full bg-white/[0.06]">
          <div className="h-full w-2/3 rounded-full bg-accent/80" />
        </div>
      </div>
    </div>
  )
}

function ThemeCard({ theme, active, onSelect }) {
  return (
    <button
      type="button"
      data-theme={theme.id}
      onClick={onSelect}
      aria-pressed={active}
      className={cx(
        'group relative flex flex-col gap-3 rounded-xl border p-3 text-left',
        'transition-[border-color,transform,box-shadow] duration-150 ease-(--ease-smooth) active:scale-[0.99]',
        active
          ? 'border-accent/60 shadow-[0_0_0_1px_var(--color-accent),0_8px_24px_-12px_var(--color-accent-deep)]'
          : 'border-white/[0.08] hover:border-white/20'
      )}
    >
      <ThemePreview />
      <div className="flex items-center justify-between gap-2 pl-0.5">
        <div className="min-w-0">
          <div className="text-[13.5px] font-semibold text-ink">{theme.name}</div>
          <div className="truncate text-[11.5px] text-ink-3">{theme.description}</div>
        </div>
        <span
          className={cx(
            'grid h-5 w-5 shrink-0 place-items-center rounded-full transition-opacity duration-150',
            active ? 'bg-accent text-inset opacity-100' : 'opacity-0'
          )}
        >
          <CheckIcon size={12} weight="bold" />
        </span>
      </div>
    </button>
  )
}

/* ------------------------------ Snippets ------------------------------ */

function SnippetEditor() {
  const { data, updateSettings } = useStore()
  const snippets = data.settings.snippets ?? []
  const [draft, setDraft] = useState('')

  const save = (list) => updateSettings({ snippets: list })
  const add = () => {
    const text = draft.trim()
    if (!text || snippets.includes(text)) return
    save([...snippets, text])
    setDraft('')
  }

  return (
    <div className="flex max-w-2xl flex-col gap-1.5">
      {snippets.map((snippet, i) => (
        <div key={i} className="group/snippet flex items-center gap-1">
          <Input
            value={snippet}
            onChange={(e) => save(snippets.map((s, j) => (j === i ? e.target.value : s)))}
            className="h-8 text-[12.5px]"
          />
          <IconButton
            label="Textbaustein entfernen"
            danger
            onClick={() => save(snippets.filter((_, j) => j !== i))}
            className="opacity-0 transition-opacity duration-150 group-focus-within/snippet:opacity-100 group-hover/snippet:opacity-100"
          >
            <XIcon size={13} />
          </IconButton>
        </div>
      ))}
      <div className="mt-1 flex items-center gap-1.5">
        <Input
          value={draft}
          placeholder="z. B. Bearbeitung von Support-Tickets im Bereich …"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          className="h-8 text-[12.5px]"
        />
        <Button size="sm" onClick={add} disabled={!draft.trim()}>
          <PlusIcon size={13} weight="bold" /> Hinzufügen
        </Button>
      </div>
    </div>
  )
}

/* ------------------------- Connections (WebUntis) ------------------------- */

const UNREACHABLE = { ok: false, loggedIn: false, error: 'WebUntis nicht erreichbar' }

// Status pill for `{ ok, loggedIn, error }` from webuntis:status|login; null = checking
function WebuntisStatus({ status }) {
  if (!status) return <Pill color="neutral">Wird geprüft …</Pill>
  if (status.loggedIn) return <Pill color="done">Angemeldet</Pill>
  if (status.ok) return <Pill color="neutral">Nicht angemeldet</Pill>
  return <Pill color="sick">{status.error || 'Status unbekannt'}</Pill>
}

function WebuntisConnection() {
  const { data, setWebuntisEnabled } = useStore()
  const enabled = data.settings.webuntis?.enabled === true
  const [status, setStatus] = useState(null)
  // Login window open or logout running. Which one is clear from the status:
  // the login button only shows while logged out, the logout button while logged in
  const [busy, setBusy] = useState(false)
  const [checks, setChecks] = useState(0) // bump → ask the main process again
  // School + host come from the main process (fixed there by the allowlist)
  const school = status?.school

  // Only ask while enabled. The main process enforces the switch itself (off =
  // no request), and answers "logged out" from memory until a login happened.
  useEffect(() => {
    if (!enabled) return
    let alive = true
    api.webuntisStatus().then(
      (res) => alive && setStatus(res),
      () => alive && setStatus(UNREACHABLE)
    )
    return () => {
      alive = false
    }
  }, [enabled, checks])

  const recheck = () => {
    setStatus(null)
    setChecks((n) => n + 1)
  }

  // Switching off also ends the session — done by the store, which syncs the
  // flag to the main process (and reports a failed logout there)
  const toggle = (on) => {
    setStatus(null)
    setWebuntisEnabled(on)
  }

  const login = async () => {
    setBusy(true)
    try {
      const res = await api.webuntisLogin()
      setStatus(res)
      if (res.loggedIn) showToast('Bei WebUntis angemeldet')
    } catch {
      setStatus({ ...UNREACHABLE, school, error: 'Anmeldefenster konnte nicht geöffnet werden' })
    } finally {
      setBusy(false)
    }
  }

  const logout = async () => {
    setBusy(true)
    try {
      const res = await api.webuntisLogout()
      if (res.ok) setStatus({ ok: true, loggedIn: false, school })
      else showToast(res.error || 'Abmelden fehlgeschlagen', { kind: 'error', duration: 5000 })
    } catch {
      showToast('Abmelden fehlgeschlagen', { kind: 'error', duration: 5000 })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Panel className="max-w-2xl">
      <div className="flex items-center gap-4 px-4 py-3">
        <div className="min-w-0 flex-1">
          <Switch checked={enabled} onChange={toggle} label="WebUntis-Import" disabled={busy} />
          <p className="mt-1 text-[12px] text-ink-3">
            Schultage, Fächer und Lehrstoff aus dem Stundenplan der Berufsschule übernehmen.
          </p>
        </div>
      </div>

      {enabled && (
        <div className="flex flex-col gap-3 border-t border-white/[0.05] px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="w-16 shrink-0 text-[12px] font-medium text-ink-2">Schule</div>
            <div className="min-w-0 truncate text-[12.5px] text-ink">
              {school ? (
                <>
                  {school.name} <span className="text-ink-3">({school.host})</span>
                </>
              ) : (
                <span className="text-ink-3">—</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-16 shrink-0 text-[12px] font-medium text-ink-2">Status</div>
            <div className="flex min-w-0 flex-1 items-center gap-1">
              <WebuntisStatus status={status} />
              {status && !status.ok && (
                <IconButton label="Erneut prüfen" onClick={recheck} disabled={busy}>
                  <ArrowClockwiseIcon size={13} />
                </IconButton>
              )}
            </div>
            {status?.loggedIn ? (
              <Button size="sm" onClick={logout} disabled={busy}>
                <SignOutIcon size={14} /> Abmelden
              </Button>
            ) : (
              <Button size="sm" variant="primary" onClick={login} disabled={!status || busy}>
                {busy ? (
                  <>
                    <CircleNotchIcon size={14} className="animate-spin" /> Anmeldefenster offen …
                  </>
                ) : (
                  <>
                    <SignInIcon size={14} /> Anmelden
                  </>
                )}
              </Button>
            )}
          </div>

          <p className="flex items-start gap-1.5 text-[11.5px] text-ink-3">
            <ShieldCheckIcon size={14} className="mt-px shrink-0" />
            <span>
              Die Anmeldung läuft in einem eigenen Fenster direkt auf der Seite der Schule —
              Berichtspilot sieht dein Passwort nie. Sie gilt, bis die App beendet wird; danach
              einfach erneut anmelden.
            </span>
          </p>
        </div>
      )}
    </Panel>
  )
}

/* ---------------------- Keyboard shortcut reference ---------------------- */

const SHORTCUTS = [
  ['Strg + 1 … 4', 'Übersicht · Editor · Profile · Einstellungen öffnen'],
  ['Alt + ← / →', 'Vorherige / nächste Woche (im Editor)'],
  ['Strg + Shift + 1 / 2 / 3', 'Block Betrieb / Unterweisungen / Berufsschule kopieren (im Editor)'],
  ['Strg + N', 'Woche anlegen, falls sie noch fehlt (im Editor)'],
  ['Enter', 'Neuer Stichpunkt unter dem aktuellen'],
  ['Backspace (leerer Punkt)', 'Stichpunkt entfernen'],
  ['↑ / ↓ (bei Vorschlägen)', 'Autocomplete-Vorschlag wählen, Enter übernimmt'],
]

/* -------------------------------- View -------------------------------- */

export default function Settings() {
  const { data, dataPath, updateSettings } = useStore()
  const activeTheme = data.settings.theme || 'northern-lights'

  return (
    <div className="flex h-full flex-col">
      <div className="px-8 pb-5 pt-7">
        <h1 className="text-[22px] font-semibold tracking-tight">Einstellungen</h1>
        <p className="mt-1 text-[13px] text-ink-2">Aussehen und Verhalten der App anpassen.</p>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-8 overflow-y-auto px-8 pb-8">
        <section className="max-w-4xl">
          <SectionTitle className="mb-1 flex items-center gap-1.5">
            <PaletteIcon size={14} /> Aussehen
          </SectionTitle>
          <p className="mb-4 text-[12.5px] text-ink-3">
            Wähle ein Farbthema — die Änderung ist sofort sichtbar und wird gespeichert.
          </p>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {THEMES.map((t) => (
              <ThemeCard
                key={t.id}
                theme={t}
                active={activeTheme === t.id}
                onSelect={() => updateSettings({ theme: t.id })}
              />
            ))}
          </div>
        </section>

        <section className="max-w-4xl">
          <SectionTitle className="mb-1 flex items-center gap-1.5">
            <SlidersHorizontalIcon size={14} /> Verhalten
          </SectionTitle>
          <p className="mb-3 text-[12.5px] text-ink-3">Mit welcher Ansicht die App startet.</p>
          <Segment
            options={[
              { value: 'overview', label: 'Übersicht' },
              { value: 'editor', label: 'Aktuelle Woche (Editor)' },
            ]}
            value={data.settings.startView ?? 'overview'}
            onChange={(startView) => updateSettings({ startView })}
          />
          <div className="mt-5">
            <Switch
              checked={data.settings.autoCreateWeek !== false}
              onChange={(autoCreateWeek) => updateSettings({ autoCreateWeek })}
              label="Aktuelle Woche beim Start anlegen"
            />
            <p className="mt-1.5 text-[12.5px] text-ink-3">
              Fehlt die laufende Woche, legt die App sie Montag bis Freitag beim Start automatisch an —
              mit Profil, Feiertagen und Urlaub, wie über „Woche anlegen“.
            </p>
          </div>
        </section>

        <section className="max-w-4xl">
          <SectionTitle className="mb-1 flex items-center gap-1.5">
            <TextAaIcon size={14} /> Textbausteine
          </SectionTitle>
          <p className="mb-3 text-[12.5px] text-ink-3">
            Wiederkehrende Formulierungen — sie erscheinen im Editor als Autocomplete-Vorschläge,
            zusätzlich zu allen bereits geschriebenen Stichpunkten.
          </p>
          <SnippetEditor />
        </section>

        <section className="max-w-4xl" data-section="connections">
          <SectionTitle className="mb-1 flex items-center gap-1.5">
            <PlugsConnectedIcon size={14} /> Verbindungen
          </SectionTitle>
          <p className="mb-3 text-[12.5px] text-ink-3">
            Optionale Online-Dienste. Ausgeschaltet funktioniert alles wie bisher — ohne Netzwerk.
          </p>
          <WebuntisConnection />
        </section>

        <section className="max-w-4xl">
          <SectionTitle className="mb-1 flex items-center gap-1.5">
            <FolderOpenIcon size={14} /> Daten
          </SectionTitle>
          <p className="mb-3 text-[12.5px] text-ink-3">
            Alle Berichte liegen in einer daten.json mit rollierenden Sicherungen (.bak1–.bak3).
            Export/Import als zusätzliches Backup findest du in der Seitenleiste.
          </p>
          <Panel className="flex max-w-2xl items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <div className="text-[12px] font-medium text-ink-2">Speicherort</div>
              <div className="truncate text-[12px] text-ink-3 tabular-nums" title={dataPath}>
                {dataPath || '—'}
              </div>
            </div>
            <Button size="sm" onClick={() => api.revealDataFile()}>
              <FolderOpenIcon size={14} /> Ordner öffnen
            </Button>
          </Panel>
        </section>

        <section className="max-w-4xl">
          <SectionTitle className="mb-1 flex items-center gap-1.5">
            <KeyboardIcon size={14} /> Tastaturkürzel
          </SectionTitle>
          <Panel className="mt-2 max-w-2xl overflow-hidden">
            {SHORTCUTS.map(([keys, effect], i) => (
              <div
                key={keys}
                className={cx(
                  'flex items-center gap-4 px-4 py-2',
                  i > 0 && 'border-t border-white/[0.05]'
                )}
              >
                <kbd className="shrink-0 rounded-md border border-white/[0.1] bg-inset/60 px-2 py-0.5 text-[11.5px] font-medium text-ink-2 tabular-nums">
                  {keys}
                </kbd>
                <span className="text-[12.5px] text-ink-3">{effect}</span>
              </div>
            ))}
          </Panel>
        </section>
      </div>
    </div>
  )
}
