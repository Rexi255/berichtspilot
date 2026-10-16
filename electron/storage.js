// daten.json on disk (E-003, step 7.2): load with fallback to the backups, and
// safe saving — a crash or power failure must never destroy a training record
// that grew over years. Pure CommonJS with an injectable `fs`, tested in
// storage.test.mjs against a temp folder.
const fsp = require('node:fs').promises

// How many rolling backups (daten.json.bak1 … .bakN) we keep
const MAX_BACKUPS = 3
// Windows: virus scanners and indexers briefly lock a freshly written file, so
// the final rename can fail with one of these — retried with a growing pause
const LOCKED = new Set(['EPERM', 'EBUSY', 'EACCES'])
const RENAME_RETRY_MS = [50, 100, 200, 400, 800]

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Storage for one daten.json. `save()` may be called at any time: writes run
 * one after another, and while one runs only the newest waiting state is kept
 * (older ones are superseded — their callers get the newer result). That keeps
 * two writes from sharing the temp file.
 */
function createStorage({ dataPath, fs = fsp, sleep = wait }) {
  const tmpPath = `${dataPath}.tmp`
  const backupPath = (i) => `${dataPath}.bak${i}`

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
  async function writeData(json) {
    const fh = await fs.open(tmpPath, 'w')
    try {
      await fh.writeFile(json, 'utf8')
      await fh.sync() // buffers guaranteed on disk
    } finally {
      await fh.close()
    }
    await rotateBackups()
    await renameWithRetry(tmpPath, dataPath)
  }

  let waiting = null // { json, callers: [resolve] } — the newest state not yet written
  let running = null // promise of the write loop while it runs

  async function drain() {
    while (waiting) {
      const { json, callers } = waiting
      waiting = null
      let result
      try {
        await writeData(json)
        result = { ok: true }
      } catch (error) {
        result = { ok: false, error: String(error) }
      }
      for (const resolve of callers) resolve(result)
    }
    running = null
  }

  /** Queue `json` for writing → `{ ok }` or `{ ok: false, error }`. Never rejects. */
  function save(json) {
    return new Promise((resolve) => {
      if (waiting) {
        waiting.json = json
        waiting.callers.push(resolve)
      } else {
        waiting = { json, callers: [resolve] }
      }
      if (!running) running = drain()
    })
  }

  /** Resolves once every queued write is done (before the app quits). */
  const idle = () => running ?? Promise.resolve()

  /**
   * daten.json first, then the backups in order. If the main file is corrupt
   * (JSON error after an aborted write), the newest readable backup is used.
   * → `{ ok: true, data, path, fromBackup }`, `{ ok: true, data: null }` on a
   * genuine first start, `{ ok: false, error }` if every existing file is broken.
   */
  async function load() {
    const candidates = [dataPath]
    for (let i = 1; i <= MAX_BACKUPS; i++) candidates.push(backupPath(i))
    let lastError = null
    for (const file of candidates) {
      try {
        const data = JSON.parse(await fs.readFile(file, 'utf8')) // throws for a corrupt file
        return { ok: true, data, path: dataPath, fromBackup: file !== dataPath }
      } catch (error) {
        if (error.code === 'ENOENT') continue // file doesn't exist -> next one
        lastError = error // exists but is broken -> try a backup
      }
    }
    if (!lastError) return { ok: true, data: null, path: dataPath }
    return { ok: false, error: String(lastError), path: dataPath }
  }

  return { save, load, idle, busy: () => running !== null }
}

module.exports = { createStorage, MAX_BACKUPS, RENAME_RETRY_MS }
