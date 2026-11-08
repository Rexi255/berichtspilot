// One tab per day of the week (Alt+1–5): weekday, date, the day cell with its
// type letter, the state in words and the shortcut. The active tab carries
// the accent underline (E-032).
import { DayCell, DAY_STATE_LABELS, cx } from '../../ui/basics.jsx'
import { WEEKDAY_SHORT, dayLetter, dayState } from '../../lib/overview.js'
import { parseISO, weekdayName } from '../../lib/dates.js'

const shortDate = (iso) => {
  const [, m, d] = iso.split('-')
  return `${d}.${m}.`
}

export default function DayTabs({ days, selected, onSelect, today }) {
  return (
    // the shortcut hint only where the tabs are wide enough (container query)
    <div role="tablist" aria-label="Tage der Woche" className="@container/tabs grid auto-cols-fr grid-flow-col gap-1.5">
      {days.map((day, i) => {
        const active = day.date === selected
        const state = dayState(day, today)
        const short = WEEKDAY_SHORT[(parseISO(day.date).getDay() + 6) % 7]
        return (
          <button
            key={day.date}
            type="button"
            role="tab"
            id={`daytab-${day.date}`}
            data-daytab={day.date}
            aria-selected={active}
            aria-controls="day-panel"
            aria-label={`${weekdayName(day.date)}, ${shortDate(day.date)}, ${DAY_STATE_LABELS[state]}`}
            tabIndex={active ? 0 : -1}
            onClick={() => onSelect(day.date)}
            onKeyDown={(e) => {
              // arrow keys move between the tabs, like every tab list
              // (plain arrows only: Alt+←/→ belongs to the week change)
              if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
              if (e.altKey || e.ctrlKey || e.shiftKey || e.metaKey) return
              e.preventDefault()
              const next = days[(i + (e.key === 'ArrowRight' ? 1 : days.length - 1)) % days.length]
              onSelect(next.date)
              document.getElementById(`daytab-${next.date}`)?.focus()
            }}
            className={cx(
              'relative flex min-w-0 flex-col gap-1 rounded-control border px-2.5 pb-2.5 pt-2 text-left transition-colors duration-150',
              active ? 'border-line bg-surface' : 'border-transparent hover:bg-surface/70'
            )}
          >
            <span className="flex items-baseline justify-between gap-2">
              <span className={cx('truncate text-body font-medium tabular-nums', active ? 'text-ink' : 'text-ink-2')}>
                {short} {shortDate(day.date)}
              </span>
              <span className="hidden shrink-0 text-[11px] tabular-nums text-ink-2 @2xl/tabs:inline">Alt+{i + 1}</span>
            </span>
            <span className="flex min-w-0 items-center gap-1.5 text-meta text-ink-2">
              <DayCell size="tab" state={state} letter={dayLetter(day)} />
              <span className="truncate">{DAY_STATE_LABELS[state]}</span>
            </span>
            {active && <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-accent" aria-hidden="true" />}
          </button>
        )
      })}
    </div>
  )
}
