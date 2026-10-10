// WebUntis session: token caching/renewal, login detection, logout — without Electron.
import { Buffer } from 'node:buffer'
import { describe, it, expect, vi } from 'vitest'
import { createWebUntisSession, TOKEN_URL, SCHOOL_INFO } from './webuntis-session.js'

const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url')
const jwt = (payload) => `${b64({ alg: 'HS256' })}.${b64(payload)}.c2ln`

const NOW = 1_800_000_000_000 // ms
const token = (secondsLeft, extra = {}) => jwt({ person_id: 4711, exp: NOW / 1000 + secondsLeft, ...extra })

// Default content type as the real server sends it for token/new: the bare JWT
// labelled application/json (not valid JSON)
function response(status, body = '', contentType = 'application/json;charset=UTF-8') {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name) => (name.toLowerCase() === 'content-type' ? contentType : null) },
    text: async () => body,
  }
}

// Electron's session.fetch rejects the 302 → index.do of a missing session
const redirectRejected = () => Promise.reject(new TypeError('Redirect was cancelled'))

function setup(fetchImpl, { now = () => NOW, enabled = true } = {}) {
  const ses = { setPermissionRequestHandler: vi.fn(), clearStorageData: vi.fn(async () => {}) }
  const electron = () => ({ session: { fromPartition: () => ses } })
  const wu = createWebUntisSession({ fetchImpl, now, electron })
  if (enabled) wu.setEnabled(true)
  return { wu, ses }
}

const LOGGED_OUT = { ok: true, loggedIn: false, school: SCHOOL_INFO }

describe('getToken', () => {
  it('fetches the token from token/new and caches it', async () => {
    const fetchImpl = vi.fn(async () => response(200, token(900)))
    const { wu } = setup(fetchImpl)
    const first = await wu.getToken()
    expect(first.ok).toBe(true)
    expect(first.payload.person_id).toBe(4711)
    expect(fetchImpl).toHaveBeenCalledWith(TOKEN_URL, expect.objectContaining({ redirect: 'manual' }))
    await wu.getToken()
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('renews the token shortly before it expires', async () => {
    let now = NOW
    const fetchImpl = vi.fn(async () => response(200, token(900)))
    const { wu } = setup(fetchImpl, { now: () => now })
    await wu.getToken()
    now = NOW + 850 * 1000 // 50 s left → inside the renewal margin
    await wu.getToken()
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('shares one request between concurrent callers', async () => {
    const fetchImpl = vi.fn(async () => response(200, token(900)))
    const { wu } = setup(fetchImpl)
    const [a, b] = await Promise.all([wu.getToken(), wu.getToken()])
    expect(a.token).toBe(b.token)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('treats a page instead of a JWT as "not logged in"', async () => {
    const { wu } = setup(async () => response(200, '<html>login</html>', 'text/html'))
    expect(await wu.getToken()).toMatchObject({ ok: false, code: 'auth' })
  })

  it('drops the cached token once the session is gone', async () => {
    const fetchImpl = vi.fn(async () => response(200, token(900)))
    const { wu } = setup(fetchImpl)
    await wu.getToken()
    fetchImpl.mockImplementation(redirectRejected)
    expect((await wu.getToken({ force: true })).ok).toBe(false)
    expect(await wu.status()).toEqual(LOGGED_OUT)
  })
})

describe('enabled switch', () => {
  it('is off by default: no request, not even for a forced token', async () => {
    const fetchImpl = vi.fn(async () => response(200, token(900)))
    const { wu } = setup(fetchImpl, { enabled: false })
    expect(await wu.getToken({ force: true })).toMatchObject({ ok: false, code: 'disabled' })
    expect(await wu.status()).toMatchObject({ ok: false, loggedIn: false, code: 'disabled', school: SCHOOL_INFO })
    expect(await wu.openLogin()).toMatchObject({ loggedIn: false, code: 'disabled' })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('switching off logs out and blocks further requests', async () => {
    const fetchImpl = vi.fn(async () => response(200, token(900)))
    const { wu, ses } = setup(fetchImpl)
    await wu.getToken()
    expect(await wu.setEnabled(false)).toEqual({ ok: true })
    expect(ses.clearStorageData).toHaveBeenCalled()
    expect((await wu.getToken({ force: true })).code).toBe('disabled')
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('switching off while the login window is open sends no further request', async () => {
    const fetchImpl = vi.fn(redirectRejected)
    const handlers = {}
    let destroyed = false
    const win = {
      on: (event, fn) => (handlers[event] = fn),
      isDestroyed: () => destroyed,
      focus: () => {},
      loadURL: () => {},
      close: () => {
        destroyed = true
        handlers.closed?.()
      },
      webContents: { on: () => {}, setWindowOpenHandler: () => {} },
    }
    const ses = { setPermissionRequestHandler: vi.fn(), clearStorageData: vi.fn(async () => {}) }
    const electron = () => ({ session: { fromPartition: () => ses }, BrowserWindow: function () { return win } })
    const wu = createWebUntisSession({ fetchImpl, now: () => NOW, electron })
    await wu.setEnabled(true)
    const pending = wu.openLogin()
    await vi.waitFor(() => expect(handlers.closed).toBeDefined())
    const callsBefore = fetchImpl.mock.calls.length
    await wu.setEnabled(false)
    expect(await pending).toMatchObject({ loggedIn: false })
    expect(destroyed).toBe(true)
    expect(fetchImpl).toHaveBeenCalledTimes(callsBefore)
  })

  it('passes a failing logout on when switching off', async () => {
    const { wu, ses } = setup(async () => response(200, token(900)))
    ses.clearStorageData.mockRejectedValue(new Error('busy'))
    expect(await wu.setEnabled(false)).toMatchObject({ ok: false })
  })
})

describe('status', () => {
  it('reports logged in with the person id — never the token', async () => {
    const { wu } = setup(async () => response(200, token(900)))
    await wu.getToken() // as after a login
    expect(await wu.status()).toEqual({ ok: true, loggedIn: true, personId: 4711, school: SCHOOL_INFO })
  })

  it('omits a person id that is not an integer', async () => {
    const { wu } = setup(async () => response(200, token(900, { person_id: 'x' })))
    await wu.getToken()
    expect(await wu.status()).toEqual({ ok: true, loggedIn: true, school: SCHOOL_INFO })
  })

  it('answers "not logged in" after app start without a request', async () => {
    const fetchImpl = vi.fn(redirectRejected)
    const { wu } = setup(fetchImpl)
    expect(await wu.status()).toEqual(LOGGED_OUT)
    expect(await wu.status()).toEqual(LOGGED_OUT)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('reports "not logged in" once the session is gone (redirect)', async () => {
    let now = NOW
    const fetchImpl = vi.fn(async () => response(200, token(900)))
    const { wu } = setup(fetchImpl, { now: () => now })
    await wu.getToken()
    fetchImpl.mockImplementation(redirectRejected)
    now = NOW + 850 * 1000 // token about to expire → renewal fails
    expect(await wu.status()).toEqual(LOGGED_OUT)
    expect(await wu.status()).toEqual(LOGGED_OUT)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('passes network errors on as a failure with a German text', async () => {
    let now = NOW
    const fetchImpl = vi.fn(async () => response(200, token(900)))
    const { wu } = setup(fetchImpl, { now: () => now })
    await wu.getToken()
    fetchImpl.mockImplementation(() => Promise.reject(Object.assign(new Error('x'), { code: 'ENOTFOUND' })))
    now = NOW + 850 * 1000
    const res = await wu.status()
    expect(res).toMatchObject({ ok: false, loggedIn: false, code: 'offline' })
    expect(res.error).toMatch(/Verbindung/)
  })
})

describe('logout', () => {
  it('wipes the partition and forgets the token', async () => {
    const fetchImpl = vi.fn(async () => response(200, token(900)))
    const { wu, ses } = setup(fetchImpl)
    await wu.getToken()
    fetchImpl.mockImplementation(redirectRejected)
    expect(await wu.logout()).toEqual({ ok: true })
    expect(ses.clearStorageData).toHaveBeenCalled()
    expect(await wu.status()).toEqual(LOGGED_OUT)
  })

  it('discards a token request that was still running', async () => {
    let release
    const fetchImpl = vi.fn(() => new Promise((r) => (release = () => r(response(200, token(900))))))
    const { wu } = setup(fetchImpl)
    const late = wu.getToken()
    await wu.logout()
    release()
    expect((await late).ok).toBe(false)
    fetchImpl.mockImplementation(redirectRejected)
    expect((await wu.status()).loggedIn).toBe(false)
  })

  it('reports a failing wipe', async () => {
    const { wu, ses } = setup(async () => response(200, token(900)))
    ses.clearStorageData.mockRejectedValue(new Error('busy'))
    expect(await wu.logout()).toMatchObject({ ok: false })
  })
})
