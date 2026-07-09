// App-Shell: Titlebar + Sidebar + Viewwechsel mit GSAP-Übergang.
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { StoreProvider, useStore } from './store.jsx'
import Titlebar from './ui/Titlebar.jsx'
import Sidebar from './ui/Sidebar.jsx'
import { ToastHost } from './ui/toast.jsx'
import Uebersicht from './views/Uebersicht.jsx'
import WochenEditor from './views/WochenEditor.jsx'
import Profile from './views/Profile.jsx'
import Einstellungen from './views/Einstellungen.jsx'
import { montagVon } from './lib/dates.js'

// Gate vor der eigentlichen Shell: erst rendern, wenn die Daten geladen sind —
// so kann die Shell ihre Start-Ansicht direkt aus den Einstellungen beziehen.
function Inhalt() {
  const { daten, ladefehler } = useStore()

  // Daten stammen aus einer neueren App-Version: nicht anfassen, klar melden —
  // sonst würde das nächste Autosave den Bestand stillschweigend beschädigen.
  if (ladefehler) {
    return (
      <div className="grid h-full place-items-center px-8 text-center">
        <div className="max-w-md">
          <div className="text-[15px] font-semibold text-krank">Daten können nicht geladen werden</div>
          <p className="mt-2 text-[13px] leading-relaxed text-tinte-2">{ladefehler}</p>
          <p className="mt-2 text-[12px] text-tinte-3">
            Bitte aktualisiere Berichtspilot auf die neueste Version — deine daten.json bleibt unverändert.
          </p>
        </div>
      </div>
    )
  }

  if (!daten) {
    return (
      <div className="grid h-full place-items-center text-[13px] text-tinte-3">Lade Daten …</div>
    )
  }

  return <Shell />
}

function Shell() {
  const { daten } = useStore()
  // Start-Ansicht aus den Einstellungen (nur beim ersten Rendern gelesen)
  const [ansicht, setAnsicht] = useState(() =>
    ['uebersicht', 'editor', 'profile', 'einstellungen'].includes(daten.einstellungen.startAnsicht)
      ? daten.einstellungen.startAnsicht
      : 'uebersicht'
  )
  // Im Editor ausgewählte Woche (Montag als ISO-Datum), Default: aktuelle Woche
  const [montag, setMontag] = useState(() => montagVon(new Date()))
  const viewRef = useRef(null)

  // Globale Kürzel: Strg+1–4 wechseln die Ansicht (per e.code, layoutunabhängig)
  useEffect(() => {
    const reihenfolge = ['uebersicht', 'editor', 'profile', 'einstellungen']
    const handler = (e) => {
      if (!e.ctrlKey || e.shiftKey || e.altKey) return
      const index = ['Digit1', 'Digit2', 'Digit3', 'Digit4'].indexOf(e.code)
      if (index === -1) return
      e.preventDefault()
      setAnsicht(reihenfolge[index])
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Weicher Übergang beim Viewwechsel
  useLayoutEffect(() => {
    if (!viewRef.current) return
    const anim = gsap.fromTo(
      viewRef.current,
      { opacity: 0, y: 10 },
      { opacity: 1, y: 0, duration: 0.28, ease: 'power3.out', clearProps: 'transform' }
    )
    return () => anim.kill()
  }, [ansicht])

  // Gewähltes Farbthema am <html> setzen; die CSS-Tokens (data-theme) ziehen nach.
  useEffect(() => {
    document.documentElement.dataset.theme = daten?.einstellungen?.theme || 'nordlicht'
  }, [daten?.einstellungen?.theme])

  const oeffneWoche = (id) => {
    setMontag(id)
    setAnsicht('editor')
  }

  return (
    <div className="flex min-h-0 flex-1">
      <Sidebar ansicht={ansicht} onAnsicht={setAnsicht} />
      <main className="aurora min-w-0 flex-1">
        <div ref={viewRef} className="h-full" key={ansicht}>
          {ansicht === 'uebersicht' && <Uebersicht oeffneWoche={oeffneWoche} />}
          {ansicht === 'editor' && <WochenEditor montag={montag} setMontag={setMontag} />}
          {ansicht === 'profile' && <Profile />}
          {ansicht === 'einstellungen' && <Einstellungen />}
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
        <Inhalt />
      </div>
      <ToastHost />
    </StoreProvider>
  )
}
