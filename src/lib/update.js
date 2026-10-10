// Auto-update status (E-017, electron/updater.js) → what the UI shows.
// Status: `{ ok, state, current, version?, percent?, code?, error? }`; on
// 'error', `version` is set only if a download/install failed — otherwise the
// check itself failed. Retrying either one downloads again (a cached, verified
// file is reused; a missing installer is fetched anew).

/** "v1.3.0" → "1.3.0" — one normaliser for every place that shows a version */
const bareVersion = (version) => String(version ?? '').replace(/^v/i, '')

/** "1.3.0" → "v1.3.0" (electron-updater reports versions without the v) */
export const versionLabel = (version) => (version ? `v${bareVersion(version)}` : '')

/**
 * The quiet hint in the sidebar: only while a found release needs a click.
 * null = show nothing (no release found, check failed, dev/portable …).
 * step: 'download' | 'downloading' | 'install' | 'retry'
 */
export function updateHint(status) {
  if (!status?.version) return null
  const { state, version } = status
  if (state === 'available') return { step: 'download', version }
  if (state === 'downloading') return { step: 'downloading', version, percent: clampPercent(status.percent) }
  if (state === 'ready') return { step: 'install', version }
  if (state === 'error') return { step: 'retry', version, error: status.error || '' }
  return null
}

/**
 * One line for Settings → "Updates": result of the last check.
 * tone = Pill color of src/ui/basics.jsx.
 */
export function updateSummary(status) {
  if (!status) return { tone: 'neutral', text: 'Wird geprüft …' }
  const v = `Version ${bareVersion(status.version)}`
  switch (status.state) {
    case 'checking':
      return { tone: 'neutral', text: 'Suche nach Updates …' }
    case 'none':
      return { tone: 'done', text: 'Du hast die neueste Version' }
    case 'available':
      return { tone: 'accent', text: `${v} verfügbar` }
    case 'downloading':
      return { tone: 'accent', text: `${v} wird heruntergeladen … ${clampPercent(status.percent)} %` }
    case 'ready':
      return { tone: 'done', text: `${v} bereit zur Installation` }
    case 'error':
      return { tone: 'sick', text: status.error || 'Update fehlgeschlagen' }
    case 'unsupported':
      return { tone: 'neutral', text: status.error || 'Updates nicht verfügbar' }
    default:
      return { tone: 'neutral', text: 'Noch nicht gesucht' }
  }
}

/** "Nach Updates suchen" makes sense now (not while busy, not once downloaded). */
export const canCheckForUpdate = (status) =>
  !!status && !['unsupported', 'checking', 'downloading', 'ready'].includes(status.state)

const clampPercent = (p) => Math.max(0, Math.min(100, Math.floor(Number(p) || 0)))
