// JWT helpers: recognise the WebUntis token, read its payload, renew in time.
import { Buffer } from 'node:buffer'
import { describe, it, expect } from 'vitest'
import { isJwt, decodeJwtPayload, expiresSoon } from './jwt.js'

const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url')
const jwt = (payload) => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(payload)}.c2lnbmF0dXJl`

describe('isJwt', () => {
  it('accepts a compact JWT', () => {
    expect(isJwt(jwt({ person_id: 1 }))).toBe(true)
  })

  it('rejects HTML, JSON, empty and non-strings', () => {
    expect(isJwt('<!DOCTYPE html><html></html>')).toBe(false)
    expect(isJwt('{"token":"a.b.c"}')).toBe(false)
    expect(isJwt('a.b')).toBe(false)
    expect(isJwt(` ${jwt({})}`)).toBe(false)
    expect(isJwt('')).toBe(false)
    expect(isJwt(null)).toBe(false)
    expect(isJwt(42)).toBe(false)
  })
})

describe('decodeJwtPayload', () => {
  it('returns the payload', () => {
    expect(decodeJwtPayload(jwt({ person_id: 4711, exp: 100 }))).toEqual({ person_id: 4711, exp: 100 })
  })

  it('returns null for garbage or a non-object payload', () => {
    expect(decodeJwtPayload('not a token')).toBe(null)
    expect(decodeJwtPayload('aaa.bbb.ccc')).toBe(null)
    expect(decodeJwtPayload(`x.${b64([1, 2])}.y`)).toBe(null)
    expect(decodeJwtPayload(`x.${b64('text')}.y`)).toBe(null)
  })
})

describe('expiresSoon', () => {
  const now = 1_000_000_000_000 // ms
  const exp = (secondsFromNow) => ({ exp: now / 1000 + secondsFromNow })

  it('is false while the token has more than the margin left', () => {
    expect(expiresSoon(exp(15 * 60), now)).toBe(false)
    expect(expiresSoon(exp(61), now)).toBe(false)
  })

  it('is true within the margin or after expiry', () => {
    expect(expiresSoon(exp(60), now)).toBe(true)
    expect(expiresSoon(exp(5), now)).toBe(true)
    expect(expiresSoon(exp(-10), now)).toBe(true)
    expect(expiresSoon(exp(100), now, 120)).toBe(true)
  })

  it('treats a missing or broken exp as expired', () => {
    expect(expiresSoon({}, now)).toBe(true)
    expect(expiresSoon({ exp: 'soon' }, now)).toBe(true)
    expect(expiresSoon(null, now)).toBe(true)
  })
})
