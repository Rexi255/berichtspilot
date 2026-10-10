// WebUntis probe — developer spike for DECISIONS E-013 (path W1, embedded SSO
// login). Started with `electron . --webuntis-probe`; never reachable from the
// renderer, no IPC.
//
// Flow: the user logs in via the school portal in a sandboxed window (own
// session partition, no preload), opens the timetable and one lesson with
// notes, then closes the window. Meanwhile the probe records the web UI's own
// API calls (Chrome DevTools protocol) and afterwards tries a few candidate
// endpoints with the same session. Written to webuntis-probe.json is ONLY the
// anonymised structure (see shape.js): status codes, keys, value types — no
// names, notes, ids, tokens or cookie values.
const { BrowserWindow, session, dialog, shell, app } = require('electron')
const fsp = require('fs').promises
const { createShape, addSample, shapeToJSON, shapeOf, anonymizeUrl } = require('./shape')

// The WebUntis address from daten.json (E-019), set by runWebUntisProbe()
let HOST = ''
let SCHOOL = ''
let BASE = ''
let START_URL = ''
const PARTITION = 'persist:webuntis'
const PROBE_VERSION = 1
const MAX_CAPTURES = 400
const POLL_MS = 4000

const WINDOW_PREFS = { partition: PARTITION, sandbox: true, contextIsolation: true, nodeIntegration: false }

// Local calendar dates (no ISO parsing involved, CLAUDE.md rule 7)
function pad(n) {
  return String(n).padStart(2, '0')
}
function isoDate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
function untisDate(d) {
  return Number(isoDate(d).replace(/-/g, ''))
}

/** Probe range: Monday three weeks ago up to Friday of the current week (covers school breaks). */
function probeRange(today = new Date()) {
  const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - ((today.getDay() + 6) % 7))
  const from = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() - 21)
  const to = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 4)
  return { from, to }
}

// Error texts may contain URLs with ids — strip them
function cleanError(error) {
  return String(error?.message || error)
    .replace(/https?:\/\/\S+/g, '<url>')
    .slice(0, 200)
}

function decodeJwtPayload(token) {
  try {
    return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'))
  } catch {
    return null
  }
}

// First integer stored under one of `keys`, searched depth-first
function findId(value, keys, depth = 0) {
  if (!value || typeof value !== 'object' || depth > 8) return null
  for (const [k, v] of Object.entries(value)) {
    if (keys.includes(k) && Number.isInteger(v)) return v
  }
  for (const v of Object.values(value)) {
    const found = findId(v, keys, depth + 1)
    if (found != null) return found
  }
  return null
}

async function readBody(res) {
  const text = await res.text()
  try {
    return { json: JSON.parse(text), text }
  } catch {
    return { json: undefined, text }
  }
}

function describeBody(body, contentType) {
  if (body.json !== undefined) return shapeOf(body.json)
  return { nonJson: true, contentType: contentType || null, length: body.text.length }
}

/** `server`: `{ host, school }` already checked by cleanServer() (main.js). */
async function runWebUntisProbe({ outFile, server }) {
  HOST = server.host
  SCHOOL = server.school
  BASE = `https://${HOST}`
  START_URL = `${BASE}/WebUntis/${SCHOOL ? `?school=${encodeURIComponent(SCHOOL)}` : ''}`
  const intro = await dialog.showMessageBox({
    type: 'info',
    title: 'WebUntis-Probe',
    message: 'WebUntis-Probe (Entwickler-Test)',
    detail:
      'Gleich öffnet sich WebUntis in einem eigenen Fenster.\n\n' +
      '1. Über das Schulportal anmelden.\n' +
      '2. Den Stundenplan öffnen — eine Woche mit Unterricht (ggf. vor den Ferien).\n' +
      '3. Eine Stunde anklicken, in der Notizen stehen; gern noch eine zweite.\n' +
      '4. Das Fenster schließen.\n\n' +
      'Gespeichert wird nur die Struktur der Antworten (Feldnamen, Datentypen, ' +
      'Statuscodes) in webuntis-probe.json — keine Namen, Notizen, IDs oder ' +
      'Passwörter. Bitte die Datei vor dem Verschicken kurz ansehen.',
    buttons: ['Los geht’s', 'Abbrechen'],
    cancelId: 1,
    noLink: true,
  })
  if (intro.response !== 0) return app.quit()

  const ses = session.fromPartition(PARTITION)
  const startedAt = Date.now()
  const result = {
    probeVersion: PROBE_VERSION,
    createdAt: isoDate(new Date()),
    electron: process.versions.electron,
    platform: process.platform,
    loggedIn: false,
    secondsUntilLogin: null,
    navigatedHosts: [],
    session: null,
    candidates: [],
    captured: [],
    errors: [],
  }
  const hosts = new Set()
  const captures = new Map() // "METHOD url [rpc]" -> accumulated group

  const win = new BrowserWindow({
    width: 1200,
    height: 860,
    title: 'WebUntis-Probe — bitte anmelden',
    autoHideMenuBar: true,
    webPreferences: WINDOW_PREFS,
  })
  const setTitle = (title) => !win.isDestroyed() && win.setTitle(`WebUntis-Probe — ${title}`)
  win.on('page-title-updated', (e) => e.preventDefault())

  // SSO pop-ups stay inside the same isolated session; everything else is blocked
  win.webContents.setWindowOpenHandler(({ url }) =>
    url.startsWith('https://')
      ? { action: 'allow', overrideBrowserWindowOptions: { autoHideMenuBar: true, webPreferences: WINDOW_PREFS } }
      : { action: 'deny' }
  )
  win.webContents.on('did-navigate', (_e, url) => {
    try {
      hosts.add(new URL(url).host) // only the host — tells us where the SSO lives
    } catch {
      /* ignore */
    }
  })

  // --- Record the web UI's own API calls (only on the WebUntis host) ---------
  const requests = new Map() // CDP requestId -> { method, url, postData, type, status, mimeType }
  const dbg = win.webContents.debugger
  // Don't await Network.enable here: on a window without a page the command only
  // answers once a renderer exists, i.e. after loadURL — awaiting it first left
  // the window blank forever. The first requests (login page) don't matter.
  try {
    dbg.attach('1.3')
    dbg.sendCommand('Network.enable').catch((error) => result.errors.push(`debugger: ${cleanError(error)}`))
  } catch (error) {
    result.errors.push(`debugger: ${cleanError(error)}`)
  }

  function groupFor(req) {
    let rpc = ''
    let requestJson
    if (req.postData) {
      try {
        requestJson = JSON.parse(req.postData)
        if (typeof requestJson?.method === 'string' && /^[A-Za-z0-9_.]{1,60}$/.test(requestJson.method)) {
          rpc = ` [${requestJson.method}]`
        }
      } catch {
        /* form data or similar */
      }
    }
    const key = `${req.method} ${anonymizeUrl(req.url)}${rpc}`
    if (!captures.has(key)) {
      if (captures.size >= MAX_CAPTURES) return null
      captures.set(key, {
        key,
        count: 0,
        statuses: {},
        mimeTypes: new Set(),
        request: createShape(),
        response: createShape(),
        nonJson: 0,
      })
    }
    const group = captures.get(key)
    if (requestJson !== undefined) addSample(group.request, requestJson)
    return group
  }

  dbg.on('message', async (_e, method, params) => {
    if (method === 'Network.requestWillBeSent') {
      let host
      try {
        host = new URL(params.request.url).host
      } catch {
        return
      }
      if (host !== HOST) return
      requests.set(params.requestId, {
        method: params.request.method,
        url: params.request.url,
        postData: params.request.postData,
        type: params.type,
      })
    } else if (method === 'Network.responseReceived') {
      const req = requests.get(params.requestId)
      if (req) Object.assign(req, { status: params.response.status, mimeType: params.response.mimeType })
    } else if (method === 'Network.loadingFinished' || method === 'Network.loadingFailed') {
      const req = requests.get(params.requestId)
      requests.delete(params.requestId)
      if (!req || !['XHR', 'Fetch'].includes(req.type)) return
      const group = groupFor(req)
      if (!group) return
      group.count++
      const status = method === 'Network.loadingFailed' ? 'failed' : String(req.status)
      group.statuses[status] = (group.statuses[status] || 0) + 1
      if (req.mimeType) group.mimeTypes.add(req.mimeType)
      if (method === 'Network.loadingFailed') return
      try {
        const { body, base64Encoded } = await dbg.sendCommand('Network.getResponseBody', {
          requestId: params.requestId,
        })
        const text = base64Encoded ? Buffer.from(body, 'base64').toString('utf8') : body
        addSample(group.response, JSON.parse(text))
      } catch {
        group.nonJson++ // HTML, binary, empty or no longer available
      }
    }
  })

  // --- Detect the login by polling the token endpoint ------------------------
  async function fetchToken() {
    try {
      const res = await ses.fetch(`${BASE}/WebUntis/api/token/new`, { credentials: 'include' })
      const text = (await res.text()).trim()
      return res.ok && /^[\w-]+\.[\w-]+\.[\w-]+$/.test(text) ? text : null
    } catch {
      return null
    }
  }
  const poll = setInterval(async () => {
    if (result.loggedIn) return
    const t = await fetchToken()
    if (t && !result.loggedIn) {
      result.loggedIn = true
      result.secondsUntilLogin = Math.round((Date.now() - startedAt) / 1000)
      setTitle('angemeldet ✓ · Stundenplan öffnen, Stunde mit Notizen anklicken, dann Fenster schließen')
    }
  }, POLL_MS)

  // --- Closing the window finishes the probe ---------------------------------
  let finishing = false
  win.on('close', (e) => {
    if (finishing) return
    e.preventDefault()
    finishing = true
    clearInterval(poll)
    setTitle('wird ausgewertet …')
    finish().catch((error) => console.error('webuntis-probe:', error))
  })

  async function finish() {
    try {
      const token = await fetchToken()
      if (token) result.loggedIn = true
      result.session = await describeSession(ses, token)
      result.candidates = await probeCandidates(ses, token)
    } catch (error) {
      result.errors.push(`finish: ${cleanError(error)}`)
    }
    try {
      if (dbg.isAttached()) dbg.detach()
    } catch {
      /* already gone */
    }
    result.navigatedHosts = [...hosts].sort()
    result.captured = [...captures.values()].map((g) => ({
      call: g.key,
      count: g.count,
      statuses: g.statuses,
      mimeTypes: [...g.mimeTypes],
      request: g.request.count ? shapeToJSON(g.request) : null,
      response: g.response.count ? shapeToJSON(g.response) : null,
      nonJsonResponses: g.nonJson,
    }))

    let written = true
    try {
      await fsp.writeFile(outFile, JSON.stringify(result, null, 2) + '\n', 'utf8')
    } catch (error) {
      written = false
      result.errors.push(`write: ${cleanError(error)}`)
    }
    // Hide instead of destroy: the last closed window would quit the app (main.js)
    if (!win.isDestroyed()) win.hide()
    await dialog.showMessageBox({
      type: written ? 'info' : 'error',
      title: 'WebUntis-Probe',
      message: written ? 'Fertig — webuntis-probe.json wurde gespeichert.' : 'Die Datei konnte nicht gespeichert werden.',
      detail: written
        ? `${outFile}\n\n${result.loggedIn ? 'Anmeldung erkannt.' : 'Keine Anmeldung erkannt.'} ` +
          `${result.captured.length} API-Aufrufe aufgezeichnet.\n\n` +
          'Bitte die Datei kurz ansehen und dann schicken.'
        : result.errors.join('\n'),
      noLink: true,
    })
    if (written) shell.showItemInFolder(outFile)
    app.quit()
  }

  win.loadURL(START_URL)
}

// Cookie NAMES and lifetimes plus the token's structure — never their values
async function describeSession(ses, token) {
  const cookies = (await ses.cookies.get({ url: BASE })).map((c) => ({
    name: c.name,
    session: !!c.session,
    expiresInHours: c.expirationDate ? Math.round((c.expirationDate * 1000 - Date.now()) / 360000) / 10 : null,
    httpOnly: !!c.httpOnly,
  }))
  const payload = token ? decodeJwtPayload(token) : null
  return {
    cookies,
    token: token
      ? {
          length: token.length,
          payload: payload ? shapeOf(payload) : null,
          lifetimeSeconds: payload && payload.exp && payload.iat ? payload.exp - payload.iat : null,
        }
      : null,
  }
}

// Candidate endpoints for the timetable incl. lesson texts (E-013)
async function probeCandidates(ses, token) {
  const out = []
  const payload = token ? decodeJwtPayload(token) : null
  const cookies = await ses.cookies.get({ url: BASE })
  const tenantCookie = cookies.find((c) => c.name.toLowerCase() === 'tenant-id')
  const tenantId = payload?.tenant_id ?? (tenantCookie ? tenantCookie.value.replace(/"/g, '') : null)
  const headers = {
    Accept: 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(tenantId ? { 'Tenant-Id': String(tenantId) } : {}),
  }

  async function call(label, url, init = {}) {
    const entry = { label, method: init.method || 'GET', url: anonymizeUrl(url) }
    try {
      const res = await ses.fetch(url, { credentials: 'include', ...init, headers: { ...headers, ...init.headers } })
      entry.status = res.status
      entry.contentType = res.headers.get('content-type')
      const body = await readBody(res)
      entry.response = describeBody(body, entry.contentType)
      out.push(entry)
      return body.json
    } catch (error) {
      entry.error = cleanError(error)
      out.push(entry)
      return undefined
    }
  }

  const appData = await call('REST app data', `${BASE}/WebUntis/api/rest/view/v1/app/data`)
  const personId =
    findId(payload, ['person_id', 'personId']) ?? appData?.user?.person?.id ?? findId(appData, ['personId', 'person_id'])
  out.push({
    label: 'personId found',
    found: personId != null,
    source: personId == null ? null : payload?.person_id != null ? 'token' : 'app data',
  })

  const { from, to } = probeRange()
  const rpc = (method, params) =>
    call(`JSON-RPC ${method}`, `${BASE}/WebUntis/jsonrpc.do?school=${encodeURIComponent(SCHOOL)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'probe', method, params, jsonrpc: '2.0' }),
    })

  await rpc('getCurrentSchoolyear', {})
  await call(
    'homeworks/lessons',
    `${BASE}/WebUntis/api/homeworks/lessons?startDate=${untisDate(from)}&endDate=${untisDate(to)}`
  )

  if (personId == null) {
    out.push({ label: 'timetable candidates', skipped: 'keine personId gefunden' })
    return out
  }
  await call(
    'REST timetable entries',
    `${BASE}/WebUntis/api/rest/view/v1/timetable/entries?start=${isoDate(from)}&end=${isoDate(to)}` +
      `&format=4&resourceType=STUDENT&resources=${personId}&periodTypes=&timetableType=MY_TIMETABLE`
  )
  await call(
    'public weekly data',
    `${BASE}/WebUntis/api/public/timetable/weekly/data?elementType=5&elementId=${personId}&date=${isoDate(to)}&formatId=1`
  )
  await rpc('getTimetable', {
    options: {
      element: { id: personId, type: 5 },
      startDate: untisDate(from),
      endDate: untisDate(to),
      showInfo: true,
      showSubstText: true,
      showLsText: true,
      showLsNumber: true,
      showStudentgroup: true,
      subjectFields: ['id', 'name', 'longname'],
      klasseFields: ['id'],
      teacherFields: ['id'],
      roomFields: ['id'],
    },
  })
  await call(
    'REST calendar-entry detail v2',
    `${BASE}/WebUntis/api/rest/view/v2/calendar-entry/detail?elementId=${personId}&elementType=5` +
      `&startDateTime=${isoDate(from)}T00:00:00&endDateTime=${isoDate(to)}T23:59:59&homeworkOption=DUE`
  )
  return out
}

module.exports = { runWebUntisProbe }
