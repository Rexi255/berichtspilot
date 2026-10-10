// Network layer: allowlist must hold, failures must become readable results.
import { describe, it, expect, vi } from 'vitest'
import { isAllowedUrl, describeFailure, request, ALLOWED_HOSTS } from './net.js'

const BASE = 'https://bbz-dithmarschen.webuntis.com/WebUntis'

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
    expect(isAllowedUrl(`${BASE}/api/token/new`)).toBe(true)
    expect(isAllowedUrl('https://BBZ-Dithmarschen.WebUntis.com/')).toBe(true)
  })

  it('rejects other hosts, look-alikes and plain http', () => {
    expect(isAllowedUrl('https://example.com/')).toBe(false)
    expect(isAllowedUrl('https://bbz-dithmarschen.webuntis.com.evil.io/')).toBe(false)
    expect(isAllowedUrl('https://evil.io/?x=bbz-dithmarschen.webuntis.com')).toBe(false)
    expect(isAllowedUrl('https://webuntis.com/')).toBe(false)
    expect(isAllowedUrl('http://bbz-dithmarschen.webuntis.com/')).toBe(false)
  })

  it('rejects credentials, odd ports and garbage', () => {
    expect(isAllowedUrl('https://user:pw@bbz-dithmarschen.webuntis.com/')).toBe(false)
    expect(isAllowedUrl('https://bbz-dithmarschen.webuntis.com:8443/')).toBe(false)
    expect(isAllowedUrl('not a url')).toBe(false)
    expect(isAllowedUrl(undefined)).toBe(false)
  })

  it('honours a custom host list', () => {
    expect(isAllowedUrl('https://example.com/', ['example.com'])).toBe(true)
    expect(ALLOWED_HOSTS).toContain('bbz-dithmarschen.webuntis.com')
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
    expect(describeFailure({ status: 404, url: `${BASE}/x` }).error).toContain('bbz-dithmarschen.webuntis.com')
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
    const res = await request(`${BASE}/api/x`, { fetchImpl, method: 'POST', body: '{}' })
    expect(res).toEqual({ ok: true, status: 200, data: { a: 1 } })
    expect(fetchImpl.mock.calls[0][1]).toMatchObject({ method: 'POST', credentials: 'include', redirect: 'manual' })
  })

  it('returns text for non-JSON responses', async () => {
    const res = await request(`${BASE}/api/token/new`, { fetchImpl: async () => response(200, 'a.b.c', 'text/plain') })
    expect(res).toEqual({ ok: true, status: 200, data: 'a.b.c' })
  })

  it('treats a web page as expired login when JSON is expected', async () => {
    const fetchImpl = async () => response(200, '<html>', 'text/html;charset=UTF-8')
    expect(await request(`${BASE}/api/x`, { fetchImpl, expect: 'json' })).toMatchObject({ ok: false, code: 'auth' })
    expect(await request(`${BASE}/api/x`, { fetchImpl })).toMatchObject({ ok: true, data: '<html>' })
    const plain = async () => response(200, 'a.b.c', 'text/plain')
    expect(await request(`${BASE}/api/x`, { fetchImpl: plain, expect: 'json' })).toMatchObject({ ok: false, code: 'parse' })
  })

  it('reports broken JSON instead of throwing', async () => {
    const res = await request(`${BASE}/api/x`, { fetchImpl: async () => response(200, '<html>') })
    expect(res).toMatchObject({ ok: false, code: 'parse' })
  })

  it('maps HTTP errors', async () => {
    const res = await request(`${BASE}/api/x`, { fetchImpl: async () => response(401) })
    expect(res).toEqual({ ok: false, status: 401, code: 'auth', error: 'Bitte erneut anmelden.' })
  })

  it('maps thrown network errors', async () => {
    const fetchImpl = async () => {
      throw new Error('net::ERR_INTERNET_DISCONNECTED')
    }
    expect(await request(`${BASE}/api/x`, { fetchImpl })).toMatchObject({ ok: false, code: 'offline' })
  })

  it('aborts after the timeout', async () => {
    const fetchImpl = (_url, { signal }) =>
      new Promise((_resolve, reject) =>
        signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })))
      )
    expect(await request(`${BASE}/api/x`, { fetchImpl, timeoutMs: 20 })).toMatchObject({ ok: false, code: 'timeout' })
  })

  it('uses the session fetch when given a session', async () => {
    const ses = { fetch: vi.fn(async () => response(200, '[]')) }
    expect(await request(`${BASE}/api/x`, { ses })).toEqual({ ok: true, status: 200, data: [] })
    expect(ses.fetch).toHaveBeenCalledOnce()
  })
})
