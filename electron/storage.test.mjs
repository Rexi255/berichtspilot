// daten.json storage against a real temp folder: atomic write + rolling
// backups, load fallback, one write at a time, retry on Windows file locks.
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { promises as fsp } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { createStorage, parseSnapshotName, MAX_BACKUPS, RENAME_RETRY_MS, KEEP } from './storage.js'

let dir
let dataPath
beforeEach(async () => {
  dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'berichtspilot-storage-'))
  dataPath = path.join(dir, 'daten.json')
})
afterEach(() => fsp.rm(dir, { recursive: true, force: true }))

const read = async (file) => JSON.parse(await fsp.readFile(file, 'utf8'))
const codeError = (code) => Object.assign(new Error(code), { code })

describe('save + load', () => {
  it('writes daten.json and keeps the previous states as .bak1–3', async () => {
    const storage = createStorage({ dataPath })
    for (let n = 1; n <= 5; n++) expect(await storage.save({ n })).toEqual({ ok: true })
    expect(await read(dataPath)).toEqual({ n: 5 })
    expect(await read(`${dataPath}.bak1`)).toEqual({ n: 4 })
    expect(await read(`${dataPath}.bak${MAX_BACKUPS}`)).toEqual({ n: 2 })
    await expect(fsp.access(`${dataPath}.tmp`)).rejects.toThrow()
  })

  it('loads daten.json, falls back to the newest readable backup, reports a first start', async () => {
    const storage = createStorage({ dataPath })
    expect(await storage.load()).toEqual({ ok: true, data: null, path: dataPath })
    await storage.save({ n: 1 })
    await storage.save({ n: 2 })
    expect(await storage.load()).toMatchObject({ ok: true, data: { n: 2 }, fromBackup: false })
    await fsp.writeFile(dataPath, '{ broken', 'utf8')
    expect(await storage.load()).toMatchObject({ ok: true, data: { n: 1 }, fromBackup: true })
  })

  it('reports an error instead of seed data when every existing file is broken', async () => {
    await fsp.writeFile(dataPath, '{ broken', 'utf8')
    await fsp.writeFile(`${dataPath}.bak1`, 'also broken', 'utf8')
    const res = await createStorage({ dataPath }).load()
    expect(res.ok).toBe(false)
    expect(res.error).toMatch(/SyntaxError/)
  })
})

describe('write queue', () => {
  it('never runs two writes at once; the newest waiting state wins', async () => {
    let active = 0
    let maxActive = 0
    const slowFs = {
      ...fsp,
      open: async (...args) => {
        active++
        maxActive = Math.max(maxActive, active)
        await delay(20)
        return fsp.open(...args)
      },
      rename: async (from, to) => {
        await fsp.rename(from, to)
        if (to === dataPath) active--
      },
    }
    const storage = createStorage({ dataPath, fs: slowFs })
    const results = await Promise.all([1, 2, 3, 4].map((n) => storage.save({ n })))
    expect(results).toEqual(Array(4).fill({ ok: true }))
    expect(maxActive).toBe(1)
    expect(await read(dataPath)).toEqual({ n: 4 })
    // 1 is written first; 2 and 3 are superseded by 4 while 1 is still running
    expect(await read(`${dataPath}.bak1`)).toEqual({ n: 1 })
    expect(storage.busy()).toBe(false)
  })

  it('idle() waits for the running write', async () => {
    const storage = createStorage({ dataPath })
    const saving = storage.save({ n: 1 })
    expect(storage.busy()).toBe(true)
    await storage.idle()
    expect(await read(dataPath)).toEqual({ n: 1 })
    await saving
    await storage.idle() // nothing running → resolves right away
  })

  it('reports a failed write and keeps working afterwards', async () => {
    let fail = true
    const flakyFs = { ...fsp, open: (...args) => (fail ? Promise.reject(codeError('ENOSPC')) : fsp.open(...args)) }
    const storage = createStorage({ dataPath, fs: flakyFs })
    const res = await storage.save({ n: 1 })
    expect(res.ok).toBe(false)
    expect(res.error).toMatch(/ENOSPC/)
    fail = false
    expect(await storage.save({ n: 2 })).toEqual({ ok: true })
    expect(await read(dataPath)).toEqual({ n: 2 })
  })
})

describe('rename retry (Windows file locks)', () => {
  it('retries EPERM/EBUSY with a growing pause', async () => {
    const pauses = []
    let failures = 2
    const lockedFs = {
      ...fsp,
      rename: (from, to) =>
        to === dataPath && failures-- > 0 ? Promise.reject(codeError(failures ? 'EPERM' : 'EBUSY')) : fsp.rename(from, to),
    }
    const storage = createStorage({ dataPath, fs: lockedFs, sleep: async (ms) => pauses.push(ms) })
    expect(await storage.save({ n: 1 })).toEqual({ ok: true })
    expect(pauses).toEqual(RENAME_RETRY_MS.slice(0, 2))
    expect(await read(dataPath)).toEqual({ n: 1 })
  })

  it('gives up after the last retry and on other errors right away', async () => {
    const pauses = []
    const sleep = async (ms) => pauses.push(ms)
    const alwaysLocked = { ...fsp, rename: (from, to) => (to === dataPath ? Promise.reject(codeError('EPERM')) : fsp.rename(from, to)) }
    const res = await createStorage({ dataPath, fs: alwaysLocked, sleep }).save({ n: 1 })
    expect(res.ok).toBe(false)
    expect(pauses).toEqual(RENAME_RETRY_MS)

    pauses.length = 0
    const gone = { ...fsp, rename: (from, to) => (to === dataPath ? Promise.reject(codeError('ENOENT')) : fsp.rename(from, to)) }
    expect((await createStorage({ dataPath, fs: gone, sleep }).save({ n: 1 })).ok).toBe(false)
    expect(pauses).toEqual([])
  })
})

describe('snapshots in sicherungen/', () => {
  const snapshotDir = () => path.join(dir, 'sicherungen')
  const names = async () => (await fsp.readdir(snapshotDir()).catch(() => [])).sort()
  // A clock the test can move: 2026-10-16 14:32:05 local time, +1 s per call
  const clock = (start = new Date(2026, 9, 16, 14, 32, 5)) => {
    let t = start.getTime()
    return { now: () => new Date((t += 1000)), set: (d) => (t = d.getTime()) }
  }

  it('parses only its own file names', () => {
    expect(parseSnapshotName('daten-2026-10-16.json')).toEqual({ name: 'daten-2026-10-16.json', date: '2026-10-16', time: null, reason: 'daily' })
    expect(parseSnapshotName('daten-2026-10-16-143205-vor-update.json')).toMatchObject({ time: '14:32:05', reason: 'update' })
    expect(parseSnapshotName('daten-2026-10-16-143205-vor-wiederherstellung.json')?.reason).toBe('restore')
    for (const other of ['daten.json', '../daten-2026-10-16.json', 'daten-2026-10-16.json.tmp', 'notes.txt', 'daten-2026-10-16-1432-vor-import.json']) {
      expect(parseSnapshotName(other)).toBeNull()
    }
  })

  it('takes one snapshot per day: the state before the first save of that day', async () => {
    const c = clock()
    const storage = createStorage({ dataPath, now: c.now })
    await storage.save({ version: 11, n: 1 }) // no daten.json yet → nothing to keep
    expect(await names()).toEqual([])
    await storage.save({ version: 11, n: 2 })
    await storage.save({ version: 11, n: 3 })
    expect(await names()).toEqual(['daten-2026-10-16.json'])
    expect(await read(path.join(snapshotDir(), 'daten-2026-10-16.json'))).toEqual({ version: 11, n: 1 })
    c.set(new Date(2026, 9, 17, 8, 0, 0))
    await storage.save({ version: 11, n: 4 })
    expect(await read(path.join(snapshotDir(), 'daten-2026-10-17.json'))).toEqual({ version: 11, n: 3 })
  })

  it('a new app instance does not overwrite the snapshot of the day', async () => {
    const c = clock()
    await createStorage({ dataPath, now: c.now }).save({ version: 11, n: 1 })
    await createStorage({ dataPath, now: c.now }).save({ version: 11, n: 2 })
    await createStorage({ dataPath, now: c.now }).save({ version: 11, n: 3 })
    expect(await read(path.join(snapshotDir(), 'daten-2026-10-16.json'))).toEqual({ version: 11, n: 1 })
  })

  it('keeps the file from before an app update (higher schema version than on disk)', async () => {
    await fsp.writeFile(dataPath, JSON.stringify({ version: 10, n: 'old' }), 'utf8')
    const storage = createStorage({ dataPath, now: clock().now })
    await storage.load()
    await storage.save({ version: 11, n: 'migrated' })
    await storage.save({ version: 11, n: 'edited' }) // same version → no further one
    const update = (await names()).filter((n) => n.endsWith('-vor-update.json'))
    expect(update).toHaveLength(1)
    expect(await read(path.join(snapshotDir(), update[0]))).toEqual({ version: 10, n: 'old' })
  })

  it('snapshot() before an import/restore waits for queued writes; unknown reasons are refused', async () => {
    const storage = createStorage({ dataPath, now: clock().now })
    expect(await storage.snapshot('import')).toEqual({ ok: true, name: null }) // nothing to keep yet
    storage.save({ version: 11, n: 1 })
    const res = await storage.snapshot('restore')
    expect(res.ok).toBe(true)
    expect(res.name).toMatch(/^daten-2026-10-16-\d{6}-vor-wiederherstellung\.json$/)
    expect(await read(path.join(snapshotDir(), res.name))).toEqual({ version: 11, n: 1 })
    expect((await storage.snapshot('daily')).ok).toBe(false)
    expect((await storage.snapshot('../x')).ok).toBe(false)
  })

  it('prunes each kind to its limit and leaves foreign files alone', async () => {
    const c = clock(new Date(2026, 0, 1, 9, 0, 0))
    const storage = createStorage({ dataPath, now: c.now })
    await storage.save({ version: 11, n: 0 })
    await fsp.mkdir(snapshotDir(), { recursive: true })
    await fsp.writeFile(path.join(snapshotDir(), 'meine-notiz.txt'), 'x', 'utf8')
    for (let day = 1; day <= KEEP.daily + 5; day++) {
      c.set(new Date(2026, 0, day, 9, 0, 0))
      await storage.save({ version: 11, n: day })
    }
    for (let i = 0; i < KEEP.import + 3; i++) await storage.snapshot('import')
    const all = await names()
    expect(all.filter((n) => parseSnapshotName(n)?.reason === 'daily')).toHaveLength(KEEP.daily)
    expect(all.filter((n) => parseSnapshotName(n)?.reason === 'import')).toHaveLength(KEEP.import)
    expect(all).toContain('meine-notiz.txt')
    // the oldest days are the ones removed
    expect(all).not.toContain('daten-2026-01-05.json')
    expect(all).toContain('daten-2026-02-04.json')
  })

  it('lists newest first and reads only valid names', async () => {
    const c = clock()
    const storage = createStorage({ dataPath, now: c.now })
    await storage.save({ version: 11, n: 1 })
    await storage.save({ version: 11, n: 2 }) // daily of 2026-10-16
    const imp = await storage.snapshot('import')
    const list = await storage.listSnapshots()
    expect(list.dir).toBe(snapshotDir())
    expect(list.backups.map((b) => b.reason)).toEqual(['import', 'daily'])
    expect(list.backups[0]).toMatchObject({ name: imp.name, date: '2026-10-16' })
    expect(list.backups[0].size).toBeGreaterThan(0)
    expect(await storage.readSnapshot('daten-2026-10-16.json')).toEqual({ ok: true, data: { version: 11, n: 1 } })
    expect((await storage.readSnapshot('../daten.json')).ok).toBe(false)
    expect((await storage.readSnapshot('daten-2020-01-01.json')).error).toMatch(/nicht mehr/)
  })

  it('load falls back to the newest readable snapshot when daten.json and every .bak are broken', async () => {
    const c = clock()
    const storage = createStorage({ dataPath, now: c.now })
    await storage.save({ version: 11, n: 1 })
    await storage.save({ version: 11, n: 2 })
    await storage.snapshot('import') // holds n: 2
    for (const file of [dataPath, `${dataPath}.bak1`]) await fsp.writeFile(file, '{ broken', 'utf8')
    const res = await createStorage({ dataPath }).load()
    expect(res).toMatchObject({ ok: true, fromBackup: true, data: { version: 11, n: 2 } })
  })
})
