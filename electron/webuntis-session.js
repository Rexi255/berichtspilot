// WebUntis session handling, path W1 (DECISIONS E-013): the user logs in via the
// school's SSO in an isolated window (own partition, no preload, no Node). The
// app never sees the password — it only uses that window's cookies to fetch the
// short-lived bearer token from `/api/token/new`. The token stays in the main
// process (needed for the API calls in step 4.5); the renderer only learns
// "logged in?" and the person id.
const { request } = require('./net')
const { isJwt, decodeJwtPayload, expiresSoon } = require('./jwt')

const HOST = 'bbz-dithmarschen.webuntis.com'
const SCHOOL = 'bbz-dithmarschen'
// Shown read-only in Settings (sent along with every status, not stored)
const SCHOOL_INFO = { name: 'BBZ Dithmarschen', host: HOST }
const BASE = `https://${HOST}/WebUntis`
const LOGIN_URL = `${BASE}/?school=${SCHOOL}`
const TOKEN_URL = `${BASE}/api/token/new`
const PARTITION = 'persist:webuntis'
const LOGIN_POLL_MS = 2000

const NOT_LOGGED_IN = { ok: false, code: 'auth', error: 'Bitte erneut anmelden.' }
const DISABLED = { ok: false, code: 'disabled', error: 'WebUntis ist ausgeschaltet.' }

/**
 * Session handle for the WebUntis account. Dependencies are injectable so the
 * token logic runs in Vitest without Electron: `fetchImpl` replaces the
 * partition's `session.fetch`, `now` the clock. Electron is only required when
 * a real session or window is needed.
 */
function createWebUntisSession({ fetchImpl, now = Date.now, electron = () => require('electron') } = {}) {
  let cached = null // { token, payload } — never leaves the main process
  let pending = null // in-flight token request, shared by concurrent callers
  let login = null // { win, promise } while the login window is open
  let generation = 0 // bumped by logout(): late answers from before it are discarded
  let permissionsLocked = false
  // Mirrors settings.webuntis.enabled (set by the renderer on load and on every
  // change). Off = no WebUntis request at all, whatever path asks for one.
  let enabled = false
  // The web session is a session cookie, so after an app start (and after an
  // auth failure or logout) we know we're logged out — status() then answers
  // without a request; only an explicit login asks the server again.
  let loggedOut = true

  function partition() {
    const ses = electron().session.fromPartition(PARTITION)
    if (!permissionsLocked) {
      // WebUntis needs no camera, notifications, geolocation …
      ses.setPermissionRequestHandler((_wc, _permission, callback) => callback(false))
      permissionsLocked = true
    }
    return ses
  }

  async function fetchToken() {
    const gen = generation
    // The server labels the bare JWT as application/json → read it as text
    const res = await request(TOKEN_URL, { expect: 'text', ...(fetchImpl ? { fetchImpl } : { ses: partition() }) })
    if (gen !== generation) return NOT_LOGGED_IN
    if (!res.ok) {
      if (res.code === 'auth') {
        cached = null
        loggedOut = true
      }
      return res
    }
    const text = typeof res.data === 'string' ? res.data.trim() : ''
    const payload = decodeJwtPayload(text)
    // 200 without a JWT = the session is gone (WebUntis then serves a web page)
    if (!isJwt(text) || !payload) {
      cached = null
      loggedOut = true
      return NOT_LOGGED_IN
    }
    cached = { token: text, payload }
    loggedOut = false
    return { ok: true, ...cached }
  }

  /**
   * Current bearer token for API calls (main process only — never send it to
   * the renderer). The token lives 15 min and is renewed shortly before expiry
   * through the same call, as long as the web session lives.
   * → `{ ok: true, token, payload }` or `{ ok: false, code, error }`
   */
  async function getToken({ force = false } = {}) {
    if (!enabled) return DISABLED
    if (!force && cached && !expiresSoon(cached.payload, now())) return { ok: true, ...cached }
    if (!pending) {
      const p = fetchToken().finally(() => {
        if (pending === p) pending = null
      })
      pending = p
    }
    return pending
  }

  function toStatus(res) {
    if (res.ok) {
      const personId = res.payload.person_id
      return { ok: true, loggedIn: true, ...(Number.isInteger(personId) ? { personId } : {}) }
    }
    if (res.code === 'auth') return { ok: true, loggedIn: false }
    return { ok: false, loggedIn: false, code: res.code, error: res.error }
  }

  /** `{ ok, loggedIn, personId?, code?, error?, school }` — safe to pass to the renderer. */
  async function status() {
    const res = !enabled ? DISABLED : loggedOut && !cached ? NOT_LOGGED_IN : await getToken()
    return { ...toStatus(res), school: SCHOOL_INFO }
  }

  /**
   * Open the login window (or focus it if it is already open). Resolves with
   * `status()` once the login is detected — the window then closes itself — or
   * once the user closes the window.
   */
  async function openLogin({ parent } = {}) {
    if (login) {
      if (!login.win.isDestroyed()) login.win.focus()
      return login.promise
    }
    if (!enabled) return status()
    // User-initiated → ask the server even if we believe we're logged out
    const current = toStatus(await getToken({ force: loggedOut }))
    if (current.loggedIn) return { ...current, school: SCHOOL_INFO }

    const { BrowserWindow } = electron()
    const prefs = { partition: PARTITION, sandbox: true, contextIsolation: true, nodeIntegration: false }
    partition() // lock permissions before the first page loads
    const win = new BrowserWindow({
      width: 1000,
      height: 780,
      parent: parent && !parent.isDestroyed() ? parent : undefined,
      title: 'WebUntis — Anmeldung',
      autoHideMenuBar: true,
      webPreferences: prefs,
    })
    win.on('page-title-updated', (e) => e.preventDefault())
    // Only https pages; SSO pop-ups stay in the same isolated partition
    win.webContents.on('will-navigate', (e, url) => {
      if (!url.startsWith('https://')) e.preventDefault()
    })
    win.webContents.setWindowOpenHandler(({ url }) =>
      url.startsWith('https://')
        ? { action: 'allow', overrideBrowserWindowOptions: { autoHideMenuBar: true, webPreferences: prefs } }
        : { action: 'deny' }
    )

    const promise = new Promise((resolve) => {
      let done = false
      const finish = (res) => {
        if (done) return
        done = true
        clearInterval(poll)
        login = null
        if (!win.isDestroyed()) win.close()
        resolve({ ...toStatus(res), school: SCHOOL_INFO })
      }
      const poll = setInterval(async () => {
        const res = await getToken({ force: true })
        if (res.ok || res.code === 'disabled') finish(res)
      }, LOGIN_POLL_MS)
      // Closed by the user: one last check (the login may have just finished).
      // Closed by logout()/switching off: no request — the session is gone anyway
      const gen = generation
      win.on('closed', async () => {
        if (!done) finish(gen === generation ? await getToken({ force: true }) : NOT_LOGGED_IN)
      })
    })
    login = { win, promise }
    win.loadURL(LOGIN_URL)
    return promise
  }

  /** Forget the token and wipe the partition (cookies, storage) → logged out. */
  async function logout() {
    generation++
    cached = null
    pending = null
    loggedOut = true
    try {
      await partition().clearStorageData()
      if (login && !login.win.isDestroyed()) login.win.close()
      return { ok: true }
    } catch (error) {
      return { ok: false, error: `Abmelden fehlgeschlagen: ${error.message || error}` }
    }
  }

  /** Follow the on/off switch from daten.json; switching off also logs out. */
  async function setEnabled(on) {
    enabled = on === true
    return enabled ? { ok: true } : logout()
  }

  return { getToken, status, openLogin, logout, setEnabled }
}

module.exports = { createWebUntisSession, PARTITION, BASE, TOKEN_URL, LOGIN_URL, SCHOOL_INFO }
