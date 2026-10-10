// Custom title bar for the frameless window: drag zone + window controls.
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
        'no-drag flex h-full w-12 items-center justify-center text-ink-3 transition-colors duration-100',
        danger ? 'hover:bg-[oklch(0.55_0.19_25)] hover:text-white' : 'hover:bg-white/[0.07] hover:text-ink'
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
    <header className="drag relative z-20 flex h-11 shrink-0 items-stretch justify-between border-b border-white/[0.06] bg-base/80">
      <div className="flex items-center gap-2.5 pl-4">
        {/* App logo: an open training record book */}
        <Logo size={17} />
        <span className="text-[13px] font-semibold tracking-tight text-ink">Berichtspilot</span>
        <span className="mt-px text-[11.5px] text-ink-3">Ausbildungsnachweise</span>
      </div>

      <div className="flex items-stretch">
        <WindowButton label="Minimieren" onClick={() => api.minimize()}>
          <MinusIcon size={15} weight="bold" />
        </WindowButton>
        <WindowButton label={maximized ? 'Wiederherstellen' : 'Maximieren'} onClick={() => api.maximize()}>
          {maximized ? (
            <CopySimpleIcon size={14} weight="bold" style={{ transform: 'scaleX(-1)' }} />
          ) : (
            <SquareIcon size={13} weight="bold" />
          )}
        </WindowButton>
        <WindowButton label="Schließen" danger onClick={() => api.close()}>
          <XIcon size={15} weight="bold" />
        </WindowButton>
      </div>
    </header>
  )
}
