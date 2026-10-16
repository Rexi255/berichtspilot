// Catches render errors so the window stays usable (step 7.4). Without it, one
// broken view unmounts the whole app — and the frameless window loses even its
// close button. The title bar and the store sit outside the boundary: the
// window buttons keep working and saving goes on.
import { Component } from 'react'
import { WarningIcon, ArrowClockwiseIcon, CopyIcon } from '@phosphor-icons/react'
import { Button } from './basics.jsx'
import { showToast } from './toast.jsx'

function Fallback({ error, title, hint, onReload }) {
  const copyDetails = async () => {
    const details = `${error?.stack || error}`.slice(0, 4000)
    try {
      await navigator.clipboard.writeText(`Berichtspilot – Fehler\n\n${details}`)
      showToast('Fehlerdetails kopiert')
    } catch {
      showToast('Kopieren fehlgeschlagen', { kind: 'error' })
    }
  }

  return (
    <div className="grid h-full place-items-center px-8 text-center" role="alert">
      <div className="max-w-md">
        <span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-sick/10 text-sick">
          <WarningIcon size={22} />
        </span>
        <div className="mt-3 text-[15px] font-semibold text-ink">{title}</div>
        <p className="mt-2 text-[13px] leading-relaxed text-ink-2">{hint}</p>
        <p className="mt-2 break-words font-mono text-[11.5px] text-ink-3">{String(error?.message || error)}</p>
        <div className="mt-4 flex justify-center gap-2">
          <Button size="sm" variant="primary" onClick={onReload}>
            <ArrowClockwiseIcon size={14} /> Neu laden
          </Button>
          <Button size="sm" onClick={copyDetails}>
            <CopyIcon size={14} /> Fehlerdetails kopieren
          </Button>
        </div>
      </div>
    </div>
  )
}

/**
 * `onReload` writes pending changes and reloads the page; `title`/`hint` are
 * the German texts for this place (a single view, or the whole app).
 */
export default class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('Berichtspilot: Anzeigefehler', error, info?.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return <Fallback error={this.state.error} title={this.props.title} hint={this.props.hint} onReload={this.props.onReload} />
  }
}
