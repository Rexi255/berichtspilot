// The day tiles above the day cards (E-032, all days on one page since
// 2026-11-08): weekday, date, the day cell with its type letter, the state in
// words and the shortcut. They stay put at the top while the cards scroll
// below them; a click (or Alt+1–5) scrolls to that day, and the accent
// underline follows the day at the top of the list.
import { DayCell, DAY_STATE_LABELS, cx } from '../../ui/basics.jsx'
import { WEEKDAY_SHORT, dayLetter, dayState } from '../../lib/overview.js'
import { parseISO, weekdayName } from '../../lib/dates.js'

const shortDate = (iso) => {
  const [, m, d] = iso.split('-')
  return `${d}.${m}.`
}

export default function DayTabs({ days, active, onJump, today }) {
  return (
    // the shortcut hint only where the tiles are wide enough (container query)
    <nav aria-label="Tage der Woche" className="@container/tabs grid auto-cols-fr grid-flow-col gap-1.5">
      {days.map((day, i) => {
        const current = day.date === active
        const state = dayState(day, today)
        const short = WEEKDAY_SHORT[(parseISO(day.date).getDay() + 6) % 7]
        return (
          <button
            key={day.date}
            type="button"
            data-daytab={day.date}
            aria-current={current ? 'location' : undefined}
            aria-label={`Zu ${weekdayName(day.date)}, ${shortDate(day.date)} springen, ${DAY_STATE_LABELS[state]}`}
            onClick={() => onJump(day.date)}
            className={cx(
              'relative flex min-w-0 flex-col gap-1 rounded-control border px-2.5 pb-2.5 pt-2 text-left transition-colors duration-150',
              current ? 'border-line bg-surface' : 'border-transparent hover:bg-surface/70'
            )}
          >
            <span className="flex items-baseline justify-between gap-2">
              <span className={cx('truncate text-body font-medium tabular-nums', current ? 'text-ink' : 'text-ink-2')}>
                {short} {shortDate(day.date)}
              </span>
              <span className="hidden shrink-0 text-[11px] tabular-nums text-ink-2 @2xl/tabs:inline">Alt+{i + 1}</span>
            </span>
            <span className="flex min-w-0 items-center gap-1.5 text-meta text-ink-2">
              <DayCell size="tab" state={state} letter={dayLetter(day)} />
              <span className="truncate">{DAY_STATE_LABELS[state]}</span>
            </span>
            {current && <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-accent" aria-hidden="true" />}
          </button>
        )
      })}
    </nav>
  )
}
