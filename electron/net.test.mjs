// Network layer: allowlist must hold, failures must become readable results.
import { describe, it, expect, vi } from 'vitest'
import { isAllowedUrl, isWebuntisHost, describeFailure, request, ALLOWED_HOSTS, UPDATE_HOSTS } from './net.js'

// The user's own WebUntis host (E-019) — a made-up school, passed per request
const HOST = 'beispiel-bbs.webuntis.com'
const HOSTS = [HOST]
const BASE = `https://${HOST}/WebUntis`

function response(status, body = '', contentType = 'application/json') {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name) => (name.toLowerCase() === 'content-type' ? contentType : null) },
    text: async () => body,
  }
}

describe('isAllowedUrl', () => {
  it('allows https to the school host', () => {
    expect(isAllowedUrl(`${BASE}/api/token/new`, HOSTS)).toBe(true)
    expect(isAllowedUrl('https://Beispiel-BBS.WebUntis.com/', HOSTS)).toBe(true)
  })

  it('rejects other hosts, look-alikes and plain http', () => {
    expect(isAllowedUrl('https://example.com/', HOSTS)).toBe(false)
    expect(isAllowedUrl('https://beispiel-bbs.webuntis.com.evil.io/', HOSTS)).toBe(false)
    expect(isAllowedUrl('https://evil.io/?x=beispiel-bbs.webuntis.com', HOSTS)).toBe(false)
    expect(isAllowedUrl('https://webuntis.com/', HOSTS)).toBe(false)
    expect(isAllowedUrl('http://beispiel-bbs.webuntis.com/', HOSTS)).toBe(false)
  })

  it('rejects credentials, odd ports and garbage', () => {
    expect(isAllowedUrl('https://user:pw@beispiel-bbs.webuntis.com/', HOSTS)).toBe(false)
    expect(isAllowedUrl('https://beispiel-bbs.webuntis.com:8443/', HOSTS)).toBe(false)
    expect(isAllowedUrl('not a url', HOSTS)).toBe(false)
    expect(isAllowedUrl(undefined, HOSTS)).toBe(false)
  })

  it('honours a custom host list; without one nothing is allowed', () => {
    expect(isAllowedUrl('https://example.com/', ['example.com'])).toBe(true)
    expect(ALLOWED_HOSTS).toEqual([])
    expect(isAllowedUrl(`${BASE}/api/token/new`)).toBe(false)
  })

  it('isWebuntisHost accepts only <name>.webuntis.com', () => {
    expect(isWebuntisHost('beispiel-bbs.webuntis.com')).toBe(true)
    expect(isWebuntisHost('nessa.webuntis.com')).toBe(true)
    for (const bad of ['webuntis.com', 'a.b.webuntis.com', 'x.webuntis.com.evil.io', 'a-webuntis-com', 'xwebuntisxcom',
      '-x.webuntis.com', 'X.WEBUNTIS.COM', '', undefined, 42]) {
      expect(isWebuntisHost(bad), String(bad)).toBe(false)
    }
  })

  it('keeps the update hosts separate from the app hosts', () => {
    const feed = 'https://github.com/Rexi255/berichtspilot/releases.atom'
    const asset = 'https://release-assets.githubusercontent.com/github-production-release-asset/1/2?sp=r'
    expect(isAllowedUrl(feed, UPDATE_HOSTS)).toBe(true)
    expect(isAllowedUrl(asset, UPDATE_HOSTS)).toBe(true)
    expect(isAllowedUrl(feed, HOSTS)).toBe(false)
    expect(isAllowedUrl('https://api.github.com/repos/x', UPDATE_HOSTS)).toBe(false)
    expect(isAllowedUrl('https://objects.githubusercontent.com/x', UPDATE_HOSTS)).toBe(false)
    expect(isAllowedUrl('http://github.com/Rexi255/berichtspilot/releases.atom', UPDATE_HOSTS)).toBe(false)
  })
})

describe('describeFailure', () => {
  it('asks to log in again for 401/403 and redirects', () => {
    for (const status of [401, 403, 302, 0]) {
      expect(describeFailure({ status })).toEqual({ code: 'auth', error: 'Bitte erneut anmelden.' })
    }
  })

  it('treats a cancelled redirect (Electron, redirect: manual) as an expired login', () => {
    expect(describeFailure({ error: new Error('Redirect was cancelled') }).code).toBe('auth')
  })

  it('maps other HTTP statuses', () => {
    expect(describeFailure({ status: 404, url: `${BASE}/x` }).error).toContain('beispiel-bbs.webuntis.com')
    expect(describeFailure({ status: 429 }).code).toBe('rate-limit')
    expect(describeFailure({ status: 503 })).toMatchObject({ code: 'server', error: expect.stringContaining('503') })
    expect(describeFailure({ status: 400 }).code).toBe('http')
  })

  it('recognises timeouts and missing connectivity', () => {
    expect(describeFailure({ error: Object.assign(new Error('aborted'), { name: 'AbortError' }) }).code).toBe('timeout')
    expect(describeFailure({ error: new Error('net::ERR_INTERNET_DISCONNECTED') }).code).toBe('offline')
    expect(describeFailure({ error: new Error('net::ERR_NAME_NOT_RESOLVED') }).code).toBe('offline')
    expect(describeFailure({ error: new TypeError('fetch failed', { cause: { code: 'ENOTFOUND' } }) }).code).toBe('offline')
    expect(describeFailure({ error: new Error('net::ERR_CERT_DATE_INVALID') }).code).toBe('tls')
    expect(describeFailure({ error: new Error('something else') }).code).toBe('network')
  })
})

describe('request', () => {
  it('never calls fetch for a blocked host', async () => {
    const fetchImpl = vi.fn()
    const res = await request('https://example.com/steal', { fetchImpl })
    expect(res).toEqual({ ok: false, code: 'blocked', error: 'Verbindung zu example.com ist nicht erlaubt.' })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('parses JSON and sends cookies without following redirects', async () => {
    const fetchImpl = vi.fn(async () => response(200, '{"a":1}', 'application/json;charset=UTF-8'))
    const res = await request(`${BASE}/api/x`, { hosts: HOSTS, fetchImpl, method: 'POST', body: '{}' })
    expect(res).toEqual({ ok: true, status: 200, data: { a: 1 } })
    expect(fetchImpl.mock.calls[0][1]).toMatchObject({ method: 'POST', credentials: 'include', redirect: 'manual' })
  })

  it('returns text for non-JSON responses', async () => {
    const res = await request(`${BASE}/api/token/new`, { hosts: HOSTS, fetchImpl: async () => response(200, 'a.b.c', 'text/plain') })
    expect(res).toEqual({ ok: true, status: 200, data: 'a.b.c' })
  })

  it('treats a web page as expired login when JSON is expected', async () => {
    const fetchImpl = async () => response(200, '<html>', 'text/html;charset=UTF-8')
    expect(await request(`${BASE}/api/x`, { hosts: HOSTS, fetchImpl, expect: 'json' })).toMatchObject({ ok: false, code: 'auth' })
    expect(await request(`${BASE}/api/x`, { hosts: HOSTS, fetchImpl })).toMatchObject({ ok: true, data: '<html>' })
    const plain = async () => response(200, 'a.b.c', 'text/plain')
    expect(await request(`${BASE}/api/x`, { hosts: HOSTS, fetchImpl: plain, expect: 'json' })).toMatchObject({ ok: false, code: 'parse' })
  })

  it('reports broken JSON instead of throwing', async () => {
    const res = await request(`${BASE}/api/x`, { hosts: HOSTS, fetchImpl: async () => response(200, '<html>') })
    expect(res).toMatchObject({ ok: false, code: 'parse' })
  })

  it("returns raw text with expect: 'text', even when labelled JSON", async () => {
    // WebUntis token/new: bare JWT with content type application/json
    const res = await request(`${BASE}/api/token/new`, {
      hosts: HOSTS,
      expect: 'text',
      fetchImpl: async () => response(200, 'aaa.bbb.ccc'),
    })
    expect(res).toEqual({ ok: true, status: 200, data: 'aaa.bbb.ccc' })
  })

  it('maps HTTP errors', async () => {
    const res = await request(`${BASE}/api/x`, { hosts: HOSTS, fetchImpl: async () => response(401) })
    expect(res).toEqual({ ok: false, status: 401, code: 'auth', error: 'Bitte erneut anmelden.' })
  })

  it('maps thrown network errors', async () => {
    const fetchImpl = async () => {
      throw new Error('net::ERR_INTERNET_DISCONNECTED')
    }
    expect(await request(`${BASE}/api/x`, { hosts: HOSTS, fetchImpl })).toMatchObject({ ok: false, code: 'offline' })
  })

  it('aborts after the timeout', async () => {
    const fetchImpl = (_url, { signal }) =>
      new Promise((_resolve, reject) =>
        signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })))
      )
    expect(await request(`${BASE}/api/x`, { hosts: HOSTS, fetchImpl, timeoutMs: 20 })).toMatchObject({ ok: false, code: 'timeout' })
  })

  it('uses the session fetch when given a session', async () => {
    const ses = { fetch: vi.fn(async () => response(200, '[]')) }
    expect(await request(`${BASE}/api/x`, { hosts: HOSTS, ses })).toEqual({ ok: true, status: 200, data: [] })
    expect(ses.fetch).toHaveBeenCalledOnce()
  })
})
