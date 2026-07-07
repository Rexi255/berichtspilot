// Eigene Titlebar für das rahmenlose Fenster: Drag-Zone + Fenstersteuerung.
import { useEffect, useState } from 'react'
import { MinusIcon, SquareIcon, CopySimpleIcon, XIcon } from '@phosphor-icons/react'
import { api } from '../store.jsx'
import { cx } from './basics.jsx'
import Logo from './Logo.jsx'

function FensterKnopf({ onClick, gefahr = false, titel, children }) {
  return (
    <button
      type="button"
      title={titel}
      aria-label={titel}
      onClick={onClick}
      className={cx(
        'no-drag flex h-full w-12 items-center justify-center text-tinte-3 transition-colors duration-100',
        gefahr ? 'hover:bg-[oklch(0.55_0.19_25)] hover:text-white' : 'hover:bg-white/[0.07] hover:text-tinte'
      )}
    >
      {children}
    </button>
  )
}

export default function Titlebar() {
  const [maximiert, setMaximiert] = useState(false)

  useEffect(() => api.onMaximiert(setMaximiert), [])

  return (
    <header className="drag relative z-20 flex h-11 shrink-0 items-stretch justify-between border-b border-white/[0.06] bg-grund/80">
      <div className="flex items-center gap-2.5 pl-4">
        {/* App-Logomarke: aufgeschlagenes Berichtsheft */}
        <Logo size={17} />
        <span className="text-[13px] font-semibold tracking-tight text-tinte">Berichtspilot</span>
        <span className="mt-px text-[11.5px] text-tinte-3">Ausbildungsnachweise</span>
      </div>

      <div className="flex items-stretch">
        <FensterKnopf titel="Minimieren" onClick={() => api.minimieren()}>
          <MinusIcon size={15} weight="bold" />
        </FensterKnopf>
        <FensterKnopf titel={maximiert ? 'Wiederherstellen' : 'Maximieren'} onClick={() => api.maximieren()}>
          {maximiert ? (
            <CopySimpleIcon size={14} weight="bold" style={{ transform: 'scaleX(-1)' }} />
          ) : (
            <SquareIcon size={13} weight="bold" />
          )}
        </FensterKnopf>
        <FensterKnopf titel="Schließen" gefahr onClick={() => api.schliessen()}>
          <XIcon size={15} weight="bold" />
        </FensterKnopf>
      </div>
    </header>
  )
}
