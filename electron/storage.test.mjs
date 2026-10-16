// daten.json storage against a real temp folder: atomic write + rolling
// backups, load fallback, one write at a time, retry on Windows file locks.
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { promises as fsp } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { createStorage, MAX_BACKUPS, RENAME_RETRY_MS } from './storage.js'

let dir
let dataPath
beforeEach(async () => {
  dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'berichtspilot-storage-'))
  dataPath = path.join(dir, 'daten.json')
})
afterEach(() => fsp.rm(dir, { recursive: true, force: true }))

const read = async (file) => JSON.parse(await fsp.readFile(file, 'utf8'))
const json = (value) => JSON.stringify(value)
const codeError = (code) => Object.assign(new Error(code), { code })

describe('save + load', () => {
  it('writes daten.json and keeps the previous states as .bak1–3', async () => {
    const storage = createStorage({ dataPath })
    for (let n = 1; n <= 5; n++) expect(await storage.save(json({ n }))).toEqual({ ok: true })
    expect(await read(dataPath)).toEqual({ n: 5 })
    expect(await read(`${dataPath}.bak1`)).toEqual({ n: 4 })
    expect(await read(`${dataPath}.bak${MAX_BACKUPS}`)).toEqual({ n: 2 })
    await expect(fsp.access(`${dataPath}.tmp`)).rejects.toThrow()
  })

  it('loads daten.json, falls back to the newest readable backup, reports a first start', async () => {
    const storage = createStorage({ dataPath })
    expect(await storage.load()).toEqual({ ok: true, data: null, path: dataPath })
    await storage.save(json({ n: 1 }))
    await storage.save(json({ n: 2 }))
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
    const results = await Promise.all([1, 2, 3, 4].map((n) => storage.save(json({ n }))))
    expect(results).toEqual(Array(4).fill({ ok: true }))
    expect(maxActive).toBe(1)
    expect(await read(dataPath)).toEqual({ n: 4 })
    // 1 is written first; 2 and 3 are superseded by 4 while 1 is still running
    expect(await read(`${dataPath}.bak1`)).toEqual({ n: 1 })
    expect(storage.busy()).toBe(false)
  })

  it('idle() waits for the running write', async () => {
    const storage = createStorage({ dataPath })
    const saving = storage.save(json({ n: 1 }))
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
    const res = await storage.save(json({ n: 1 }))
    expect(res.ok).toBe(false)
    expect(res.error).toMatch(/ENOSPC/)
    fail = false
    expect(await storage.save(json({ n: 2 }))).toEqual({ ok: true })
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
    expect(await storage.save(json({ n: 1 }))).toEqual({ ok: true })
    expect(pauses).toEqual(RENAME_RETRY_MS.slice(0, 2))
    expect(await read(dataPath)).toEqual({ n: 1 })
  })

  it('gives up after the last retry and on other errors right away', async () => {
    const pauses = []
    const sleep = async (ms) => pauses.push(ms)
    const alwaysLocked = { ...fsp, rename: (from, to) => (to === dataPath ? Promise.reject(codeError('EPERM')) : fsp.rename(from, to)) }
    const res = await createStorage({ dataPath, fs: alwaysLocked, sleep }).save(json({ n: 1 }))
    expect(res.ok).toBe(false)
    expect(pauses).toEqual(RENAME_RETRY_MS)

    pauses.length = 0
    const gone = { ...fsp, rename: (from, to) => (to === dataPath ? Promise.reject(codeError('ENOENT')) : fsp.rename(from, to)) }
    expect((await createStorage({ dataPath, fs: gone, sleep }).save(json({ n: 1 }))).ok).toBe(false)
    expect(pauses).toEqual([])
  })
})
