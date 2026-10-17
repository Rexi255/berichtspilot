// daten.json on disk (E-003, E-023, E-024): load with fallback to the backups,
// safe saving — a crash or power failure must never destroy a training record
// that grew over years — and snapshots in `sicherungen/` that survive logic
// errors too. Pure CommonJS with an injectable `fs` and clock, tested in
// storage.test.mjs against a temp folder.
const path = require('node:path')
const fsp = require('node:fs').promises

// How many rolling backups (daten.json.bak1 … .bakN) we keep
const MAX_BACKUPS = 3
// Windows: virus scanners and indexers briefly lock a freshly written file, so
// the final rename can fail with one of these — retried with a growing pause
const LOCKED = new Set(['EPERM', 'EBUSY', 'EACCES'])
const RENAME_RETRY_MS = [50, 100, 200, 400, 800]

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// Snapshots (E-024): a folder next to daten.json the user may browse, so the
// names are German. One per day ("daten-2026-10-16.json", the state before
// that day's first save) plus one before every app update that changes the
// schema, every import and every restore ("daten-2026-10-16-143205-vor-import.json").
const SNAPSHOT_DIR = 'sicherungen'
const REASONS = { update: 'vor-update', import: 'vor-import', restore: 'vor-wiederherstellung' }
const KEEP = { daily: 30, update: 10, import: 10, restore: 10 }
const SNAPSHOT_NAME = /^daten-(\d{4}-\d{2}-\d{2})(?:-(\d{6})-(vor-update|vor-import|vor-wiederherstellung))?\.json$/
const REASON_OF = Object.fromEntries(Object.entries(REASONS).map(([reason, suffix]) => [suffix, reason]))

const pad = (n) => String(n).padStart(2, '0')
const dateOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const timeOf = (d) => `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`

/** `{ name, date, time, reason }` of a snapshot file name, or null for any other file. */
function parseSnapshotName(name) {
  const m = SNAPSHOT_NAME.exec(String(name))
  if (!m) return null
  return {
    name: m[0],
    date: m[1],
    time: m[2] ? `${m[2].slice(0, 2)}:${m[2].slice(2, 4)}:${m[2].slice(4)}` : null,
    reason: m[3] ? REASON_OF[m[3]] : 'daily',
  }
}

// Newest first: by date, then time (a daily snapshot is the day's first state)
const newestFirst = (a, b) =>
  a.date !== b.date ? (a.date < b.date ? 1 : -1) : (b.time ?? '') < (a.time ?? '') ? -1 : 1

/**
 * Storage for one daten.json. `save()` may be called at any time: writes run
 * one after another, and while one runs only the newest waiting state is kept
 * (older ones are superseded — their callers get the newer result). That keeps
 * two writes from sharing the temp file.
 */
function createStorage({ dataPath, fs = fsp, sleep = wait, now = () => new Date() }) {
  const tmpPath = `${dataPath}.tmp`
  const backupPath = (i) => `${dataPath}.bak${i}`
  const snapshotDir = path.join(path.dirname(dataPath), SNAPSHOT_DIR)
  // Schema version of daten.json on disk (from load/the last write): a save with a
  // higher one is the first after an app update → snapshot before it (E-024)
  let diskVersion = null
  let dailyDone = null // date whose daily snapshot exists

  async function exists(file) {
    try {
      await fs.access(file)
      return true
    } catch {
      return false
    }
  }

  async function snapshotNames() {
    try {
      return (await fs.readdir(snapshotDir)).map(parseSnapshotName).filter(Boolean)
    } catch {
      return [] // no folder yet
    }
  }

  // Keep the newest KEEP[reason] of each kind; only our own file names are touched
  async function prune() {
    const all = (await snapshotNames()).sort(newestFirst)
    for (const reason of Object.keys(KEEP)) {
      for (const old of all.filter((s) => s.reason === reason).slice(KEEP[reason])) {
        await fs.rm(path.join(snapshotDir, old.name), { force: true }).catch(() => {})
      }
    }
  }

  /** Copy daten.json into sicherungen/ → its name, or null without a daten.json. Throws on failure. */
  async function copySnapshot(reason) {
    if (!(await exists(dataPath))) return null
    const t = now()
    const name = reason === 'daily' ? `daten-${dateOf(t)}.json` : `daten-${dateOf(t)}-${timeOf(t)}-${REASONS[reason]}.json`
    await fs.mkdir(snapshotDir, { recursive: true })
    await fs.copyFile(dataPath, path.join(snapshotDir, name))
    await prune()
    return name
  }

  // Before overwriting: today's first state, and the pre-update state. Failures
  // here never block the save itself (like the .bak rotation).
  async function autoSnapshots(data) {
    const today = dateOf(now())
    // Done for today once the file exists — not before the first daten.json
    // (nothing to keep yet) and not after a failed copy (tried again next save)
    if (dailyDone !== today) {
      const file = path.join(snapshotDir, `daten-${today}.json`)
      if ((await exists(file)) || (await copySnapshot('daily').catch(() => null))) dailyDone = today
    }
    if (diskVersion !== null && Number.isInteger(data?.version) && data.version > diskVersion) {
      await copySnapshot('update').catch(() => {})
    }
  }

  /**
   * Back up the previous state, rolling, BEFORE daten.json is overwritten:
   * .bak2 -> .bak3, .bak1 -> .bak2, daten.json -> .bak1 (copy). We copy instead
   * of moving so daten.json keeps existing until the final atomic rename.
   */
  async function rotateBackups() {
    try {
      await fs.access(dataPath) // no daten.json yet -> nothing to back up
    } catch {
      return
    }
    await fs.rm(backupPath(MAX_BACKUPS), { force: true }).catch(() => {})
    for (let i = MAX_BACKUPS - 1; i >= 1; i--) {
      await fs.rename(backupPath(i), backupPath(i + 1)).catch(() => {})
    }
    await fs.copyFile(dataPath, backupPath(1)).catch(() => {})
  }

  async function renameWithRetry(from, to) {
    for (let attempt = 0; ; attempt++) {
      try {
        return await fs.rename(from, to)
      } catch (error) {
        if (!LOCKED.has(error?.code) || attempt >= RENAME_RETRY_MS.length) throw error
        await sleep(RENAME_RETRY_MS[attempt])
      }
    }
  }

  /**
   * Write atomically:
   *  1. the new data completely into a temp file, forced to disk via fsync —
   *     the old daten.json stays untouched meanwhile;
   *  2. back up the previous state (.bak1 … .bakN);
   *  3. atomically rename the temp file into place (rename is atomic within one
   *     partition — daten.json never exists half-written).
   */
  async function writeData(data) {
    const fh = await fs.open(tmpPath, 'w')
    try {
      await fh.writeFile(JSON.stringify(data, null, 2), 'utf8')
      await fh.sync() // buffers guaranteed on disk
    } finally {
      await fh.close()
    }
    await autoSnapshots(data)
    await rotateBackups()
    await renameWithRetry(tmpPath, dataPath)
    if (Number.isInteger(data?.version)) diskVersion = data.version
  }

  let waiting = null // { data, callers: [resolve] } — the newest state not yet written
  let running = null // promise of the write loop while it runs

  async function drain() {
    while (waiting) {
      const { data, callers } = waiting
      waiting = null
      let result
      try {
        await writeData(data)
        result = { ok: true }
      } catch (error) {
        result = { ok: false, error: String(error) }
      }
      for (const resolve of callers) resolve(result)
    }
    running = null
  }

  /** Queue the record for writing → `{ ok }` or `{ ok: false, error }`. Never rejects. */
  function save(data) {
    return new Promise((resolve) => {
      if (waiting) {
        waiting.data = data
        waiting.callers.push(resolve)
      } else {
        waiting = { data, callers: [resolve] }
      }
      if (!running) running = drain()
    })
  }

  /** Resolves once every queued write is done (before the app quits). */
  const idle = () => running ?? Promise.resolve()

  /**
   * daten.json first, then the backups in order, then the snapshots (newest
   * first). If the main file is corrupt (JSON error after an aborted write),
   * the newest readable copy is used.
   * → `{ ok: true, data, path, fromBackup }`, `{ ok: true, data: null }` on a
   * genuine first start, `{ ok: false, error }` if every existing file is broken.
   */
  async function load() {
    const candidates = [dataPath]
    for (let i = 1; i <= MAX_BACKUPS; i++) candidates.push(backupPath(i))
    for (const s of (await snapshotNames()).sort(newestFirst)) candidates.push(path.join(snapshotDir, s.name))
    let lastError = null
    for (const file of candidates) {
      try {
        const data = JSON.parse(await fs.readFile(file, 'utf8')) // throws for a corrupt file
        if (file === dataPath) diskVersion = Number.isInteger(data?.version) ? data.version : null
        return { ok: true, data, path: dataPath, fromBackup: file !== dataPath }
      } catch (error) {
        if (error.code === 'ENOENT') continue // file doesn't exist -> next one
        lastError = error // exists but is broken -> try a backup
      }
    }
    if (!lastError) return { ok: true, data: null, path: dataPath }
    return { ok: false, error: String(lastError), path: dataPath }
  }

  /**
   * Snapshot of the current daten.json on request — before an import or a
   * restore replaces it. Waits for queued writes first. → `{ ok, name }` (name
   * null if there is no daten.json yet) or `{ ok: false, error }` (German).
   */
  async function snapshot(reason) {
    if (reason !== 'import' && reason !== 'restore') return { ok: false, error: 'Unbekannter Sicherungsgrund.' }
    await idle()
    try {
      return { ok: true, name: await copySnapshot(reason) }
    } catch (error) {
      return { ok: false, error: `Sicherung fehlgeschlagen: ${error.message || error}` }
    }
  }

  /** All snapshots, newest first → `{ ok, dir, backups: [{ name, date, time, reason, size }] }`. */
  async function listSnapshots() {
    const backups = []
    for (const s of (await snapshotNames()).sort(newestFirst)) {
      try {
        backups.push({ ...s, size: (await fs.stat(path.join(snapshotDir, s.name))).size })
      } catch {
        // deleted meanwhile
      }
    }
    return { ok: true, dir: snapshotDir, backups }
  }

  /** Parsed content of one snapshot (`name` must be a snapshot file name) → `{ ok, data }` or `{ ok: false, error }`. */
  async function readSnapshot(name) {
    const parsed = parseSnapshotName(name)
    if (!parsed) return { ok: false, error: 'Unbekannte Sicherung.' }
    try {
      return { ok: true, data: JSON.parse(await fs.readFile(path.join(snapshotDir, parsed.name), 'utf8')) }
    } catch (error) {
      return { ok: false, error: error.code === 'ENOENT' ? 'Die Sicherung gibt es nicht mehr.' : 'Die Sicherung ist nicht lesbar.' }
    }
  }

  return { save, load, idle, busy: () => running !== null, snapshot, listSnapshots, readSnapshot }
}

module.exports = { createStorage, parseSnapshotName, MAX_BACKUPS, RENAME_RETRY_MS, SNAPSHOT_DIR, KEEP }
