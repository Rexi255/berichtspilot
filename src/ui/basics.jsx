// Small, consistent building blocks of the design system.
export const cx = (...parts) => parts.filter(Boolean).join(' ')

const BUTTON_VARIANTS = {
  primary:
    'bg-accent text-inset font-semibold hover:bg-accent-light border border-transparent shadow-[0_1px_10px_-2px_var(--color-accent-deep)]',
  outline:
    'border border-white/10 bg-white/[0.04] text-ink hover:bg-white/[0.08] hover:border-white/15',
  ghost: 'border border-transparent text-ink-2 hover:bg-white/[0.06] hover:text-ink',
  danger: 'border border-transparent text-sick/90 hover:bg-sick/10 hover:text-sick',
}

const BUTTON_SIZES = {
  sm: 'h-7 px-2.5 text-[12.5px] gap-1 rounded-md',
  md: 'h-9 px-3.5 text-[13.5px] gap-1.5 rounded-lg',
}

export function Button({ variant = 'outline', size = 'md', className, ...props }) {
  return (
    <button
      type="button"
      className={cx(
        'inline-flex select-none items-center justify-center whitespace-nowrap font-medium',
        'transition-[background-color,border-color,color,transform] duration-150 ease-(--ease-smooth)',
        'active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40',
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        className
      )}
      {...props}
    />
  )
}

/** Square icon button (move/delete bullets etc.); `label` becomes title + aria-label */
export function IconButton({ className, danger = false, label, ...props }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className={cx(
        'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-transparent',
        'text-ink-3 transition-[background-color,color,transform] duration-150 ease-(--ease-smooth) active:scale-90',
        danger ? 'hover:bg-sick/10 hover:text-sick' : 'hover:bg-white/[0.07] hover:text-ink',
        'disabled:pointer-events-none disabled:opacity-30',
        className
      )}
      {...props}
    />
  )
}

export function Input({ className, ...props }) {
  return (
    <input
      className={cx(
        'h-9 w-full rounded-lg border border-white/[0.07] bg-inset/60 px-3 text-[13.5px] text-ink',
        'placeholder:text-ink-3 transition-colors duration-150',
        'hover:border-white/[0.12] focus:border-accent-deep focus:outline-none',
        className
      )}
      {...props}
    />
  )
}

export function TextArea({ className, ...props }) {
  return (
    <textarea
      className={cx(
        'w-full resize-y rounded-lg border border-white/[0.07] bg-inset/60 px-3 py-2 text-[13.5px] text-ink',
        'placeholder:text-ink-3 transition-colors duration-150',
        'hover:border-white/[0.12] focus:border-accent-deep focus:outline-none',
        className
      )}
      {...props}
    />
  )
}

export function Select({ className, children, ...props }) {
  return (
    <select
      className={cx(
        'h-9 rounded-lg border border-white/[0.07] bg-inset/60 py-0 pl-2.5 pr-7 text-[13.5px] text-ink',
        'transition-colors duration-150 hover:border-white/[0.12] focus:border-accent-deep focus:outline-none',
        '[&>option]:bg-surface [&>option]:text-ink',
        className
      )}
      {...props}
    >
      {children}
    </select>
  )
}

/** Segmented control (e.g. Normal/Feiertag/Krank/Urlaub); options: [{ value, label }] */
export function Segment({ options, value, onChange, size = 'md', className }) {
  return (
    <div
      role="group"
      className={cx(
        'inline-flex items-center gap-0.5 rounded-lg border border-white/[0.07] bg-inset/60 p-0.5',
        className
      )}
    >
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={cx(
              'rounded-[6px] font-medium transition-[background-color,color] duration-150 ease-(--ease-smooth)',
              size === 'sm' ? 'h-6 px-2 text-[11.5px]' : 'h-7 px-2.5 text-[12.5px]',
              active
                ? 'bg-surface-2 text-ink shadow-[inset_0_0_0_1px_oklch(1_0_0/0.06)]'
                : 'text-ink-3 hover:text-ink-2'
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
    <label className={cx('inline-flex cursor-pointer select-none items-center gap-2.5', disabled && 'pointer-events-none opacity-40', className)}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cx(
          'relative h-5 w-9 shrink-0 rounded-full border transition-[background-color,border-color] duration-150 ease-(--ease-smooth)',
          checked ? 'border-transparent bg-accent' : 'border-white/[0.1] bg-inset/60 hover:border-white/20'
        )}
      >
        <span
          className={cx(
            'absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full transition-[left,background-color] duration-150 ease-(--ease-smooth)',
            checked ? 'left-[18px] bg-inset' : 'left-[2px] bg-ink-3'
          )}
        />
      </button>
      {label && <span className="text-[13px] font-medium text-ink">{label}</span>}
    </label>
  )
}

const PILL_COLORS = {
  done: 'text-done bg-done/10 border-done/20',
  draft: 'text-draft bg-draft/10 border-draft/20',
  sick: 'text-sick bg-sick/10 border-sick/20',
  vacation: 'text-vacation bg-vacation/10 border-vacation/20',
  holiday: 'text-holiday bg-holiday/10 border-holiday/20',
  neutral: 'text-ink-2 bg-white/[0.05] border-white/10',
  accent: 'text-accent bg-accent/10 border-accent/20',
}

/** Small status pill with a dot */
export function Pill({ color = 'neutral', children, className, dot = true }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11.5px] font-medium',
        PILL_COLORS[color],
        className
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  )
}

/** Labeled field (label above the control) */
export function Field({ label, hint, children, className }) {
  return (
    <label className={cx('flex flex-col gap-1.5', className)}>
      <span className="text-[12px] font-medium tracking-wide text-ink-2">{label}</span>
      {children}
      {hint && <span className="text-[11.5px] text-ink-3">{hint}</span>}
    </label>
  )
}

/** Section heading in small-caps style */
export function SectionTitle({ children, className }) {
  return (
    <h3 className={cx('text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-3', className)}>
      {children}
    </h3>
  )
}

/** Panel surface of the design system — "lit from above": subtle top highlight
 *  (inset light edge), soft vertical gradient and a soft drop shadow. */
export function Panel({ className, ...props }) {
  return (
    <div
      className={cx(
        'rounded-xl border border-white/[0.06] bg-surface/80',
        'bg-gradient-to-b from-white/[0.035] to-transparent to-[45%]',
        'shadow-[inset_0_1px_0_0_oklch(1_0_0/0.05),0_2px_8px_-4px_oklch(0_0_0/0.45)]',
        className
      )}
      {...props}
    />
  )
}
