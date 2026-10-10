// WebUntis session: token caching/renewal, login detection, logout — without Electron.
import { Buffer } from 'node:buffer'
import { describe, it, expect, vi } from 'vitest'
import { createWebUntisSession, TOKEN_URL } from './webuntis-session.js'

const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url')
const jwt = (payload) => `${b64({ alg: 'HS256' })}.${b64(payload)}.c2ln`

const NOW = 1_800_000_000_000 // ms
const token = (secondsLeft, extra = {}) => jwt({ person_id: 4711, exp: NOW / 1000 + secondsLeft, ...extra })

function response(status, body = '', contentType = 'text/plain;charset=UTF-8') {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name) => (name.toLowerCase() === 'content-type' ? contentType : null) },
    text: async () => body,
  }
}

// Electron's session.fetch rejects the 302 → index.do of a missing session
const redirectRejected = () => Promise.reject(new TypeError('Redirect was cancelled'))

function setup(fetchImpl, { now = () => NOW } = {}) {
  const ses = { setPermissionRequestHandler: vi.fn(), clearStorageData: vi.fn(async () => {}) }
  const electron = () => ({ session: { fromPartition: () => ses } })
  return { wu: createWebUntisSession({ fetchImpl, now, electron }), ses }
}

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
    expect(await wu.status()).toEqual({ ok: true, loggedIn: false })
  })
})

describe('status', () => {
  it('reports logged in with the person id — never the token', async () => {
    const { wu } = setup(async () => response(200, token(900)))
    expect(await wu.status()).toEqual({ ok: true, loggedIn: true, personId: 4711 })
  })

  it('omits a person id that is not an integer', async () => {
    const { wu } = setup(async () => response(200, token(900, { person_id: 'x' })))
    expect(await wu.status()).toEqual({ ok: true, loggedIn: true })
  })

  it('reports "not logged in" for a missing session (redirect)', async () => {
    const { wu } = setup(redirectRejected)
    expect(await wu.status()).toEqual({ ok: true, loggedIn: false })
  })

  it('passes network errors on as a failure with a German text', async () => {
    const { wu } = setup(() => Promise.reject(Object.assign(new Error('x'), { code: 'ENOTFOUND' })))
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
    expect(await wu.status()).toEqual({ ok: true, loggedIn: false })
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
