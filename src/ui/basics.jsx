// Building blocks of the design system "Kladde" (E-032, docs/DESIGN.md).
// Neutral by default; the accent only marks actions, the active navigation,
// written days and "Fertig". Radius: card 16, control 10, cell 8, chip 6.
import { useEffect, useRef, useState } from 'react'
import { WarningIcon, InfoIcon } from '@phosphor-icons/react'

export const cx = (...parts) => parts.filter(Boolean).join(' ')

/* -------------------------------- Buttons -------------------------------- */

const BUTTON_VARIANTS = {
  primary: 'border-transparent bg-accent text-on-accent hover:bg-accent-hover',
  secondary: 'border-line bg-surface-2 text-ink hover:bg-surface-3',
  ghost: 'border-transparent text-ink-2 hover:bg-surface-2 hover:text-ink',
  danger: 'border-transparent text-missing hover:bg-missing/10',
  // "Trotzdem kopieren" and other actions taken despite a warning
  warning: 'border-warn/60 bg-surface text-ink hover:bg-warn/10',
}
// Transition: the old name for "secondary"
BUTTON_VARIANTS.outline = BUTTON_VARIANTS.secondary

const BUTTON_SIZES = {
  sm: 'h-7 gap-1.5 px-2.5 text-meta',
  md: 'h-8 gap-1.5 px-3 text-body',
}

export function Button({ variant = 'secondary', size = 'md', className, ...props }) {
  return (
    <button
      type="button"
      className={cx(
        'inline-flex select-none items-center justify-center whitespace-nowrap rounded-control border font-medium',
        'transition-[background-color,border-color,color,transform] duration-150 ease-out active:scale-[0.98]',
        'disabled:pointer-events-none disabled:opacity-45',
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        className
      )}
      {...props}
    />
  )
}

/**
 * Square icon button; `label` is its accessible name and tooltip,
 * `shortcut` (e.g. "Strg+B") shows as keycaps in the tooltip.
 */
export function IconButton({ className, danger = false, label, shortcut, size = 'md', side = 'top', ...props }) {
  return (
    <Tooltip label={label} shortcut={shortcut} side={side}>
      <button
        type="button"
        aria-label={label}
        className={cx(
          'inline-flex shrink-0 items-center justify-center rounded-control border border-transparent text-ink-2',
          'transition-[background-color,color,transform] duration-150 ease-out active:scale-[0.96]',
          size === 'sm' ? 'h-7 w-7' : 'h-8 w-8',
          danger ? 'hover:bg-missing/10 hover:text-missing' : 'hover:bg-surface-2 hover:text-ink',
          'disabled:pointer-events-none disabled:opacity-35',
          className
        )}
        {...props}
      />
    </Tooltip>
  )
}

/* ------------------------------ Form controls ------------------------------ */

const FIELD =
  'w-full rounded-control border border-line bg-surface text-body text-ink placeholder:text-ink-2 ' +
  'transition-[border-color,background-color] duration-150 hover:border-mark ' +
  'focus:border-accent focus:outline-none disabled:opacity-45'

export function Input({ className, ...props }) {
  return <input className={cx(FIELD, 'h-8 px-2.5', className)} {...props} />
}

export function TextArea({ className, ...props }) {
  return <textarea className={cx(FIELD, 'resize-y px-2.5 py-1.5', className)} {...props} />
}

export function Select({ className, children, ...props }) {
  return (
    <select className={cx(FIELD, 'h-8 w-auto py-0 pl-2 pr-7', '[&>option]:bg-surface [&>option]:text-ink', className)} {...props}>
      {children}
    </select>
  )
}

/** Segmented control; options: [{ value, label, title? }] */
export function Segment({ options, value, onChange, size = 'md', className, label }) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cx('inline-flex items-center gap-0.5 rounded-control border border-line bg-surface p-0.5', className)}
    >
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            title={o.title}
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={cx(
              'rounded-[7px] font-medium transition-[background-color,color] duration-150 ease-out',
              size === 'sm' ? 'h-6 px-2 text-meta' : 'h-7 px-2.5 text-body',
              active ? 'bg-surface-3 text-ink' : 'text-ink-2 hover:text-ink'
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

/** On/off switch; `label` is the visible text next to it (clickable) */
export function Switch({ checked, onChange, label, disabled = false, className }) {
  return (
    <label className={cx('inline-flex cursor-pointer select-none items-center gap-2.5', disabled && 'pointer-events-none opacity-45', className)}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cx(
          'relative h-5 w-9 shrink-0 rounded-full border transition-[background-color,border-color] duration-150 ease-out',
          checked ? 'border-transparent bg-accent' : 'border-mark bg-surface-2'
        )}
      >
        <span
          className={cx(
            'absolute left-[2px] top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full transition-[transform,background-color] duration-150 ease-out',
            checked ? 'translate-x-4 bg-on-accent' : 'translate-x-0 bg-ink-2'
          )}
        />
      </button>
      {label && <span className="text-body font-medium text-ink">{label}</span>}
    </label>
  )
}

/** Labeled field (label above the control, hint or error below) */
export function Field({ label, hint, error, children, className }) {
  return (
    <label className={cx('flex flex-col gap-1.5', className)}>
      <span className="text-meta font-medium text-ink-2">{label}</span>
      {children}
      {error ? <span className="text-meta text-missing">{error}</span> : hint && <span className="text-meta text-ink-2">{hint}</span>}
    </label>
  )
}

/* ------------------------------- Surfaces ------------------------------- */

/** The one card level: 16 px radius, a 1 px line, no shadow */
export function Card({ as: Comp = 'div', className, ...props }) {
  return <Comp className={cx('rounded-card border border-line bg-surface', className)} {...props} />
}

/** Warning or info bar (privacy check, profile warnings …); text stays ink */
export function Notice({ tone = 'warn', icon = true, children, className, ...props }) {
  const Icon = tone === 'warn' ? WarningIcon : InfoIcon
  return (
    <div
      role={tone === 'warn' ? 'alert' : 'status'}
      className={cx(
        'flex items-start gap-2 rounded-control border px-3 py-2 text-body text-ink',
        tone === 'warn' ? 'border-warn/50 bg-warn/[0.08]' : 'border-line bg-surface-2',
        className
      )}
      {...props}
    >
      {icon && <Icon size={16} className={cx('mt-0.5 shrink-0', tone === 'warn' ? 'text-warn' : 'text-ink-2')} />}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

/* ----------------------------- Status + days ----------------------------- */

const STATUS = {
  done: { label: 'Fertig', color: 'text-accent' },
  draft: { label: 'Entwurf', color: 'text-draft' },
  missing: { label: 'Fehlt', color: 'text-missing' },
}

/** The status shape: filled (done), half (draft), dashed (missing) */
export function StatusGlyph({ status, className }) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        'relative inline-block h-2.5 w-2.5 shrink-0 overflow-hidden rounded-[3px] border-[1.5px] border-current',
        status === 'done' && 'bg-current',
        status === 'missing' && 'border-dashed',
        className
      )}
    >
      {status === 'draft' && <span className="absolute inset-x-0 bottom-0 h-1/2 bg-current" />}
    </span>
  )
}

/** Week status chip — Fertig / Entwurf / Fehlt with its shape. `as="button"` for a toggle. */
export function StatusChip({ status, as: Comp = 'span', children, className, ...props }) {
  const s = STATUS[status] ?? STATUS.draft
  return (
    <Comp
      {...(Comp === 'button' ? { type: 'button' } : {})}
      className={cx(
        'inline-flex h-6 shrink-0 items-center gap-1.5 rounded-chip border border-line bg-surface px-2 text-meta font-medium',
        Comp === 'button' && 'transition-colors duration-150 hover:border-mark',
        s.color,
        className
      )}
      {...props}
    >
      <StatusGlyph status={status} />
      {children ?? s.label}
    </Comp>
  )
}

/** German names of the day-cell states (tooltips, legend, screen readers) */
export const DAY_STATE_LABELS = {
  written: 'geschrieben',
  open: 'offen',
  future: 'noch nicht dran',
  holiday: 'Feiertag',
  sick: 'Krank',
  vacation: 'Urlaub',
  none: 'kein Tag',
}

const CELL_STATES = {
  written: 'border-transparent bg-accent text-on-accent',
  open: 'border-dashed border-mark text-ink-2',
  future: 'border-line text-ink-2/70',
  holiday: 'border-transparent bg-surface-2 text-holiday',
  sick: 'border-transparent bg-surface-2 text-sick',
  vacation: 'border-transparent bg-surface-2 text-vacation',
  none: 'border-transparent',
}
const STATUS_LETTERS = { holiday: 'F', sick: 'K', vacation: 'U' }

/**
 * The day cell (signature): written = accent fill, open = dashed, F/K/U =
 * raised fill with the letter in the status color, future = faint.
 * Sizes: `band` (12×16, letter only for F/K/U), `tab` (20×20 with the
 * letter), `row` (weekday abbreviation + letter).
 */
export function DayCell({ state, letter, short, size = 'row', title, className }) {
  const look = CELL_STATES[state] ?? CELL_STATES.open
  const statusLetter = STATUS_LETTERS[state]
  if (size === 'band') {
    return (
      <span
        title={title}
        className={cx(
          'grid h-4 w-3 shrink-0 place-items-center rounded-[3px] border text-[9px] font-semibold leading-none',
          look,
          className
        )}
      >
        {statusLetter}
      </span>
    )
  }
  if (size === 'tab') {
    return (
      <span
        title={title}
        className={cx('grid h-5 w-5 shrink-0 place-items-center rounded-[6px] border text-[11px] font-semibold leading-none', look, className)}
      >
        {statusLetter ?? letter}
      </span>
    )
  }
  return (
    <span
      title={title}
      className={cx(
        'inline-flex h-6 w-[42px] shrink-0 items-center justify-center gap-1 rounded-[7px] border text-[11px] leading-none tabular-nums',
        look,
        className
      )}
    >
      <span className={state === 'written' ? '' : 'text-ink-2'}>{short}</span>
      <span className="font-semibold">{statusLetter ?? letter}</span>
    </span>
  )
}

/** Small count badge (sidebar: missing weeks) */
export function Badge({ children, tone = 'missing', className }) {
  return (
    <span
      className={cx(
        'inline-flex h-5 min-w-5 items-center justify-center rounded-chip border px-1 text-[11px] font-semibold leading-none tabular-nums',
        tone === 'missing' ? 'border-missing/50 text-missing' : 'border-line text-ink-2',
        className
      )}
    >
      {children}
    </span>
  )
}

/* ------------------------- Keycaps, tooltip, menu ------------------------- */

/** Keycaps for "Strg+Umschalt+1", alternatives separated by " / " */
export function Kbd({ keys, children, className }) {
  const text = keys ?? children
  const alternatives = String(text).split(' / ')
  return (
    <span className={cx('inline-flex items-center gap-1 align-middle', className)}>
      {alternatives.map((alt, i) => (
        <span key={i} className="inline-flex items-center gap-0.5">
          {i > 0 && <span className="px-0.5 text-meta text-ink-2">/</span>}
          {alt.split('+').map((k, j) => (
            <kbd
              key={j}
              className="inline-flex h-5 min-w-5 items-center justify-center rounded-chip border border-line bg-surface-2 px-1 font-sans text-[11px] font-medium leading-none text-ink-2"
            >
              {k}
            </kbd>
          ))}
        </span>
      ))}
    </span>
  )
}

const TOOLTIP_SIDES = {
  top: 'bottom-full left-1/2 mb-1.5 -translate-x-1/2',
  bottom: 'top-full left-1/2 mt-1.5 -translate-x-1/2',
  right: 'left-full top-1/2 ml-2 -translate-y-1/2',
  left: 'right-full top-1/2 mr-2 -translate-y-1/2',
}

/**
 * Label on hover (after a short delay) and on keyboard focus. The trigger
 * carries the accessible name itself; the tooltip is decoration for sighted
 * users (aria-hidden).
 */
export function Tooltip({ label, shortcut, side = 'top', children, className }) {
  if (!label) return children
  return (
    <span className={cx('group/tip relative inline-flex', className)}>
      {children}
      <span
        aria-hidden="true"
        className={cx(
          'pointer-events-none absolute z-50 flex items-center gap-2 whitespace-nowrap rounded-chip border border-line bg-surface-2 px-2 py-1 text-meta text-ink shadow-float',
          'opacity-0 transition-opacity duration-150 group-hover/tip:opacity-100 group-hover/tip:delay-300 group-has-[:focus-visible]/tip:opacity-100',
          TOOLTIP_SIDES[side]
        )}
      >
        {label}
        {shortcut && <Kbd keys={shortcut} />}
      </span>
    </span>
  )
}

/**
 * Small popover menu behind an icon button. items: [{ label, icon, onSelect,
 * danger }]. Arrow keys move, Escape and a click outside close it.
 */
export function Menu({ label, icon, items, className }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const outside = (e) => !ref.current?.contains(e.target) && setOpen(false)
    const keys = (e) => {
      if (e.key === 'Escape') {
        setOpen(false)
        ref.current?.querySelector('[aria-haspopup]')?.focus()
        return
      }
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
      e.preventDefault()
      const entries = [...(ref.current?.querySelectorAll('[role="menuitem"]') ?? [])]
      const i = entries.indexOf(document.activeElement)
      const next = e.key === 'ArrowDown' ? (i + 1) % entries.length : (i - 1 + entries.length) % entries.length
      entries[next]?.focus()
    }
    document.addEventListener('mousedown', outside)
    document.addEventListener('keydown', keys)
    ref.current?.querySelector('[role="menuitem"]')?.focus()
    return () => {
      document.removeEventListener('mousedown', outside)
      document.removeEventListener('keydown', keys)
    }
  }, [open])

  return (
    <div ref={ref} className={cx('relative', className)}>
      <IconButton label={label} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {icon}
      </IconButton>
      {open && (
        <div role="menu" className="absolute right-0 top-full z-40 mt-1 min-w-48 rounded-control border border-line bg-surface p-1 shadow-float">
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false)
                item.onSelect()
              }}
              className={cx(
                'flex h-8 w-full items-center gap-2 rounded-[6px] px-2 text-left text-body transition-colors duration-150 focus:outline-none',
                item.danger ? 'text-missing hover:bg-missing/10 focus:bg-missing/10' : 'text-ink hover:bg-surface-2 focus:bg-surface-2'
              )}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/* ---------------- Transition exports (views not yet rebuilt) ---------------- */

/** Old panel → the card (removed with phase 11.9) */
export const Panel = Card

/** Old small-caps heading → quiet sentence-case label */
export function SectionTitle({ children, className }) {
  return <h3 className={cx('text-meta font-medium text-ink-2', className)}>{children}</h3>
}

const PILL_COLORS = {
  done: 'text-accent',
  draft: 'text-draft',
  sick: 'text-sick',
  vacation: 'text-vacation',
  holiday: 'text-holiday',
  neutral: 'text-ink-2',
  accent: 'text-accent',
}

/** Old status pill → a quiet chip (no dot) */
export function Pill({ color = 'neutral', children, className }) {
  return (
    <span className={cx('inline-flex h-6 items-center rounded-chip border border-line px-2 text-meta font-medium', PILL_COLORS[color], className)}>
      {children}
    </span>
  )
}
