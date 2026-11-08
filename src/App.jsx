// App shell: title bar + sidebar + view switching (a short CSS fade) and the
// global shortcuts (src/lib/shortcuts.js).
import { Suspense, lazy, useEffect, useState } from 'react'
import { FolderOpenIcon, WarningIcon } from '@phosphor-icons/react'
import { StoreProvider, useStore, api } from './store.jsx'
import Titlebar from './ui/Titlebar.jsx'
import Sidebar from './ui/Sidebar.jsx'
import { ToastHost } from './ui/toast.jsx'
import ErrorBoundary from './ui/ErrorBoundary.jsx'
import { Button, Card } from './ui/basics.jsx'
import Overview from './views/Overview.jsx'
import WeekEditor from './views/WeekEditor.jsx'
import Profiles from './views/Profiles.jsx'
import Settings from './views/Settings.jsx'
import SetupWizard from './views/SetupWizard.jsx'
import { mondayOf } from './lib/dates.js'
import { matchShortcut } from './lib/shortcuts.js'

const VIEWS = ['overview', 'editor', 'profiles', 'settings']

// Dev aid (E-032): the component gallery at "#styleguide" — only where a URL
// can be typed (dev server, `vite preview`), never in the file:// app
const Styleguide = lazy(() => import('./views/Styleguide.jsx'))
const styleguideWanted = () => window.location.protocol.startsWith('http') && window.location.hash === '#styleguide'

// "Neu laden" after a render error: write what isn't saved yet, then reload
function useReload() {
  const { flush } = useStore()
  return () => flush().finally(() => window.location.reload())
}

// Gate in front of the actual shell: render only once the data is loaded —
// so the shell can take its start view straight from the settings.
function Content() {
  const { data, loadError, setupOpen } = useStore()

  // Mode and accent on <html>; the CSS tokens (data-mode, data-accent) follow.
  // Here rather than in the shell, so the setup wizard follows them too.
  // Only once the data is there — until then main.jsx shows the cached values.
  const mode = data?.settings?.appearance?.mode
  const accent = data?.settings?.appearance?.accent
  useEffect(() => {
    if (!mode) return
    document.documentElement.dataset.mode = mode
    document.documentElement.dataset.accent = accent
    try {
      localStorage.setItem('appearance', JSON.stringify({ mode, accent }))
    } catch {
      // a missing cache only costs the start-up colors
    }
  }, [mode, accent])

  // Data comes from a newer app version, or daten.json and all backups are
  // unreadable: don't touch them, say so clearly — otherwise the next autosave
  // would silently damage the file.
  if (loadError) {
    return (
      <div className="grid h-full place-items-center bg-canvas px-6" role="alert">
        <Card className="w-full max-w-md p-5">
          <div className="flex items-center gap-2">
            <WarningIcon size={18} className="shrink-0 text-missing" />
            <h2 className="text-title font-medium text-ink">Daten können nicht geladen werden</h2>
          </div>
          <p className="mt-2 text-body text-ink">{loadError.message}</p>
          <p className="mt-2 text-body text-ink-2">{loadError.hint}</p>
          {loadError.canReveal && (
            <Button className="mt-4" onClick={() => api.revealDataFile()}>
              <FolderOpenIcon size={16} /> Datenordner öffnen
            </Button>
          )}
        </Card>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="grid h-full place-items-center bg-canvas text-body text-ink-2">Lade Daten …</div>
    )
  }

  // Fresh install (or opened again from Settings): the wizard instead of the shell
  if (setupOpen) return <SetupWizard />

  return <Shell />
}

function Shell() {
  const { data, setLayout } = useStore()
  const reload = useReload()
  // Start view from the settings (read only on the first render)
  const [view, setView] = useState(() => {
    if (styleguideWanted()) return 'styleguide'
    return VIEWS.includes(data.settings.startView) ? data.settings.startView : 'overview'
  })
  // Week selected in the editor (Monday as ISO date), default: current week
  const [monday, setMonday] = useState(() => mondayOf(new Date()))
  const collapsed = data.settings.layout.sidebarCollapsed

  // Global shortcuts: Strg+Umschalt+1–4 switch views, Strg+B the sidebar.
  // The views register theirs (editor, overview) the same way.
  useEffect(() => {
    const handler = (e) => {
      const hit = matchShortcut(e, ['global'])
      if (!hit) return
      e.preventDefault()
      if (hit.id === 'view') setView(VIEWS[hit.arg])
      if (hit.id === 'sidebar') setLayout({ sidebarCollapsed: !collapsed })
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [collapsed, setLayout])

  useEffect(() => {
    const onHash = () => styleguideWanted() && setView('styleguide')
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const openWeek = (id) => {
    setMonday(id)
    setView('editor')
  }

  return (
    <div className="flex min-h-0 flex-1">
      <Sidebar view={view} onView={setView} />
      <main className="min-w-0 flex-1 bg-canvas">
        <div className="view-in h-full" key={view}>
          {/* keyed with the view: switching views clears an error — e.g. to
              restore a snapshot in Settings when one week can't be shown */}
          <ErrorBoundary
            title="Diese Ansicht konnte nicht angezeigt werden"
            hint={'Deine Daten sind gespeichert. Wechsle links in eine andere Ansicht, z.\u00a0B. Einstellungen → Daten → Sicherungen, oder lade neu.'}
            onReload={reload}
          >
            {view === 'overview' && <Overview openWeek={openWeek} />}
            {view === 'editor' && <WeekEditor monday={monday} setMonday={setMonday} />}
            {view === 'profiles' && <Profiles />}
            {view === 'settings' && <Settings />}
            {view === 'styleguide' && (
              <Suspense fallback={null}>
                <Styleguide />
              </Suspense>
            )}
          </ErrorBoundary>
        </div>
      </main>
    </div>
  )
}

// Outer net for errors outside a single view (sidebar, setup wizard); the
// title bar stays outside so the window can always be closed
function GuardedContent() {
  const reload = useReload()
  return (
    <ErrorBoundary
      title="Da ist etwas schiefgelaufen"
      hint="Deine Daten sind gespeichert. Lade die Anzeige neu, ungespeicherte Eingaben werden vorher gesichert."
      onReload={reload}
    >
      <Content />
    </ErrorBoundary>
  )
}

export default function App() {
  return (
    <StoreProvider>
      <div className="flex h-full flex-col">
        <Titlebar />
        <GuardedContent />
      </div>
      <ToastHost />
    </StoreProvider>
  )
}
