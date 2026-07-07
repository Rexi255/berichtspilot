// Kleine, konsistente UI-Bausteine des Design-Systems.
export const cx = (...teile) => teile.filter(Boolean).join(' ')

const KNOPF_VARIANTEN = {
  primaer:
    'bg-akzent text-einsatz font-semibold hover:bg-akzent-hell border border-transparent shadow-[0_1px_10px_-2px_var(--color-akzent-tief)]',
  umrandet:
    'border border-white/10 bg-white/[0.04] text-tinte hover:bg-white/[0.08] hover:border-white/15',
  ghost: 'border border-transparent text-tinte-2 hover:bg-white/[0.06] hover:text-tinte',
  gefahr: 'border border-transparent text-krank/90 hover:bg-krank/10 hover:text-krank',
}

const KNOPF_GROESSEN = {
  sm: 'h-7 px-2.5 text-[12.5px] gap-1 rounded-md',
  md: 'h-9 px-3.5 text-[13.5px] gap-1.5 rounded-lg',
}

export function Knopf({ variante = 'umrandet', groesse = 'md', className, ...props }) {
  return (
    <button
      type="button"
      className={cx(
        'inline-flex select-none items-center justify-center whitespace-nowrap font-medium',
        'transition-[background-color,border-color,color,transform] duration-150 ease-(--ease-aus)',
        'active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40',
        KNOPF_VARIANTEN[variante],
        KNOPF_GROESSEN[groesse],
        className
      )}
      {...props}
    />
  )
}

/** Quadratischer Icon-Knopf (Stichpunkte verschieben/löschen usw.) */
export function IconKnopf({ className, gefahr = false, titel, ...props }) {
  return (
    <button
      type="button"
      title={titel}
      aria-label={titel}
      className={cx(
        'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-transparent',
        'text-tinte-3 transition-[background-color,color,transform] duration-150 ease-(--ease-aus) active:scale-90',
        gefahr ? 'hover:bg-krank/10 hover:text-krank' : 'hover:bg-white/[0.07] hover:text-tinte',
        'disabled:pointer-events-none disabled:opacity-30',
        className
      )}
      {...props}
    />
  )
}

export function Eingabe({ className, ...props }) {
  return (
    <input
      className={cx(
        'h-9 w-full rounded-lg border border-white/[0.07] bg-einsatz/60 px-3 text-[13.5px] text-tinte',
        'placeholder:text-tinte-3 transition-colors duration-150',
        'hover:border-white/[0.12] focus:border-akzent-tief focus:outline-none',
        className
      )}
      {...props}
    />
  )
}

export function Textbereich({ className, ...props }) {
  return (
    <textarea
      className={cx(
        'w-full resize-y rounded-lg border border-white/[0.07] bg-einsatz/60 px-3 py-2 text-[13.5px] text-tinte',
        'placeholder:text-tinte-3 transition-colors duration-150',
        'hover:border-white/[0.12] focus:border-akzent-tief focus:outline-none',
        className
      )}
      {...props}
    />
  )
}

export function Auswahl({ className, children, ...props }) {
  return (
    <select
      className={cx(
        'h-9 rounded-lg border border-white/[0.07] bg-einsatz/60 py-0 pl-2.5 pr-7 text-[13.5px] text-tinte',
        'transition-colors duration-150 hover:border-white/[0.12] focus:border-akzent-tief focus:outline-none',
        '[&>option]:bg-flaeche [&>option]:text-tinte',
        className
      )}
      {...props}
    >
      {children}
    </select>
  )
}

/** Segmentierte Auswahl (z. B. Normal/Feiertag/Krank/Urlaub) */
export function Segment({ optionen, wert, onWert, groesse = 'md', className }) {
  return (
    <div
      role="group"
      className={cx(
        'inline-flex items-center gap-0.5 rounded-lg border border-white/[0.07] bg-einsatz/60 p-0.5',
        className
      )}
    >
      {optionen.map((o) => {
        const aktiv = o.wert === wert
        return (
          <button
            key={o.wert}
            type="button"
            aria-pressed={aktiv}
            onClick={() => onWert(o.wert)}
            className={cx(
              'rounded-[6px] font-medium transition-[background-color,color] duration-150 ease-(--ease-aus)',
              groesse === 'sm' ? 'h-6 px-2 text-[11.5px]' : 'h-7 px-2.5 text-[12.5px]',
              aktiv
                ? 'bg-flaeche-2 text-tinte shadow-[inset_0_0_0_1px_oklch(1_0_0/0.06)]'
                : 'text-tinte-3 hover:text-tinte-2'
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

const STATUS_FARBEN = {
  fertig: 'text-fertig bg-fertig/10 border-fertig/20',
  entwurf: 'text-entwurf bg-entwurf/10 border-entwurf/20',
  krank: 'text-krank bg-krank/10 border-krank/20',
  urlaub: 'text-urlaub bg-urlaub/10 border-urlaub/20',
  feiertag: 'text-feiertag bg-feiertag/10 border-feiertag/20',
  neutral: 'text-tinte-2 bg-white/[0.05] border-white/10',
  akzent: 'text-akzent bg-akzent/10 border-akzent/20',
}

/** Kleine Status-Pille mit Punkt */
export function Pille({ farbe = 'neutral', children, className, punkt = true }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11.5px] font-medium',
        STATUS_FARBEN[farbe],
        className
      )}
    >
      {punkt && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  )
}

/** Beschriftetes Feld (Label über dem Steuerelement) */
export function Feld({ label, hinweis, children, className }) {
  return (
    <label className={cx('flex flex-col gap-1.5', className)}>
      <span className="text-[12px] font-medium tracking-wide text-tinte-2">{label}</span>
      {children}
      {hinweis && <span className="text-[11.5px] text-tinte-3">{hinweis}</span>}
    </label>
  )
}

/** Abschnitts-Überschrift in Kapitälchen-Optik */
export function AbschnittTitel({ children, className }) {
  return (
    <h3 className={cx('text-[11px] font-semibold uppercase tracking-[0.08em] text-tinte-3', className)}>
      {children}
    </h3>
  )
}

/** Panel-Fläche des Design-Systems — „von oben beleuchtet": zarter Top-Highlight
 *  (inset-Lichtkante), sanfter Vertikal-Gradient und weicher Schlagschatten. */
export function Panel({ className, ...props }) {
  return (
    <div
      className={cx(
        'rounded-xl border border-white/[0.06] bg-flaeche/80',
        'bg-gradient-to-b from-white/[0.035] to-transparent to-[45%]',
        'shadow-[inset_0_1px_0_0_oklch(1_0_0/0.05),0_2px_8px_-4px_oklch(0_0_0/0.45)]',
        className
      )}
      {...props}
    />
  )
}
