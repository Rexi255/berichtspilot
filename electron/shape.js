// Anonymised "shape" of JSON data and URLs — used by the WebUntis probe so that
// only the STRUCTURE of the school's API responses leaves the user's machine:
// keys and value types, never names, notes, ids, tokens or cookies.
//
// Rules:
//  · strings → "string(len)" (or "date"/"datetime"/"time" when they look like
//    one); the value itself is kept only for enum-like keys (type, status, …)
//    when it is a short identifier without spaces (e.g. "STUDENT", "CANCELLED")
//  · numbers → "integer"/"number", booleans → "boolean", null → "null"
//  · arrays → all items are merged into one shape, so a field that only some
//    lessons carry (e.g. notes) still shows up — marked optional with "?"
// Pure CommonJS (main process), tested in shape.test.mjs.

const MAX_DEPTH = 15
const MAX_ITEMS = 500 // items per array that are merged into the shape
const MAX_ENUM_VALUES = 12

// Keys whose short identifier values are harmless and tell us a lot about the API
const ENUM_KEY = /(type|types|status|state|kind|format|role|roles|option|method|mode|jsonrpc)$/i
const ENUM_VALUE = /^[A-Za-z0-9_.-]{1,40}$/

const DATE = /^\d{4}-\d{2}-\d{2}$/
const DATETIME = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/
const TIME = /^\d{2}:\d{2}(:\d{2})?$/

function createShape() {
  return {
    count: 0, // how often this position was observed
    prims: new Set(), // "null", "boolean", "integer", "number", "date", …
    strMin: Infinity,
    strMax: -1,
    enums: null, // Set of kept values (enum-like keys only)
    enumOverflow: false,
    objCount: 0,
    fields: null, // Map key -> shape
    arrCount: 0,
    arrMax: 0,
    items: null, // shape of the array items
    truncated: false,
  }
}

function isEnumKey(key) {
  return typeof key === 'string' && ENUM_KEY.test(key)
}

function addString(node, value, key) {
  if (DATETIME.test(value)) return node.prims.add('datetime')
  if (DATE.test(value)) return node.prims.add('date')
  if (TIME.test(value)) return node.prims.add('time')
  if (isEnumKey(key) && ENUM_VALUE.test(value)) {
    node.enums = node.enums || new Set()
    if (node.enums.size < MAX_ENUM_VALUES || node.enums.has(value)) node.enums.add(value)
    else node.enumOverflow = true
    return
  }
  node.prims.add('string')
  node.strMin = Math.min(node.strMin, value.length)
  node.strMax = Math.max(node.strMax, value.length)
}

/** Merge one sample value into the accumulated shape `node` (mutates, returns it). */
function addSample(node, value, key, depth = 0) {
  node.count++
  if (depth > MAX_DEPTH) {
    node.truncated = true
    return node
  }
  if (value === null || value === undefined) node.prims.add('null')
  else if (typeof value === 'boolean') node.prims.add('boolean')
  else if (typeof value === 'number') node.prims.add(Number.isInteger(value) ? 'integer' : 'number')
  else if (typeof value === 'string') addString(node, value, key)
  else if (Array.isArray(value)) {
    node.arrCount++
    node.arrMax = Math.max(node.arrMax, value.length)
    node.items = node.items || createShape()
    // Array items inherit the parent key, so e.g. roles: ["STUDENT"] stays readable
    for (const item of value.slice(0, MAX_ITEMS)) addSample(node.items, item, key, depth + 1)
  } else if (typeof value === 'object') {
    node.objCount++
    node.fields = node.fields || new Map()
    for (const [rawKey, v] of Object.entries(value)) {
      // Ids used as object keys (e.g. { "36931": [...] }) are values in disguise
      const k = /^\d+$/.test(rawKey) ? '<n>' : rawKey
      if (!node.fields.has(k)) node.fields.set(k, createShape())
      addSample(node.fields.get(k), v, k, depth + 1)
    }
  } else node.prims.add(typeof value)
  return node
}

function primitiveLabel(node) {
  const labels = []
  for (const p of ['null', 'boolean', 'integer', 'number', 'date', 'datetime', 'time']) {
    if (node.prims.has(p)) labels.push(p)
  }
  if (node.prims.has('string')) {
    labels.push(node.strMin === node.strMax ? `string(${node.strMax})` : `string(${node.strMin}..${node.strMax})`)
  }
  if (node.enums) {
    const values = [...node.enums].sort().map((v) => JSON.stringify(v))
    labels.push(`enum[${values.join(', ')}${node.enumOverflow ? ', …' : ''}]`)
  }
  for (const p of node.prims) {
    if (!['null', 'boolean', 'integer', 'number', 'date', 'datetime', 'time', 'string'].includes(p)) labels.push(p)
  }
  return labels.join(' | ')
}

/** Serialise an accumulated shape into plain, readable JSON. */
function shapeToJSON(node) {
  if (node.truncated && !node.objCount && !node.arrCount && !node.prims.size) return '…(too deep)'
  const prim = primitiveLabel(node)

  if (node.objCount) {
    const out = {}
    for (const [k, child] of node.fields) {
      // A key missing in some of the observed objects is optional
      out[child.count < node.objCount ? `${k}?` : k] = shapeToJSON(child)
    }
    if (node.arrCount) out.$alsoArray = shapeToJSON({ ...node, objCount: 0, prims: new Set(), enums: null })
    if (prim) out.$or = prim
    return out
  }
  if (node.arrCount) {
    const out = { $array: node.arrMax, $of: node.items.count ? shapeToJSON(node.items) : 'empty' }
    if (prim) out.$or = prim
    return out
  }
  return prim || 'unknown'
}

/** Anonymised shape of a single value. */
function shapeOf(value) {
  return shapeToJSON(addSample(createShape(), value))
}

/**
 * Anonymise a URL to host + path + query keys: numeric path segments become
 * ":n", long or odd segments ":id"; query values become their shape (kept only
 * for enum-like keys and the public school name). Fragments are dropped.
 */
function anonymizeUrl(raw) {
  let url
  try {
    url = new URL(raw)
  } catch {
    return '(invalid url)'
  }
  const segments = url.pathname.split('/').map((seg) => {
    if (!seg) return seg
    if (/^\d+$/.test(seg)) return ':n'
    // ids, hashes, user names: too long, unusual characters or mixed letters + digits
    const mixed = seg.length >= 8 && /\d/.test(seg) && /[a-z]/i.test(seg)
    if (seg.length > 40 || !/^[A-Za-z0-9_.-]+$/.test(seg) || /\d{4,}/.test(seg) || mixed) return ':id'
    return seg
  })
  const query = [...url.searchParams].map(([k, v]) => `${k}=${anonymizeParam(k, v)}`)
  return `${url.host}${segments.join('/')}${query.length ? '?' + query.join('&') : ''}`
}

function anonymizeParam(key, value) {
  if (value === '') return ''
  if (key === 'school' || (isEnumKey(key) && ENUM_VALUE.test(value))) return value
  if (/^\d+$/.test(value)) return value.length === 8 ? '<yyyymmdd?>' : '<n>'
  if (DATE.test(value)) return '<date>'
  if (DATETIME.test(value)) return '<datetime>'
  return `<string(${value.length})>`
}

module.exports = { createShape, addSample, shapeToJSON, shapeOf, anonymizeUrl }
