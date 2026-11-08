// Keyboard shortcuts (E-032) — the one source for every handler and for the
// list in Settings → Tastaturkürzel. Matching uses `code` (the physical key),
// so Strg+Umschalt+1 works on a German layout where Shift+1 types "!".
// AltGr arrives as Ctrl+Alt: Ctrl shortcuts require Alt to be up and vice
// versa, so typing "²" or "@" never triggers anything.

const DIGITS = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6']

/**
 * Shortcut definitions: `scope` says where it applies (`global`, `editor`,
 * `overview`), `test(e)` returns the argument (index, direction …) or
 * undefined. Order matters only for the help list.
 */
const DEFINITIONS = [
  {
    id: 'view',
    scope: 'global',
    test: (e) => (e.ctrl && e.shift && !e.alt ? indexOf(e.code, 4) : undefined),
  },
  { id: 'sidebar', scope: 'global', test: (e) => (e.ctrl && !e.shift && !e.alt && e.code === 'KeyB' ? true : undefined) },
  { id: 'copy', scope: 'editor', test: (e) => (e.ctrl && !e.shift && !e.alt ? indexOf(e.code, 3) : undefined) },
  { id: 'preview', scope: 'editor', test: (e) => (e.ctrl && !e.shift && !e.alt && e.code === 'KeyP' ? true : undefined) },
  { id: 'notes', scope: 'editor', test: (e) => (e.ctrl && e.shift && !e.alt && e.code === 'KeyN' ? true : undefined) },
  { id: 'day', scope: 'editor', test: (e) => (e.alt && !e.ctrl && !e.shift ? indexOf(e.code, 6) : undefined) },
  {
    id: 'week',
    scope: 'editor',
    test: (e) => {
      if (!e.alt || e.ctrl || e.shift) return undefined
      if (e.code === 'ArrowLeft') return -1
      if (e.code === 'ArrowRight') return 1
      return undefined
    },
  },
  { id: 'createWeek', scope: 'editor', test: (e) => (e.ctrl && !e.shift && !e.alt && e.code === 'KeyN' ? true : undefined) },
  { id: 'search', scope: 'overview', test: (e) => (e.ctrl && !e.shift && !e.alt && e.code === 'KeyF' ? true : undefined) },
]

// "Digit3" → 2 when within the first `count` digits
function indexOf(code, count) {
  const i = DIGITS.indexOf(code)
  return i >= 0 && i < count ? i : undefined
}

/**
 * The shortcut a key event triggers in the active `scopes`, as
 * `{ id, arg }` — or null. Takes a DOM KeyboardEvent or any object with
 * `code`, `ctrlKey`, `shiftKey`, `altKey`. Cmd (meta) is not used: the app
 * runs on Windows and Linux.
 */
export function matchShortcut(event, scopes = ['global']) {
  if (!event || event.metaKey || event.repeat) return null
  const e = { code: event.code, ctrl: Boolean(event.ctrlKey), shift: Boolean(event.shiftKey), alt: Boolean(event.altKey) }
  for (const def of DEFINITIONS) {
    if (!scopes.includes(def.scope)) continue
    const arg = def.test(e)
    if (arg !== undefined) return { id: def.id, arg }
  }
  return null
}

/**
 * Settings → Tastaturkürzel: [keys, what it does]. Keys are split at "+"
 * into keycaps; " / " separates alternatives.
 */
export const SHORTCUT_HELP = [
  ['Strg+Umschalt+1 … 4', 'Übersicht, Woche, Profile, Einstellungen öffnen'],
  ['Strg+B', 'Seitenleiste ein- oder ausklappen'],
  ['Strg+1 / 2 / 3', 'Block Betrieb, Unterweisungen oder Berufsschule kopieren'],
  ['Strg+P', 'Vorschau ein- oder ausblenden'],
  ['Strg+Umschalt+N', 'Notizen-Bereich ein- oder ausblenden'],
  ['Alt+1 … 6', 'Zu einem Tag der Woche springen (Alt+6 nur mit Samstag)'],
  ['Alt+← / →', 'Vorherige oder nächste Woche'],
  ['Strg+N', 'Woche anlegen, falls sie noch fehlt'],
  ['Strg+F', 'In der Übersicht suchen'],
  ['Enter', 'Neuer Stichpunkt unter dem aktuellen'],
  ['Backspace', 'Leeren Stichpunkt entfernen'],
  ['↑ / ↓', 'Vorschlag wählen, Enter übernimmt'],
]

/** Keycap label for one action, e.g. the tooltip "Strg+B" of the sidebar button */
export const SHORTCUT_KEYS = {
  views: ['Strg+Umschalt+1', 'Strg+Umschalt+2', 'Strg+Umschalt+3', 'Strg+Umschalt+4'],
  sidebar: 'Strg+B',
  copy: ['Strg+1', 'Strg+2', 'Strg+3'],
  preview: 'Strg+P',
  notes: 'Strg+Umschalt+N',
  days: ['Alt+1', 'Alt+2', 'Alt+3', 'Alt+4', 'Alt+5', 'Alt+6'],
  search: 'Strg+F',
}
