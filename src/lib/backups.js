// Snapshots in sicherungen/ (E-024, electron/storage.js) → what Settings shows.
// A snapshot arrives as `{ name, date, time, reason, size }` (`time` is null for
// the daily one — it holds the state before that day's first save).
import { formatDE, weekdayName } from './dates.js'

/** German label per snapshot reason */
export const BACKUP_KINDS = {
  daily: 'Tagesbeginn',
  update: 'Vor dem Update',
  import: 'Vor dem Import',
  restore: 'Vor dem Wiederherstellen',
}

/** "Fr, 16.10.2026 · 14:32" — without a time for the daily snapshot. */
export function backupTitle({ date, time } = {}) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? '')) return ''
  const day = weekdayName(date).slice(0, 2)
  return `${day}, ${formatDE(date)}${time ? ` · ${time.slice(0, 5)}` : ''}`
}

/** File size for the list: "412 KB", "1,3 MB". */
export function sizeLabel(bytes) {
  const n = Number(bytes) || 0
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`
  return `${(n / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`
}
