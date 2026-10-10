// JWT helpers for the WebUntis bearer token (E-013). We never verify the
// signature — the token comes straight from the server over TLS and is only
// read for its payload (`person_id`, `exp`) and handed back to the same server.

const JWT_PATTERN = /^[\w-]+\.[\w-]+\.[\w-]*$/

/** true if `text` looks like a compact JWT (three base64url parts). */
function isJwt(text) {
  return typeof text === 'string' && text.length < 8192 && JWT_PATTERN.test(text)
}

/** Payload object of a JWT, or null if it isn't one / can't be decoded. */
function decodeJwtPayload(token) {
  if (!isJwt(token)) return null
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'))
    return payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : null
  } catch {
    return null
  }
}

/**
 * true if the token expires within `marginSeconds` (or has no usable `exp`).
 * `now` in milliseconds. The margin covers clock skew and the time a follow-up
 * request takes, so a token is renewed BEFORE the server rejects it.
 */
function expiresSoon(payload, now = Date.now(), marginSeconds = 60) {
  const exp = Number(payload?.exp)
  if (!Number.isFinite(exp)) return true
  return exp * 1000 - now <= marginSeconds * 1000
}

module.exports = { isJwt, decodeJwtPayload, expiresSoon }
