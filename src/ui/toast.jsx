// Lean, decoupled toast confirmations (e.g. "… kopiert").
// showToast() fires a window event; the ToastHost (mounted once in the app)
// listens to it and renders a short-lived message in the bottom right.
import { useCallback, useEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { CheckIcon, WarningIcon } from '@phosphor-icons/react'
import { cx } from './basics.jsx'

let idCounter = 0

/**
 * Show a toast — callable from anywhere, no context/props needed.
 * kind: 'success' | 'error'. Optional action (e.g. "Rückgängig"):
 * `action: { label, onClick }`.
 */
export function showToast(text, { kind = 'success', duration = 2200, action = null } = {}) {
  window.dispatchEvent(new CustomEvent('app:toast', { detail: { text, kind, duration, action } }))
}

function ToastRow({ toast, onDone }) {
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
    const done = () => onDone(toast.id)
    const timer = setTimeout(() => {
      if (el) {
        gsap.to(el, { opacity: 0, y: 8, duration: 0.22, ease: 'power2.in', onComplete: done })
      } else {
        done()
      }
    }, toast.duration)
    return () => clearTimeout(timer)
    // onDone is stable (ToastHost) — a new toast must not restart this one's timer
  }, [toast.id, toast.duration, onDone])

  const isError = toast.kind === 'error'
  return (
    <div
      ref={ref}
      className={cx(
        'pointer-events-auto flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-[13px] font-medium',
        'bg-surface-2/95 shadow-[inset_0_1px_0_0_oklch(1_0_0/0.06),0_10px_30px_-10px_oklch(0_0_0/0.7)] backdrop-blur',
        isError ? 'border-sick/25 text-ink' : 'border-accent/25 text-ink'
      )}
    >
      <span
        className={cx(
          'grid h-6 w-6 shrink-0 place-items-center rounded-full',
          isError ? 'bg-sick/15 text-sick' : 'bg-accent/15 text-accent'
        )}
      >
        {isError ? <WarningIcon size={14} weight="bold" /> : <CheckIcon size={14} weight="bold" />}
      </span>
      {toast.text}
      {toast.action && (
        <button
          type="button"
          onClick={() => {
            toast.action.onClick()
            onDone(toast.id)
          }}
          className="ml-1 rounded-md border border-accent/30 bg-accent/10 px-2 py-1 text-[12px] font-semibold text-accent transition-colors duration-150 hover:bg-accent/20"
        >
          {toast.action.label}
        </button>
      )}
    </div>
  )
}

/** Mounted once in the app shell; collects and stacks the toasts. */
export function ToastHost() {
  const [toasts, setToasts] = useState([])

  useEffect(() => {
    const onToast = (e) => {
      const toast = { id: ++idCounter, ...e.detail }
      setToasts((list) => [...list, toast])
    }
    window.addEventListener('app:toast', onToast)
    return () => window.removeEventListener('app:toast', onToast)
  }, [])

  // Stable: every row's timer effect depends on it
  const remove = useCallback((id) => setToasts((list) => list.filter((t) => t.id !== id)), [])

  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-50 flex flex-col items-end gap-2">
      {toasts.map((t) => (
        <ToastRow key={t.id} toast={t} onDone={remove} />
      ))}
    </div>
  )
}
