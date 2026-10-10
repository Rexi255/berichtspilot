// Auto-update (DECISIONS E-017): electron-updater with the GitHub provider.
// Nothing happens behind the user's back — `check()` only asks GitHub whether
// a newer release exists, `download()` and `install()` run only after a click.
// electron-updater does its own requests in its own session partition, so the
// host allowlist (E-007) is enforced there via webRequest instead of net.js.
const fs = require('node:fs')
const path = require('node:path')
const { UPDATE_HOSTS, isAllowedUrl, describeFailure } = require('./net')

// electron-updater's session (its NET_SESSION_NAME, created with cache: false)
const PARTITION = 'electron-updater'

// electron-updater sends a random per-install UUID (stored in userData/.updaterId)
// with every request, meant for staged rollouts we don't use. It identifies the
// device across checks, so it never leaves the machine (E-017: version + IP only).
const STRIPPED_HEADERS = new Set(['x-user-staging-id'])

// "Nothing to update to": the newest release carries no latest*.yml (v1.2.0 and
// older, or a release whose assets are still uploading) or there is no
// production release at all — not an error the user can do anything about
const NO_UPDATE_CODES = new Set(['ERR_UPDATER_CHANNEL_FILE_NOT_FOUND', 'ERR_UPDATER_NO_PUBLISHED_VERSIONS'])

// GitHubProvider wraps the 404 of /releases/latest (only prereleases, no
// production release) as ERR_UPDATER_INVALID_RELEASE_FEED — recognisable only
// by the nested message
const NO_LATEST_RELEASE = /Unable to find latest version on GitHub[\s\S]*HttpError: 404\b/

/** The NSIS installer puts its uninstaller next to the .exe — an unpacked folder has none. */
function hasNsisUninstaller(dir = path.dirname(process.execPath)) {
  try {
    return fs.readdirSync(dir).some((name) => /^Uninstall .+\.exe$/i.test(name))
  } catch {
    return false
  }
}

/**
 * Can this copy of the app replace itself? Only the packaged NSIS install
 * (Windows, uninstaller present) and the AppImage (Linux, `APPIMAGE` set). Dev
 * mode, a self-built portable .exe and unpacked folders (`win-unpacked`, a
 * copied folder) never send an update request.
 */
function updateSupport({
  isPackaged,
  platform = process.platform,
  env = process.env,
  nsisInstalled = hasNsisUninstaller,
}) {
  if (!isPackaged) return { ok: false, error: 'Updates gibt es nur in der installierten App.' }
  if (platform === 'win32' && !env.PORTABLE_EXECUTABLE_DIR && nsisInstalled()) return { ok: true }
  if (platform === 'linux' && env.APPIMAGE) return { ok: true }
  return { ok: false, error: 'Diese Version kann sich nicht selbst aktualisieren. Neue Versionen gibt es auf GitHub.' }
}

/** Request headers without the ones that must not leave the machine. */
function stripHeaders(headers = {}) {
  return Object.fromEntries(Object.entries(headers).filter(([name]) => !STRIPPED_HEADERS.has(name.toLowerCase())))
}

/** true if electron-updater's error only means "no newer release with update metadata". */
function meansNoUpdate(error) {
  const known =
    NO_UPDATE_CODES.has(error?.code) ||
    (error?.code === 'ERR_UPDATER_INVALID_RELEASE_FEED' && NO_LATEST_RELEASE.test(error?.message || ''))
  if (!known) return false
  // These errors wrap the underlying request error — offline must stay offline
  return !['offline', 'timeout', 'tls'].includes(describeFailure({ error }).code)
}

/** Map an electron-updater error to `{ code, error }` with a German text. */
function describeUpdateError(error) {
  const text = `${error?.name || ''} ${error?.code || ''} ${error?.message || ''}`
  if (/ERR_BLOCKED_BY_CLIENT/.test(text)) {
    return { code: 'blocked', error: 'Das Update wollte eine nicht erlaubte Adresse laden und wurde gestoppt.' }
  }
  const net = describeFailure({ error })
  if (['offline', 'timeout', 'tls'].includes(net.code)) return net
  const status = error?.statusCode
  if (Number.isInteger(status) && status > 0) {
    if (status === 403 || status === 429) {
      return { code: 'rate-limit', error: 'GitHub lehnt gerade Anfragen ab. Bitte später erneut versuchen.' }
    }
    if (status >= 500) return describeFailure({ status })
    return { code: 'http', error: `GitHub lehnt die Anfrage ab (HTTP ${status}).` }
  }
  if (/ERR_UPDATER_INVALID_SIGNATURE|checksum mismatch/i.test(text)) {
    return { code: 'integrity', error: 'Die heruntergeladene Datei ist beschädigt oder nicht echt. Bitte erneut herunterladen.' }
  }
  if (/net::ERR_/.test(text)) return net
  return { code: 'update', error: 'Das Update ist fehlgeschlagen. Bitte später erneut versuchen.' }
}

/**
 * Update handle for main.js. Dependencies are injectable so the flow runs in
 * Vitest without Electron: `loadUpdater` returns electron-updater's
 * `autoUpdater` (required lazily — only when a check actually runs),
 * `getSession` Electron's `session` module. `onChange(status)` fires on every
 * status change (main forwards it to the renderer).
 *
 * Status: `{ ok, state, current, version?, percent?, code?, error? }` with
 * state 'idle' | 'checking' | 'available' | 'none' | 'downloading' | 'ready' |
 * 'error' | 'unsupported'; `ok` is false only for 'error'.
 */
function createUpdater({
  app,
  onChange = () => {},
  loadUpdater = () => require('electron-updater').autoUpdater,
  getSession = () => require('electron').session,
  platform = process.platform,
  env = process.env,
  nsisInstalled = hasNsisUninstaller,
}) {
  const current = app.getVersion()
  const support = updateSupport({ isPackaged: app.isPackaged, platform, env, nsisInstalled })
  let status = support.ok
    ? { ok: true, state: 'idle', current }
    : { ok: true, state: 'unsupported', current, error: support.error }
  let updater = null
  let available = null // version found by the last successful check
  let pending = null // in-flight check, shared by concurrent callers
  let installing = false // quitAndInstall went through, the app is quitting

  function set(next) {
    status = { ok: next.state !== 'error', current, ...next }
    onChange(status)
    return status
  }

  function init() {
    if (updater) return updater
    // Allowlist first: every request of that session (incl. redirects) is checked
    const { webRequest } = getSession().fromPartition(PARTITION, { cache: false })
    webRequest.onBeforeRequest((details, callback) => callback({ cancel: !isAllowedUrl(details.url, UPDATE_HOSTS) }))
    webRequest.onBeforeSendHeaders((details, callback) =>
      callback({ requestHeaders: stripHeaders(details.requestHeaders) })
    )
    const u = loadUpdater()
    u.autoDownload = false
    u.autoInstallOnAppQuit = false
    u.logger = null
    // Check/download failures are reported through the rejected promises below
    // (install() listens on its own); without a listener an 'error' event would
    // crash the main process
    u.on('error', () => {})
    u.on('download-progress', (progress) => {
      const percent = Math.max(0, Math.min(100, Math.floor(progress?.percent || 0)))
      if (status.state === 'downloading' && percent !== status.percent) set({ ...status, percent })
    })
    updater = u
    return u
  }

  async function runCheck() {
    set({ state: 'checking' })
    available = null
    try {
      const result = await init().checkForUpdates()
      const version = result?.isUpdateAvailable ? result.updateInfo?.version : null
      available = version || null
      return set(available ? { state: 'available', version: available } : { state: 'none' })
    } catch (error) {
      if (meansNoUpdate(error)) return set({ state: 'none' })
      return set({ state: 'error', ...describeUpdateError(error) })
    }
  }

  /** Ask GitHub for a newer release (never downloads). */
  function check() {
    if (['unsupported', 'downloading', 'ready'].includes(status.state)) return Promise.resolve(status)
    if (!pending) {
      const p = runCheck().finally(() => {
        if (pending === p) pending = null
      })
      pending = p
    }
    return pending
  }

  /** Download the release found by the last check (after the user clicked). */
  async function download() {
    if (!available || pending || ['downloading', 'ready'].includes(status.state)) return status
    const version = available
    set({ state: 'downloading', version, percent: 0 })
    try {
      await updater.downloadUpdate()
      return set({ state: 'ready', version })
    } catch (error) {
      return set({ state: 'error', version, ...describeUpdateError(error) })
    }
  }

  /**
   * Quit and install the downloaded update. The installer runs silently into
   * the existing folder and starts the app again. The renderer must have saved
   * daten.json before calling this (see `installUpdate` in src/store.jsx).
   */
  function install() {
    // A second click (sidebar + Settings) must not call quitAndInstall again:
    // a refused repeat call resets electron-updater's own double-call guard
    if (installing) return { ok: true }
    if (status.state !== 'ready') return { ok: false, error: 'Es ist noch kein Update heruntergeladen.' }
    // quitAndInstall() returns nothing; a refused install (installer file gone …)
    // is only reported through a synchronous 'error' event
    let failure = null
    const onError = (error) => {
      failure = failure || error || new Error('install failed')
    }
    updater.on('error', onError)
    try {
      updater.quitAndInstall(true, true)
    } catch (error) {
      failure = failure || error
    } finally {
      updater.removeListener('error', onError)
    }
    if (failure) {
      set({ state: 'error', version: status.version, ...describeUpdateError(failure) })
      return { ok: false, error: status.error }
    }
    installing = true
    return { ok: true }
  }

  return { status: () => status, check, download, install }
}

module.exports = { createUpdater, updateSupport, describeUpdateError, meansNoUpdate, stripHeaders, PARTITION }
