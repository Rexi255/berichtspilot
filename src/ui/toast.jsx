// Schlanke, entkoppelte Toast-Bestätigungen (z. B. „… kopiert").
// zeigeToast() feuert ein Fenster-Event; der ToastHost (einmal in der App
// gemountet) hört darauf und rendert eine kurzlebige Meldung unten rechts.
import { useEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { CheckIcon, WarningIcon } from '@phosphor-icons/react'
import { cx } from './basics.jsx'

let idZaehler = 0

/** Toast auslösen — von überall aufrufbar, ohne Context/Props. */
export function zeigeToast(text, { art = 'erfolg', dauer = 2200 } = {}) {
  window.dispatchEvent(new CustomEvent('app:toast', { detail: { text, art, dauer } }))
}

function ToastZeile({ toast, onWeg }) {
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (el) {
      gsap.fromTo(
        el,
        { opacity: 0, y: 12, scale: 0.96 },
        { opacity: 1, y: 0, scale: 1, duration: 0.32, ease: 'back.out(2)' }
      )
    }
    const weg = setTimeout(() => {
      if (el) {
        gsap.to(el, { opacity: 0, y: 8, duration: 0.22, ease: 'power2.in', onComplete: onWeg })
      } else {
        onWeg()
      }
    }, toast.dauer)
    return () => clearTimeout(weg)
  }, [toast.dauer, onWeg])

  const fehler = toast.art === 'fehler'
  return (
    <div
      ref={ref}
      className={cx(
        'pointer-events-auto flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-[13px] font-medium',
        'bg-flaeche-2/95 shadow-[inset_0_1px_0_0_oklch(1_0_0/0.06),0_10px_30px_-10px_oklch(0_0_0/0.7)] backdrop-blur',
        fehler ? 'border-krank/25 text-tinte' : 'border-akzent/25 text-tinte'
      )}
    >
      <span
        className={cx(
          'grid h-6 w-6 shrink-0 place-items-center rounded-full',
          fehler ? 'bg-krank/15 text-krank' : 'bg-akzent/15 text-akzent'
        )}
      >
        {fehler ? <WarningIcon size={14} weight="bold" /> : <CheckIcon size={14} weight="bold" />}
      </span>
      {toast.text}
    </div>
  )
}

/** Einmal in der App-Shell gemountet; sammelt und stapelt die Toasts. */
export function ToastHost() {
  const [toasts, setToasts] = useState([])

  useEffect(() => {
    const anZeigen = (e) => {
      const toast = { id: ++idZaehler, ...e.detail }
      setToasts((liste) => [...liste, toast])
    }
    window.addEventListener('app:toast', anZeigen)
    return () => window.removeEventListener('app:toast', anZeigen)
  }, [])

  const entfernen = (id) => setToasts((liste) => liste.filter((t) => t.id !== id))

  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-50 flex flex-col items-end gap-2">
      {toasts.map((t) => (
        <ToastZeile key={t.id} toast={t} onWeg={() => entfernen(t.id)} />
      ))}
    </div>
  )
}
