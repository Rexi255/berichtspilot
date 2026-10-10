// Network layer (E-007): every request the app makes goes through `request()`.
// Only https to hosts on the allowlist, a hard timeout, no redirects followed
// (a redirect could lead off the allowlist), and results instead of exceptions
// so IPC handlers can pass them straight on. Error texts are German (UI).

// Keep in sync with the allowlist table in docs/ARCHITECTURE.md
const ALLOWED_HOSTS = ['bbz-dithmarschen.webuntis.com']
const DEFAULT_TIMEOUT_MS = 15000

/** true if `url` is an https URL to an allowlisted host (no credentials, default port). */
function isAllowedUrl(url, hosts = ALLOWED_HOSTS) {
  let parsed
  try {
    parsed = new URL(url)
  } catch {
    return false
  }
  return (
    parsed.protocol === 'https:' &&
    !parsed.username &&
    !parsed.password &&
    parsed.port === '' &&
    hosts.includes(parsed.hostname.toLowerCase())
  )
}

function hostOf(url) {
  try {
    return new URL(url).hostname
  } catch {
    return String(url).slice(0, 60)
  }
}

// Chromium (net::ERR_*) and Node (E*) codes that mean "no connection at all"
const OFFLINE =
  /ERR_INTERNET_DISCONNECTED|ERR_NAME_NOT_RESOLVED|ERR_NAME_RESOLUTION_FAILED|ERR_ADDRESS_UNREACHABLE|ERR_CONNECTION_(REFUSED|RESET|CLOSED|FAILED)|ERR_NETWORK_CHANGED|ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ECONNRESET|ENETUNREACH|EHOSTUNREACH/

/** Map a failed request (HTTP status or thrown error) to `{ code, error }` with a German text. */
function describeFailure({ status, error, url } = {}) {
  if (error) {
    const text = `${error.name || ''} ${error.code || ''} ${error.message || ''} ${error.cause?.code || ''}`
    if (error.name === 'AbortError' || error.name === 'TimeoutError' || /ERR_TIMED_OUT|ETIMEDOUT/.test(text)) {
      return { code: 'timeout', error: 'Der Server antwortet nicht (Zeitüberschreitung). Bitte später erneut versuchen.' }
    }
    // Electron's fetch rejects a redirect under redirect: 'manual' instead of returning the 3xx;
    // WebUntis redirects to its login page (index.do) when the session is missing or expired
    if (/Redirect was cancelled/i.test(text)) {
      return { code: 'auth', error: 'Bitte erneut anmelden.' }
    }
    if (OFFLINE.test(text)) {
      return { code: 'offline', error: 'Keine Verbindung zum Server. Bist du online?' }
    }
    if (/CERT|SSL/.test(text)) {
      return { code: 'tls', error: 'Die sichere Verbindung zum Server konnte nicht geprüft werden.' }
    }
    return { code: 'network', error: 'Netzwerkfehler. Bitte später erneut versuchen.' }
  }
  // Status 0 = opaque redirect (plain fetch with redirect: 'manual')
  if (status === 0 || (status >= 300 && status < 400) || status === 401 || status === 403) {
    return { code: 'auth', error: 'Bitte erneut anmelden.' }
  }
  if (status === 404) return { code: 'not-found', error: `Adresse auf ${hostOf(url)} nicht gefunden (HTTP 404).` }
  if (status === 429) return { code: 'rate-limit', error: 'Zu viele Anfragen. Bitte kurz warten und erneut versuchen.' }
  if (status >= 500) {
    return { code: 'server', error: `Der Server meldet einen Fehler (HTTP ${status}). Bitte später erneut versuchen.` }
  }
  return { code: 'http', error: `Anfrage abgelehnt (HTTP ${status}).` }
}

/**
 * Perform one request. Never throws; resolves to
 * `{ ok: true, status, data }` (data = parsed JSON, or text for non-JSON) or
 * `{ ok: false, code, error, status? }`.
 *
 * `ses`: Electron session whose `fetch` (with its cookies) is used — e.g. the
 * `persist:webuntis` partition. `fetchImpl` overrides it (tests).
 * `expect: 'json'`: a non-JSON answer is a failure (HTML = login page → 'auth').
 */
async function request(
  url,
  { ses, fetchImpl, method = 'GET', headers, body, expect, timeoutMs = DEFAULT_TIMEOUT_MS, hosts } = {}
) {
  if (!isAllowedUrl(url, hosts)) {
    return { ok: false, code: 'blocked', error: `Verbindung zu ${hostOf(url)} ist nicht erlaubt.` }
  }
  const doFetch = fetchImpl || (ses ? ses.fetch.bind(ses) : fetch)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await doFetch(url, {
      method,
      headers,
      body,
      credentials: 'include',
      redirect: 'manual',
      signal: controller.signal,
    })
    if (!res.ok) return { ok: false, status: res.status, ...describeFailure({ status: res.status, url }) }
    const text = await res.text()
    const contentType = res.headers?.get?.('content-type') || ''
    const isJson = /json/i.test(contentType)
    if (!isJson && expect === 'json') {
      // An API call answered with a web page: WebUntis serves its login page then
      if (/html/i.test(contentType)) return { ok: false, status: res.status, code: 'auth', error: 'Bitte erneut anmelden.' }
      return { ok: false, status: res.status, code: 'parse', error: 'Unerwartete Antwort vom Server (kein JSON).' }
    }
    if (!isJson) return { ok: true, status: res.status, data: text }
    try {
      return { ok: true, status: res.status, data: text ? JSON.parse(text) : null }
    } catch {
      return { ok: false, status: res.status, code: 'parse', error: 'Unerwartete Antwort vom Server (kein gültiges JSON).' }
    }
  } catch (error) {
    return { ok: false, ...describeFailure({ error, url }) }
  } finally {
    clearTimeout(timer)
  }
}

module.exports = { ALLOWED_HOSTS, DEFAULT_TIMEOUT_MS, isAllowedUrl, describeFailure, request }
