// Navigation sidebar (E-032): four entries, a badge with the weeks still
// missing, collapsible to a 68 px icon rail (Strg+B, saved in
// settings.layout). At the bottom: the update hint, a red chip while a save
// fails — so data loss can't go unnoticed — and the switches for the color
// mode and the rail.
import { useMemo } from 'react'
import {
  SquaresFourIcon,
  PencilSimpleLineIcon,
  CalendarDotsIcon,
  GearSixIcon,
  WarningIcon,
  SunIcon,
  MoonIcon,
  SidebarSimpleIcon,
} from '@phosphor-icons/react'
import { useStore } from '../store.jsx'
import { overviewStats } from '../lib/overview.js'
import { useCurrentMonday } from './useCurrentMonday.js'
import { SHORTCUT_KEYS } from '../lib/shortcuts.js'
import { Badge, IconButton, Tooltip, cx } from './basics.jsx'
import UpdateHint from './UpdateHint.jsx'

const ENTRIES = [
  { id: 'overview', label: 'Übersicht', Icon: SquaresFourIcon },
  { id: 'editor', label: 'Woche', Icon: PencilSimpleLineIcon },
  { id: 'profiles', label: 'Profile', Icon: CalendarDotsIcon },
  { id: 'settings', label: 'Einstellungen', Icon: GearSixIcon },
]

function NavItem({ entry, index, active, collapsed, badge, onClick }) {
  const { Icon } = entry
  const missingText = badge === 1 ? '1 Woche ohne Eintrag' : `${badge} Wochen ohne Eintrag`
  const button = (
    <button
      type="button"
      data-nav={entry.id}
      aria-current={active ? 'page' : undefined}
      aria-label={collapsed ? (badge > 0 ? `${entry.label}, ${missingText}` : entry.label) : undefined}
      onClick={onClick}
      className={cx(
        'relative flex h-9 items-center rounded-control text-body font-medium transition-colors duration-150',
        collapsed ? 'w-11 justify-center' : 'w-full gap-3 px-3',
        active ? 'bg-surface-2 text-ink' : 'text-ink-2 hover:bg-surface hover:text-ink'
      )}
    >
      <Icon size={18} className={cx('shrink-0', active && 'text-accent')} />
      {!collapsed && <span className="min-w-0 flex-1 truncate text-left">{entry.label}</span>}
      {badge > 0 &&
        (collapsed ? (
          <Badge className="absolute -right-1 -top-1 h-4 min-w-4 bg-sidebar text-[10px]">{badge}</Badge>
        ) : (
          <>
            <Badge aria-hidden="true">{badge}</Badge>
            <span className="sr-only">, {missingText}</span>
          </>
        ))}
    </button>
  )
  if (!collapsed) return button
  return (
    <Tooltip label={entry.label} shortcut={SHORTCUT_KEYS.views[index]} side="right">
      {button}
    </Tooltip>
  )
}

/**
 * "Nicht gespeichert" in red while a save fails; otherwise nothing — the
 * normal case needs no badge (user, 2026-11-08). The live region stays
 * mounted and only changes its text: a region that appears together with
 * its text is often not announced.
 */
function SaveErrorChip({ collapsed, saveStatus, onOpen }) {
  const failed = saveStatus === 'error'
  const text = 'Nicht gespeichert'
  const tip = 'Speichern fehlgeschlagen, Einstellungen öffnen'
  return (
    <>
      <span className="sr-only" aria-live="polite">
        {failed ? 'Speichern fehlgeschlagen' : ''}
      </span>
      {failed && (
        <Tooltip label={tip} side={collapsed ? 'right' : 'top'} className={collapsed ? '' : 'w-full'}>
          <button
            type="button"
            onClick={onOpen}
            aria-label={collapsed ? `${text}. ${tip}` : undefined}
            className={cx(
              'flex h-8 items-center rounded-control border border-missing/60 text-meta font-medium text-missing transition-colors duration-150 hover:bg-missing/10',
              collapsed ? 'w-11 justify-center' : 'w-full gap-2 px-2.5'
            )}
          >
            <WarningIcon size={15} className="shrink-0" />
            {!collapsed && <span className="truncate">{text}</span>}
          </button>
        </Tooltip>
      )}
    </>
  )
}

export default function Sidebar({ view, onView }) {
  const { data, saveStatus, setAppearance, setLayout } = useStore()
  const collapsed = data.settings.layout.sidebarCollapsed
  const dark = data.settings.appearance.mode === 'dark'

  // Badge: due weeks without a report (same count as the overview); the
  // running week updates on its own when the app stays open over a weekend
  const currentMonday = useCurrentMonday()
  const missing = useMemo(
    () => overviewStats(data, currentMonday).missing.length,
    // only the weeks, the training dates, the ignored stretch and the running
    // week change the count
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.weeks, data.settings.trainingStart, data.settings.trainingEnd, data.settings.ignoredUntil, currentMonday]
  )

  return (
    <aside
      className={cx(
        'flex shrink-0 flex-col border-r border-line bg-sidebar',
        collapsed ? 'w-[68px] items-center' : 'w-[232px]'
      )}
    >
      <nav aria-label="Ansichten" className={cx('flex flex-col gap-1 py-3', collapsed ? 'items-center' : 'px-3')}>
        {ENTRIES.map((entry, index) => (
          <NavItem
            key={entry.id}
            entry={entry}
            index={index}
            active={view === entry.id}
            collapsed={collapsed}
            badge={entry.id === 'overview' ? missing : 0}
            onClick={() => onView(entry.id)}
          />
        ))}
      </nav>

      <div className={cx('mt-auto flex flex-col gap-2 py-3', collapsed ? 'items-center' : 'px-3')}>
        {!collapsed && <UpdateHint />}
        <SaveErrorChip collapsed={collapsed} saveStatus={saveStatus} onOpen={() => onView('settings')} />
        <div className={cx('flex gap-1', collapsed ? 'flex-col items-center' : 'items-center justify-between')}>
          <IconButton
            label={dark ? 'Helles Design' : 'Dunkles Design'}
            side={collapsed ? 'right' : 'top'}
            onClick={() => setAppearance({ mode: dark ? 'light' : 'dark' })}
          >
            {dark ? <SunIcon size={17} /> : <MoonIcon size={17} />}
          </IconButton>
          <IconButton
            label={collapsed ? 'Seitenleiste ausklappen' : 'Seitenleiste einklappen'}
            shortcut={SHORTCUT_KEYS.sidebar}
            side={collapsed ? 'right' : 'top'}
            aria-expanded={!collapsed}
            onClick={() => setLayout({ sidebarCollapsed: !collapsed })}
          >
            <SidebarSimpleIcon size={17} />
          </IconButton>
        </div>
      </div>
    </aside>
  )
}
