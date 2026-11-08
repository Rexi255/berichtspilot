// Auto-update hint (E-017): a quiet card in the sidebar footer that appears only
// while a found release needs a click — download → progress → install. Plus one
// toast per version and session when a release shows up. Nothing downloads or
// installs without the click.
import { useEffect, useRef } from 'react'
import { ArrowCircleUpIcon, CircleNotchIcon } from '@phosphor-icons/react'
import { useStore } from '../store.jsx'
import { updateHint, versionLabel } from '../lib/update.js'
import { Button } from './basics.jsx'
import { showToast } from './toast.jsx'

/**
 * Click handlers shared by the sidebar card and Settings. Failures arrive as
 * status (shown inline); only a failed install start needs a toast, because the
 * app would otherwise just stay open without a word. The "installing" flag lives
 * in the store, so both buttons spin (and stay disabled) together.
 */
export function useUpdateActions() {
  const { downloadUpdate, installUpdate, installingUpdate } = useStore()

  const download = () => downloadUpdate().catch(() => {})

  const install = async () => {
    const res = await installUpdate()
    if (!res.ok) showToast(res.error || 'Update konnte nicht installiert werden', { kind: 'error', duration: 6000 })
  }

  return { download, install, installing: installingUpdate }
}

/** The action of the current step as a full-width button / progress bar. */
export function UpdateAction({ hint, actions, className }) {
  if (hint.step === 'downloading') {
    return (
      <div className={className}>
        <div
          className="h-1.5 overflow-hidden rounded-full bg-surface-2"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={hint.percent}
        >
          <div
            className="h-full origin-left rounded-full bg-accent transition-transform duration-300 ease-out"
            style={{ transform: `scaleX(${hint.percent / 100})` }}
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
            <CircleNotchIcon size={14} className="animate-spin" /> Wird gestartet …
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
  if (hint.step === 'install') return 'Bereit, die App startet neu'
  // Download or install failed — the retry downloads again (restores a missing installer too)
  return hint.error || 'Update fehlgeschlagen'
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
    <div className="rounded-control border border-line bg-surface p-2.5" aria-live="polite">
      <div className="flex items-start gap-2">
        <ArrowCircleUpIcon size={16} className="mt-0.5 shrink-0 text-ink-2" />
        <div className="min-w-0">
          <div className="text-meta font-medium text-ink">Update auf {versionLabel(hint.version)}</div>
          <div
            className={hint.step === 'retry' ? 'text-meta text-missing' : 'text-meta text-ink-2'}
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
