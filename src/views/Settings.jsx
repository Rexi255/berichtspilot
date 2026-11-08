// Settings: appearance (mode + accent), behavior (start view), snippets
// (autocomplete templates), connections (WebUntis), updates, data location and
// a keyboard shortcut reference.
// Each accent swatch carries data-accent={id} itself; that way its preview
// colors (bg-accent …) render in that accent automatically — without
// duplicating the color values in JS.
import { useCallback, useEffect, useState } from 'react'
import {
  CheckIcon,
  FolderOpenIcon,
  PlusIcon,
  XIcon,
  ShieldCheckIcon,
  SignInIcon,
  SignOutIcon,
  CircleNotchIcon,
  ArrowClockwiseIcon,
  ClockCounterClockwiseIcon,
  DownloadSimpleIcon,
  UploadSimpleIcon,
} from '@phosphor-icons/react'
import { useStore, api } from '../store.jsx'
import { Button, Card, IconButton, Input, Segment, Panel, Pill, Switch, DayCell, Kbd, cx } from '../ui/basics.jsx'
import { showToast } from '../ui/toast.jsx'
import { UpdateAction, useUpdateActions } from '../ui/UpdateHint.jsx'
import { updateHint, updateSummary, canCheckForUpdate } from '../lib/update.js'
import { parseWebuntisAddress } from '../lib/webuntis.js'
import { BACKUP_KINDS, backupTitle, sizeLabel } from '../lib/backups.js'
import { SHORTCUT_HELP } from '../lib/shortcuts.js'

// Accents (schema v12, E-032); the colors live in index.css per mode
export const ACCENT_OPTIONS = [
  { id: 'blue', name: 'Logo-Blau' },
  { id: 'coral', name: 'Koralle' },
  { id: 'lilac', name: 'Flieder' },
  { id: 'green', name: 'Grün' },
]

// One accent, previewed in its own colors: the swatch carries data-accent
// itself, so the button and the day cells inside render in that accent
function AccentSwatch({ accent, active, onSelect }) {
  return (
    <button
      type="button"
      data-accent={accent.id}
      onClick={onSelect}
      aria-pressed={active}
      className={cx(
        'flex flex-col gap-3 rounded-card border bg-surface p-3 text-left transition-colors duration-150',
        active ? 'border-accent' : 'border-line hover:border-mark'
      )}
    >
      <span className="flex items-center gap-2" aria-hidden="true">
        <span className="inline-flex h-7 items-center rounded-control bg-accent px-2.5 text-meta font-medium text-on-accent">
          Kopieren
        </span>
        <DayCell state="written" letter="B" size="tab" />
        <DayCell state="open" letter="B" size="tab" />
      </span>
      <span className="flex items-center justify-between gap-2">
        <span className="text-body font-medium text-ink">{accent.name}</span>
        {active && <CheckIcon size={16} className="text-accent" />}
      </span>
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
            aria-label={`Textbaustein ${i + 1}`}
            onChange={(e) => save(snippets.map((s, j) => (j === i ? e.target.value : s)))}
          />
          <IconButton
            label="Textbaustein entfernen"
            danger
            onClick={() => save(snippets.filter((_, j) => j !== i))}
            className="opacity-0 transition-opacity duration-150 group-focus-within/snippet:opacity-100 group-hover/snippet:opacity-100"
          >
            <XIcon size={14} />
          </IconButton>
        </div>
      ))}
      <div className="mt-1 flex items-center gap-1.5">
        <Input
          value={draft}
          placeholder="z. B. Bearbeitung von Support-Tickets im Bereich …"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          aria-label="Neuer Textbaustein"
        />
        <Button size="sm" onClick={add} disabled={!draft.trim()}>
          <PlusIcon size={14} /> Hinzufügen
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
  if (status.code === 'no-server') return <Pill color="neutral">Adresse fehlt</Pill>
  return <Pill color="missing">{status.error || 'Status unbekannt'}</Pill>
}

// Stored host + school → an address the parser reads back the same way
const addressText = ({ host, school } = {}) =>
  host ? `https://${host}/WebUntis/${school ? `?school=${encodeURIComponent(school)}` : ''}` : ''

function WebuntisConnection() {
  const { data, setWebuntisEnabled, setWebuntisAddress } = useStore()
  const enabled = data.settings.webuntis?.enabled === true
  const host = data.settings.webuntis?.host ?? ''
  const school = data.settings.webuntis?.school ?? ''
  const [status, setStatus] = useState(null)
  // The address field: free text while typing, parsed on Enter/leaving the field
  const [draft, setDraft] = useState(() => addressText({ host, school }))
  const [addressError, setAddressError] = useState('')
  // Login window open or logout running. Which one is clear from the status:
  // the login button only shows while logged out, the logout button while logged in
  const [busy, setBusy] = useState(false)
  const [checks, setChecks] = useState(0) // bump → ask the main process again

  // The stored address changed (saved here, or by an import): show it as stored
  const stored = addressText({ host, school })
  const [shown, setShown] = useState(stored)
  if (shown !== stored) {
    setShown(stored)
    setDraft(stored)
    setAddressError('')
  }

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
  }, [enabled, host, school, checks])

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

  // Empty field = remove the address. A changed address logs out (main process)
  const commitAddress = () => {
    if (!draft.trim()) {
      if (host) setWebuntisAddress({ host: '', school: '' })
      setAddressError('')
      return
    }
    const parsed = parseWebuntisAddress(draft)
    if (!parsed.ok) {
      setAddressError(parsed.error)
      return
    }
    setAddressError('')
    setDraft(addressText(parsed))
    if (parsed.host !== host || parsed.school !== school) {
      setStatus(null)
      setWebuntisAddress({ host: parsed.host, school: parsed.school })
    }
  }

  const login = async () => {
    setBusy(true)
    try {
      const res = await api.webuntisLogin()
      setStatus(res)
      if (res.loggedIn) showToast('Bei WebUntis angemeldet')
    } catch {
      setStatus({ ...UNREACHABLE, error: 'Anmeldefenster konnte nicht geöffnet werden' })
    } finally {
      setBusy(false)
    }
  }

  const logout = async () => {
    setBusy(true)
    try {
      const res = await api.webuntisLogout()
      if (res.ok) setStatus({ ok: true, loggedIn: false })
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
          <p className="mt-1 text-meta text-ink-2">
            Schultage, Fächer und Lehrstoff aus dem Stundenplan der Berufsschule übernehmen.
          </p>
        </div>
      </div>

      {enabled && (
        <div className="flex flex-col gap-3 border-t border-line px-4 py-3">
          <div className="flex items-start gap-3">
            <label htmlFor="webuntis-address" className="mt-2 w-16 shrink-0 text-meta font-medium text-ink-2">
              Adresse
            </label>
            <div className="min-w-0 flex-1">
              <Input
                id="webuntis-address"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commitAddress}
                onKeyDown={(e) => e.key === 'Enter' && commitAddress()}
                placeholder="https://schulname.webuntis.com/WebUntis/?school=schulname"
                spellCheck={false}
                disabled={busy}
                aria-invalid={Boolean(addressError)}
                className={cx(addressError && 'border-missing')}
              />
              <p className={cx('mt-1 text-meta', addressError ? 'text-missing' : 'text-ink-2')}>
                {addressError ||
                  (host
                    ? `Server ${host}${school ? ` · Schule „${school}“` : ''}`
                    : 'Öffne die WebUntis-Anmeldeseite deiner Schule im Browser und kopiere die Adresse hierher.')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-16 shrink-0 text-meta font-medium text-ink-2">Status</div>
            <div className="flex min-w-0 flex-1 items-center gap-1">
              <WebuntisStatus status={status} />
              {status && !status.ok && status.code !== 'no-server' && (
                <IconButton label="Erneut prüfen" onClick={recheck} disabled={busy}>
                  <ArrowClockwiseIcon size={14} />
                </IconButton>
              )}
            </div>
            {status?.loggedIn ? (
              <Button size="sm" onClick={logout} disabled={busy}>
                <SignOutIcon size={14} /> Abmelden
              </Button>
            ) : (
              <Button size="sm" variant="primary" onClick={login} disabled={!status || busy || !host}>
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

          <p className="flex items-start gap-1.5 text-meta text-ink-2">
            <ShieldCheckIcon size={14} className="mt-px shrink-0" />
            <span>
              Die Anmeldung läuft in einem eigenen Fenster direkt auf der Seite der Schule. Berichtspilot sieht
              dein Passwort nie. Sie gilt, bis die App beendet wird, danach einfach erneut anmelden.
            </span>
          </p>
        </div>
      )}
    </Panel>
  )
}

/* ------------------------------- Updates ------------------------------- */

// Current version, result of the last check and the on-start switch (E-017).
// Download/install use the same actions as the sidebar hint.
function UpdateSettings() {
  const { data, updateSettings, update, checkForUpdate } = useStore()
  const actions = useUpdateActions()
  const summary = updateSummary(update)
  const hint = updateHint(update)
  const unsupported = update?.state === 'unsupported'

  return (
    <Panel className="max-w-2xl">
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="text-meta font-medium text-ink-2">
            Berichtspilot {update?.current ? `Version ${update.current}` : ''}
          </div>
          <div className="mt-1 flex min-w-0 items-center gap-2">
            <Pill color={summary.tone} className="min-w-0 max-w-full">
              <span className="truncate" title={summary.text}>
                {summary.text}
              </span>
            </Pill>
          </div>
        </div>
        {hint ? (
          <UpdateAction hint={hint} actions={actions} className="w-40 shrink-0" />
        ) : (
          <Button size="sm" onClick={() => checkForUpdate().catch(() => {})} disabled={!canCheckForUpdate(update)}>
            {update?.state === 'checking' ? (
              <CircleNotchIcon size={14} className="animate-spin" />
            ) : (
              <ArrowClockwiseIcon size={14} />
            )}
            {update?.state === 'error' ? 'Erneut suchen' : 'Nach Updates suchen'}
          </Button>
        )}
      </div>

      <div className="border-t border-line px-4 py-3">
        <Switch
          checked={data.settings.updateCheck !== false}
          onChange={(updateCheck) => updateSettings({ updateCheck })}
          label="Beim Start nach Updates suchen"
          disabled={unsupported}
        />
        <p className="mt-1.5 text-meta text-ink-2">
          Fragt bei jedem Start einmal bei GitHub nach, ob es eine neue Version gibt. Dabei wird nur die
          App-Version übertragen, keine Berichtsdaten. Heruntergeladen und installiert wird nur, wenn du
          darauf klickst.
        </p>
      </div>
    </Panel>
  )
}

/* ------------------------------- Backups ------------------------------- */

// Shown before "Alle anzeigen"
const BACKUPS_SHOWN = 5

// Snapshots in sicherungen/ (E-024): newest first, each one restorable. The
// restore itself (ask, keep the current state, replace) lives in the store.
function Backups() {
  const { restoreBackup } = useStore()
  const [backups, setBackups] = useState(null) // null = loading
  const [showAll, setShowAll] = useState(false)
  const [busy, setBusy] = useState(false)

  const reload = useCallback(
    () => api.listBackups().then((res) => setBackups(res.ok ? res.backups : []), () => setBackups([])),
    []
  )
  useEffect(() => {
    reload()
  }, [reload])

  const restore = async (backup) => {
    setBusy(true)
    try {
      const res = await restoreBackup(backup)
      if (res.ok) showToast(`Stand vom ${backupTitle(backup)} wiederhergestellt`)
      else if (!res.canceled) showToast(res.error || 'Wiederherstellen fehlgeschlagen', { kind: 'error', duration: 6000 })
    } catch {
      showToast('Wiederherstellen fehlgeschlagen', { kind: 'error', duration: 6000 })
    } finally {
      setBusy(false)
      reload()
    }
  }

  const visible = showAll ? backups : backups?.slice(0, BACKUPS_SHOWN)

  return (
    <Panel className="max-w-2xl overflow-hidden" data-section="backups">
      <div className="flex items-center gap-2 border-b border-line py-2 pl-4 pr-2">
        <ClockCounterClockwiseIcon size={16} className="text-ink-2" />
        <span className="mr-auto text-body font-medium text-ink">Sicherungen</span>
        <IconButton label="Liste aktualisieren" side="top-end" onClick={reload} disabled={busy}>
          <ArrowClockwiseIcon size={14} />
        </IconButton>
      </div>
      {backups === null ? (
        <p className="px-4 py-3 text-body text-ink-2">Wird geladen …</p>
      ) : backups.length === 0 ? (
        <p className="px-4 py-3 text-body text-ink-2">
          Noch keine Sicherung. Die erste entsteht beim ersten Speichern eines neuen Tages.
        </p>
      ) : (
        <>
          {visible.map((b, i) => (
            <div key={b.name} className={cx('flex items-center gap-3 px-4 py-2', i > 0 && 'border-t border-line')}>
              <span className="w-44 shrink-0 text-body tabular-nums text-ink">{backupTitle(b)}</span>
              <Pill color={b.reason === 'daily' ? 'neutral' : 'accent'} dot={false}>
                {BACKUP_KINDS[b.reason] ?? 'Sicherung'}
              </Pill>
              <span className="mr-auto text-meta tabular-nums text-ink-2">{sizeLabel(b.size)}</span>
              <Button size="sm" variant="ghost" onClick={() => restore(b)} disabled={busy}>
                Wiederherstellen
              </Button>
            </div>
          ))}
          {backups.length > BACKUPS_SHOWN && (
            <button
              type="button"
              onClick={() => setShowAll((all) => !all)}
              className="w-full border-t border-line px-4 py-2 text-left text-meta font-medium text-ink-2 transition-colors duration-150 hover:bg-surface-2 hover:text-ink"
            >
              {showAll ? 'Weniger anzeigen' : `Alle anzeigen (${backups.length})`}
            </button>
          )}
        </>
      )}
    </Panel>
  )
}

/* -------------------------------- View -------------------------------- */

// One settings section: heading, a sentence what it is for, the controls
function Section({ id, title, description, children }) {
  return (
    <section className="flex flex-col gap-3" data-section={id}>
      <div>
        <h2 className="text-title font-medium text-ink">{title}</h2>
        {description && <p className="mt-0.5 max-w-2xl text-body text-ink-2">{description}</p>}
      </div>
      {children}
    </section>
  )
}

export default function Settings() {
  const { data, dataPath, updateSettings, setAppearance, setLayout, openSetup, exportData, importData } = useStore()
  const { appearance, layout } = data.settings

  // Export/import of the whole record as one file (moved here from the sidebar)
  const handleExport = async () => {
    const res = await exportData()
    if (res.ok) showToast('Daten exportiert')
    else if (!res.canceled) showToast(res.error ?? 'Export fehlgeschlagen', { kind: 'error', duration: 5000 })
  }
  const handleImport = async () => {
    const res = await importData()
    if (res.ok) showToast(res.merged ? 'Daten zusammengeführt' : 'Daten importiert')
    else if (!res.canceled) showToast(res.error ?? 'Import fehlgeschlagen', { kind: 'error', duration: 5000 })
  }

  return (
    <div className="flex h-full flex-col">
      <header className="px-6 pb-4 pt-5">
        <h1 className="font-display text-page font-medium text-ink">Einstellungen</h1>
        <p className="text-meta text-ink-2">Aussehen, Verhalten, Verbindungen und deine Daten.</p>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-8">
        <div className="flex max-w-3xl flex-col gap-8">
          <Section id="appearance" title="Aussehen" description="Dunkel oder hell, dazu eine Akzentfarbe für Aktionen und erledigte Tage.">
            <Segment
              label="Modus"
              options={[
                { value: 'dark', label: 'Dunkel' },
                { value: 'light', label: 'Hell' },
              ]}
              value={appearance.mode}
              onChange={(mode) => setAppearance({ mode })}
              className="w-fit"
            />
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {ACCENT_OPTIONS.map((a) => (
                <AccentSwatch
                  key={a.id}
                  accent={a}
                  active={appearance.accent === a.id}
                  onSelect={() => setAppearance({ accent: a.id })}
                />
              ))}
            </div>
          </Section>

          <Section id="behavior" title="Verhalten">
            <Card className="max-w-2xl">
              <div className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className="mr-auto text-body font-medium text-ink">Ansicht beim Start</span>
                <Segment
                  size="sm"
                  label="Ansicht beim Start"
                  options={[
                    { value: 'overview', label: 'Übersicht' },
                    { value: 'editor', label: 'Aktuelle Woche' },
                  ]}
                  value={data.settings.startView ?? 'overview'}
                  onChange={(startView) => updateSettings({ startView })}
                />
              </div>
              <div className="border-t border-line px-4 py-3">
                <Switch
                  checked={data.settings.autoCreateWeek !== false}
                  onChange={(autoCreateWeek) => updateSettings({ autoCreateWeek })}
                  label="Aktuelle Woche beim Start anlegen"
                />
                <p className="mt-1 text-meta text-ink-2">
                  Fehlt die laufende Woche, legt die App sie von Montag bis Freitag beim Start an, mit Profil,
                  Feiertagen und Urlaub wie über „Woche anlegen“.
                </p>
              </div>
              <div className="border-t border-line px-4 py-3">
                <Switch
                  checked={layout.notesVisible}
                  onChange={(notesVisible) => setLayout({ notesVisible })}
                  label="Notizen-Bereich im Editor"
                />
                <p className="mt-1 text-meta text-ink-2">
                  Rohnotizen neben den Stichpunkten, für alle Tage. Auch mit Strg+Umschalt+N umschaltbar.
                </p>
              </div>
              <div className="border-t border-line px-4 py-3">
                <Switch
                  checked={layout.previewVisible}
                  onChange={(previewVisible) => setLayout({ previewVisible })}
                  label="Vorschau im Editor"
                />
                <p className="mt-1 text-meta text-ink-2">
                  Ausgeblendet bleibt unten eine Leiste mit den drei Kopieren-Buttons. Auch mit Strg+P umschaltbar.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3 border-t border-line px-4 py-3">
                <span className="mr-auto text-meta text-ink-2">
                  Ausbildung, aktuelles Halbjahr und WebUntis noch einmal Schritt für Schritt durchgehen
                </span>
                <Button size="sm" onClick={openSetup}>
                  Einrichtungsassistent starten
                </Button>
              </div>
            </Card>
          </Section>

          <Section
            id="snippets"
            title="Textbausteine"
            description="Wiederkehrende Formulierungen. Sie erscheinen im Editor als Vorschläge, zusätzlich zu allen bereits geschriebenen Stichpunkten."
          >
            <SnippetEditor />
          </Section>

          <Section
            id="connections"
            title="Verbindungen"
            description="Optionale Online-Dienste. Ausgeschaltet funktioniert alles wie bisher, ohne Netzwerk."
          >
            <WebuntisConnection />
          </Section>

          <Section id="updates" title="Updates" description="Neue Versionen kommen direkt von GitHub und lassen sich mit einem Klick installieren.">
            <UpdateSettings />
          </Section>

          <Section
            id="data-files"
            title="Daten"
            description="Alle Berichte liegen in einer daten.json, jede Änderung wird sofort gespeichert. Im Ordner „sicherungen“ daneben legt Berichtspilot jeden Tag eine Sicherung an (die letzten 30 Tage) und zusätzlich eine vor jedem Update, Import und Wiederherstellen."
          >
            <Card className="max-w-2xl" data-section="data">
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="text-meta font-medium text-ink-2">Speicherort</div>
                  <div className="selectable truncate text-body text-ink" title={dataPath}>
                    {dataPath || 'unbekannt'}
                  </div>
                </div>
                <Button size="sm" onClick={() => api.revealDataFile()}>
                  <FolderOpenIcon size={14} /> Ordner öffnen
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-3">
                <span className="mr-auto min-w-0 text-meta text-ink-2">Ganzen Datenbestand als Datei sichern oder einlesen</span>
                <Button size="sm" onClick={handleExport}>
                  <DownloadSimpleIcon size={14} /> Exportieren
                </Button>
                <Button size="sm" onClick={handleImport}>
                  <UploadSimpleIcon size={14} /> Importieren
                </Button>
              </div>
            </Card>
            <Backups />
          </Section>

          <Section id="shortcuts" title="Tastaturkürzel">
            <Card className="max-w-2xl overflow-hidden">
              {SHORTCUT_HELP.map(([keys, effect], i) => (
                <div key={keys} className={cx('flex items-center gap-4 px-4 py-2', i > 0 && 'border-t border-line')}>
                  <span className="w-44 shrink-0">
                    <Kbd keys={keys} />
                  </span>
                  <span className="text-body text-ink">{effect}</span>
                </div>
              ))}
            </Card>
          </Section>
        </div>
      </div>
    </div>
  )
}
