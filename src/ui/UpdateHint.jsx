// Auto-update hint (E-017): a quiet card in the sidebar footer that appears only
// while a found release needs a click — download → progress → install. Plus one
// toast per version and session when a release shows up. Nothing downloads or
// installs without the click.
import { useEffect, useRef, useState } from 'react'
import { ArrowCircleUpIcon, CircleNotchIcon } from '@phosphor-icons/react'
import { useStore } from '../store.jsx'
import { updateHint, versionLabel } from '../lib/update.js'
import { Button } from './basics.jsx'
import { showToast } from './toast.jsx'

/**
 * Click handlers shared by the sidebar card and Settings. Failures arrive as
 * status (shown inline); only a failed install start needs a toast, because the
 * app would otherwise just stay open without a word.
 */
export function useUpdateActions() {
  const { downloadUpdate, installUpdate } = useStore()
  const [installing, setInstalling] = useState(false)

  const download = () => downloadUpdate().catch(() => {})

  const install = async () => {
    setInstalling(true)
    try {
      const res = await installUpdate()
      // ok → the app quits right away; keep the spinner until it does
      if (!res.ok) {
        setInstalling(false)
        showToast(res.error || 'Update konnte nicht installiert werden', { kind: 'error', duration: 6000 })
      }
    } catch {
      setInstalling(false)
      showToast('Update konnte nicht installiert werden', { kind: 'error', duration: 6000 })
    }
  }

  return { download, install, installing }
}

/** The action of the current step as a full-width button / progress bar. */
export function UpdateAction({ hint, actions, className }) {
  if (hint.step === 'downloading') {
    return (
      <div className={className}>
        <div
          className="h-1.5 overflow-hidden rounded-full bg-white/[0.07]"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={hint.percent}
        >
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-300 ease-(--ease-smooth)"
            style={{ width: `${hint.percent}%` }}
          />
        </div>
      </div>
    )
  }
  if (hint.step === 'install') {
    return (
      <Button size="sm" variant="primary" className={className} onClick={actions.install} disabled={actions.installing}>
        {actions.installing ? (
          <>
            <CircleNotchIcon size={13} className="animate-spin" /> Wird gestartet …
          </>
        ) : (
          'Jetzt installieren'
        )}
      </Button>
    )
  }
  return (
    <Button size="sm" variant={hint.step === 'retry' ? 'outline' : 'primary'} className={className} onClick={actions.download}>
      {hint.step === 'retry' ? 'Erneut versuchen' : 'Herunterladen'}
    </Button>
  )
}

// Second line of the card per step
function subtitle(hint) {
  if (hint.step === 'download') return 'Neue Version verfügbar'
  if (hint.step === 'downloading') return `Wird heruntergeladen … ${hint.percent} %`
  if (hint.step === 'install') return 'Bereit · App startet neu'
  return hint.error || 'Download fehlgeschlagen'
}

export default function UpdateHint() {
  const { update, downloadUpdate } = useStore()
  const actions = useUpdateActions()
  const hint = updateHint(update)
  const announced = useRef(new Set())

  // One toast per version and session — a repeated check stays quiet
  const available = update?.state === 'available' ? update.version : null
  useEffect(() => {
    if (!available || announced.current.has(available)) return
    announced.current.add(available)
    showToast(`Update auf ${versionLabel(available)} verfügbar`, {
      duration: 6000,
      action: { label: 'Herunterladen', onClick: () => downloadUpdate().catch(() => {}) },
    })
  }, [available, downloadUpdate])

  if (!hint) return null
  return (
    <div className="mb-2 rounded-lg border border-accent/20 bg-accent/[0.06] p-2.5" aria-live="polite">
      <div className="flex items-start gap-2">
        <ArrowCircleUpIcon size={17} weight="fill" className="mt-px shrink-0 text-accent" />
        <div className="min-w-0 leading-tight">
          <div className="text-[12px] font-semibold text-ink">Update auf {versionLabel(hint.version)}</div>
          <div
            className={hint.step === 'retry' ? 'mt-0.5 text-[10.5px] text-sick' : 'mt-0.5 text-[10.5px] text-ink-3'}
            title={hint.step === 'retry' ? hint.error : undefined}
          >
            {subtitle(hint)}
          </div>
        </div>
      </div>
      <UpdateAction hint={hint} actions={actions} className="mt-2 w-full" />
    </div>
  )
}
