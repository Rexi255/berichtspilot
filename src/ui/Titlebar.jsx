// Custom title bar for the frameless window: drag zone + window controls.
// Quiet on purpose (E-032): the name, nothing else — the content leads.
import { useEffect, useState } from 'react'
import { MinusIcon, SquareIcon, CopySimpleIcon, XIcon } from '@phosphor-icons/react'
import { api } from '../store.jsx'
import { cx } from './basics.jsx'
import Logo from './Logo.jsx'

function WindowButton({ onClick, danger = false, label, children }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={cx(
        'no-drag flex h-full w-11 items-center justify-center text-ink-2 transition-colors duration-100',
        // the system's close red, so the button reads like every other window
        danger ? 'hover:bg-[#c42b1c] hover:text-[#fcfcfa]' : 'hover:bg-surface-2 hover:text-ink'
      )}
    >
      {children}
    </button>
  )
}

export default function Titlebar() {
  const [maximized, setMaximized] = useState(false)

  useEffect(() => api.onMaximized(setMaximized), [])

  return (
    <header className="drag relative z-20 flex h-9 shrink-0 items-stretch justify-between border-b border-line bg-sidebar">
      <div className="flex items-center gap-2 pl-3.5">
        <Logo size={16} />
        <span className="text-body font-medium text-ink">Berichtspilot</span>
      </div>

      <div className="flex items-stretch">
        <WindowButton label="Minimieren" onClick={() => api.minimize()}>
          <MinusIcon size={14} />
        </WindowButton>
        <WindowButton label={maximized ? 'Wiederherstellen' : 'Maximieren'} onClick={() => api.maximize()}>
          {maximized ? <CopySimpleIcon size={13} style={{ transform: 'scaleX(-1)' }} /> : <SquareIcon size={12} />}
        </WindowButton>
        <WindowButton label="Schließen" danger onClick={() => api.close()}>
          <XIcon size={14} />
        </WindowButton>
      </div>
    </header>
  )
}
