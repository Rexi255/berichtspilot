// Main window guard (step 7.1): the app window only ever shows the app itself,
// and only that page may use the IPC bridge. Without it, any page the window
// navigates to (a dropped file, a stray link) would get the full `window.api`
// via the preload — including `saveData`. Pure checks, tested in guard.test.mjs.
const path = require('node:path')
const { fileURLToPath } = require('node:url')

// Permission requests the app window may make: copying the output blocks
// (navigator.clipboard.writeText). Everything else (camera, notifications,
// geolocation …) is refused. Dictation (plan step 2.3) adds 'media' here.
const ALLOWED_PERMISSIONS = new Set(['clipboard-sanitized-write'])

/** Absolute file path of a file:// URL (query/hash ignored), or null. */
function filePathOf(url, windows) {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'file:') return null
    parsed.search = ''
    parsed.hash = ''
    return fileURLToPath(parsed, { windows })
  } catch {
    return null
  }
}

/**
 * Checker "is `url` the app's own page?": in dev any page of the Vite dev
 * server's origin, otherwise exactly the built index.html (compared as file
 * paths, so drive-letter case and percent-encoding can't cause a mismatch).
 */
function createAppUrlCheck({ devServerUrl, indexFile, platform = process.platform }) {
  const windows = platform === 'win32'
  if (devServerUrl) {
    const origin = new URL(devServerUrl).origin
    return (url) => {
      try {
        return new URL(url).origin === origin
      } catch {
        return false
      }
    }
  }
  const p = windows ? path.win32 : path.posix
  const normalize = (file) => (windows ? p.resolve(file).toLowerCase() : p.resolve(file))
  const target = normalize(indexFile)
  return (url) => {
    const file = filePathOf(url, windows)
    return file !== null && normalize(file) === target
  }
}

/**
 * true if an IPC call comes from the app's own page: the main window's
 * WebContents, its top frame (no iframe) and the app URL.
 */
function isTrustedSender(event, { webContents, isAppUrl }) {
  if (!webContents || webContents.isDestroyed?.()) return false
  if (event?.sender?.id !== webContents.id) return false
  const frame = event.senderFrame
  if (!frame || frame.parent) return false
  return isAppUrl(frame.url)
}

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)

/**
 * Minimal shape check before `data:save` writes daten.json — a last line
 * against bugs (e.g. saving `null`). Deliberately schema-version agnostic: the
 * full validation lives in src/lib/model.js. → German error text or null.
 */
function checkSaveData(data) {
  if (
    !isObject(data) ||
    !Number.isInteger(data.version) ||
    data.version < 1 ||
    !isObject(data.settings) ||
    !Array.isArray(data.profiles) ||
    !Array.isArray(data.weeks)
  ) {
    return 'Ungültige Daten — es wurde nichts gespeichert.'
  }
  return null
}

module.exports = { ALLOWED_PERMISSIONS, createAppUrlCheck, isTrustedSender, checkSaveData }
