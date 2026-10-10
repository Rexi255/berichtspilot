// App shell: title bar + sidebar + view switching with a GSAP transition.
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { FolderOpenIcon } from '@phosphor-icons/react'
import { StoreProvider, useStore, api } from './store.jsx'
import Titlebar from './ui/Titlebar.jsx'
import Sidebar from './ui/Sidebar.jsx'
import { ToastHost } from './ui/toast.jsx'
import { Button } from './ui/basics.jsx'
import Overview from './views/Overview.jsx'
import WeekEditor from './views/WeekEditor.jsx'
import Profiles from './views/Profiles.jsx'
import Settings from './views/Settings.jsx'
import SetupWizard from './views/SetupWizard.jsx'
import { mondayOf } from './lib/dates.js'

const VIEWS = ['overview', 'editor', 'profiles', 'settings']

// Gate in front of the actual shell: render only once the data is loaded —
// so the shell can take its start view straight from the settings.
function Content() {
  const { data, loadError, setupOpen } = useStore()

  // Apply the selected color theme on <html>; the CSS tokens (data-theme) follow.
  // Here rather than in the shell, so the setup wizard is themed too.
  useEffect(() => {
    document.documentElement.dataset.theme = data?.settings?.theme || 'northern-lights'
  }, [data?.settings?.theme])

  // Data comes from a newer app version, or daten.json and all backups are
  // unreadable: don't touch them, say so clearly — otherwise the next autosave
  // would silently damage the file.
  if (loadError) {
    return (
      <div className="grid h-full place-items-center px-8 text-center">
        <div className="max-w-md">
          <div className="text-[15px] font-semibold text-sick">Daten können nicht geladen werden</div>
          <p className="mt-2 text-[13px] leading-relaxed text-ink-2">{loadError.message}</p>
          <p className="mt-2 text-[12px] text-ink-3">{loadError.hint}</p>
          {loadError.canReveal && (
            <Button size="sm" className="mt-4" onClick={() => api.revealDataFile()}>
              <FolderOpenIcon size={14} /> Datenordner öffnen
            </Button>
          )}
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="grid h-full place-items-center text-[13px] text-ink-3">Lade Daten …</div>
    )
  }

  // Fresh install (or opened again from Settings): the wizard instead of the shell
  if (setupOpen) return <SetupWizard />

  return <Shell />
}

function Shell() {
  const { data } = useStore()
  // Start view from the settings (read only on the first render)
  const [view, setView] = useState(() =>
    VIEWS.includes(data.settings.startView) ? data.settings.startView : 'overview'
  )
  // Week selected in the editor (Monday as ISO date), default: current week
  const [monday, setMonday] = useState(() => mondayOf(new Date()))
  const viewRef = useRef(null)

  // Global shortcuts: Ctrl+1–4 switch views (via e.code, layout independent)
  useEffect(() => {
    const handler = (e) => {
      if (!e.ctrlKey || e.shiftKey || e.altKey) return
      const index = ['Digit1', 'Digit2', 'Digit3', 'Digit4'].indexOf(e.code)
      if (index === -1) return
      e.preventDefault()
      setView(VIEWS[index])
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Soft transition on view change
  useLayoutEffect(() => {
    if (!viewRef.current) return
    const anim = gsap.fromTo(
      viewRef.current,
      { opacity: 0, y: 10 },
      { opacity: 1, y: 0, duration: 0.28, ease: 'power3.out', clearProps: 'transform' }
    )
    return () => anim.kill()
  }, [view])

  const openWeek = (id) => {
    setMonday(id)
    setView('editor')
  }

  return (
    <div className="flex min-h-0 flex-1">
      <Sidebar view={view} onView={setView} />
      <main className="aurora min-w-0 flex-1">
        <div ref={viewRef} className="h-full" key={view}>
          {view === 'overview' && <Overview openWeek={openWeek} />}
          {view === 'editor' && <WeekEditor monday={monday} setMonday={setMonday} />}
          {view === 'profiles' && <Profiles />}
          {view === 'settings' && <Settings />}
        </div>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <StoreProvider>
      <div className="flex h-full flex-col">
        <Titlebar />
        <Content />
      </div>
      <ToastHost />
    </StoreProvider>
  )
}
