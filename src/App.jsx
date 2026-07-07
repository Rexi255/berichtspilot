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

function Inhalt() {
  const { daten } = useStore()
  const [ansicht, setAnsicht] = useState('uebersicht')
  // Im Editor ausgewählte Woche (Montag als ISO-Datum), Default: aktuelle Woche
  const [montag, setMontag] = useState(() => montagVon(new Date()))
  const viewRef = useRef(null)

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

  if (!daten) {
    return (
      <div className="grid h-full place-items-center text-[13px] text-tinte-3">Lade Daten …</div>
    )
  }

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
