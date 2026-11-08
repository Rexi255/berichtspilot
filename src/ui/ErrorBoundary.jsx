// Catches render errors so the window stays usable (step 7.4). Without it, one
// broken view unmounts the whole app — and the frameless window loses even its
// close button. The title bar and the store sit outside the boundary: the
// window buttons keep working and saving goes on.
import { Component } from 'react'
import { WarningIcon, ArrowClockwiseIcon, CopyIcon } from '@phosphor-icons/react'
import { Button, Card } from './basics.jsx'
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
    <div className="grid h-full place-items-center px-6" role="alert">
      <Card className="w-full max-w-md p-5">
        <div className="flex items-center gap-2">
          <WarningIcon size={18} className="shrink-0 text-missing" />
          <h2 className="text-title font-medium text-ink">{title}</h2>
        </div>
        <p className="mt-2 text-body text-ink-2">{hint}</p>
        <p className="selectable mt-3 break-words rounded-control border border-line bg-canvas px-3 py-2 font-mono text-meta text-ink-2">
          {String(error?.message || error)}
        </p>
        <div className="mt-4 flex gap-2">
          <Button variant="primary" onClick={onReload}>
            <ArrowClockwiseIcon size={16} /> Neu laden
          </Button>
          <Button onClick={copyDetails}>
            <CopyIcon size={16} /> Fehlerdetails kopieren
          </Button>
        </div>
      </Card>
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
