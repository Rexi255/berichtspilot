// Lean, decoupled toast confirmations (e.g. "… kopiert").
// showToast() fires a window event; the ToastHost (mounted once in the app)
// listens to it and renders a short-lived message in the bottom right.
// Motion (E-032): CSS only — a short fade and 8 px rise in, a fade out.
import { useCallback, useEffect, useState } from 'react'
import { CheckIcon, WarningIcon } from '@phosphor-icons/react'
import { cx } from './basics.jsx'

let idCounter = 0
const LEAVE_MS = 160

/**
 * Show a toast — callable from anywhere, no context/props needed.
 * kind: 'success' | 'error'. Optional action (e.g. "Rückgängig"):
 * `action: { label, onClick }`.
 */
export function showToast(text, { kind = 'success', duration = 2200, action = null } = {}) {
  window.dispatchEvent(new CustomEvent('app:toast', { detail: { text, kind, duration, action } }))
}

function ToastRow({ toast, onDone }) {
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    let out
    const timer = setTimeout(() => {
      setLeaving(true)
      out = setTimeout(() => onDone(toast.id), LEAVE_MS)
    }, toast.duration)
    return () => {
      clearTimeout(timer)
      clearTimeout(out)
    }
    // onDone is stable (ToastHost) — a new toast must not restart this one's timer
  }, [toast.id, toast.duration, onDone])

  const isError = toast.kind === 'error'
  return (
    <div
      className={cx(
        'toast-in pointer-events-auto flex max-w-md items-center gap-2.5 rounded-control border border-line bg-surface-2 py-2 pl-3 pr-2 text-body text-ink shadow-float',
        'transition-[opacity,transform] duration-150 ease-out',
        leaving && 'translate-y-1 opacity-0'
      )}
    >
      {isError ? (
        <WarningIcon size={16} className="shrink-0 text-missing" />
      ) : (
        <CheckIcon size={16} className="shrink-0 text-accent" />
      )}
      <span className="min-w-0 flex-1 pr-1">{toast.text}</span>
      {toast.action && (
        <button
          type="button"
          onClick={() => {
            toast.action.onClick()
            onDone(toast.id)
          }}
          className="h-7 shrink-0 rounded-chip border border-line bg-surface px-2.5 text-meta font-medium text-ink transition-colors duration-150 hover:bg-surface-3"
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
    <div
      role="status"
      aria-live="polite"
      // --toast-bottom: raised by the editor's copy bar while it is shown
      className="pointer-events-none fixed bottom-[var(--toast-bottom,20px)] right-5 z-50 flex flex-col items-end gap-2"
    >
      {toasts.map((t) => (
        <ToastRow key={t.id} toast={t} onDone={remove} />
      ))}
    </div>
  )
}
