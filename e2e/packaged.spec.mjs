// Packaged app check (release workflow, E-029): the fuses and the asar
// integrity check only exist in the built app — never in dev or in the other
// tests — so a broken build must fail here, before it reaches the update feed.
// Runs only with PACKAGED_APP set to the unpacked executable:
//   PACKAGED_APP=release/win-unpacked/Berichtspilot.exe npx playwright test --project=packaged
import { test, expect, chromium } from '@playwright/test'
import fuses from '@electron/fuses'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { closeWindow } from './week.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const EXE = process.env.PACKAGED_APP ? path.resolve(ROOT, process.env.PACKAGED_APP) : null

test.skip(!EXE, 'PACKAGED_APP not set — runs in the release workflow')

// A fuse is one byte in the binary: '1' = on, '0' = off (FuseState, which
// @electron/fuses doesn't export)
const FUSE_ON = '1'.charCodeAt(0)
const FUSE_OFF = '0'.charCodeAt(0)

test('the fuses match package.json', async () => {
  const { electronFuses } = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).build
  const wire = await fuses.getCurrentFuseWire(EXE)
  for (const [key, on] of Object.entries(electronFuses)) {
    const option = fuses.FuseV1Options[key[0].toUpperCase() + key.slice(1)]
    expect(option, `unknown fuse ${key}`).toBeDefined()
    expect(wire[option], key).toBe(on ? FUSE_ON : FUSE_OFF)
  }
})

test('the packaged app starts from app.asar, saves and closes', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'berichtspilot-packaged-'))
  // Neither portable location: daten.json then goes to userData = --user-data-dir
  const env = { ...process.env }
  for (const key of ['ELECTRON_RUN_AS_NODE', 'PORTABLE_EXECUTABLE_DIR', 'APPIMAGE']) delete env[key]
  // No inspector (fuse) — the renderer is reached over CDP instead; port 0 =
  // Chromium picks one and writes it to DevToolsActivePort
  const child = spawn(
    EXE,
    [`--user-data-dir=${dir}`, '--remote-debugging-port=0', ...(process.platform === 'linux' ? ['--no-sandbox'] : [])],
    { env, stdio: ['ignore', 'pipe', 'pipe'] }
  )
  // The app's own output (a FATAL from the asar check lands here) — printed
  // only if the test fails
  let output = ''
  child.stdout.on('data', (chunk) => (output += chunk))
  child.stderr.on('data', (chunk) => (output += chunk))
  const exited = new Promise((resolve) => child.on('exit', (code, signal) => resolve(signal ?? code)))
  try {
    const portFile = path.join(dir, 'DevToolsActivePort')
    await expect.poll(() => fs.existsSync(portFile), { timeout: 30_000 }).toBe(true)
    const port = fs.readFileSync(portFile, 'utf8').split('\n')[0]
    const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`)
    await expect.poll(() => browser.contexts()[0]?.pages().length ?? 0).toBeGreaterThan(0)
    const page = browser.contexts()[0].pages()[0]

    expect(page.url()).toMatch(/\/resources\/app\.asar\/dist\/index\.html$/)
    // Fresh profile → the setup wizard; skipping it saves setupDone
    await page.getByRole('button', { name: 'Überspringen' }).click()
    await expect(page.getByText('Noch keine Berichtswochen angelegt.')).toBeVisible()
    await closeWindow(page)

    expect(await exited).toBe(0)
    const saved = JSON.parse(fs.readFileSync(path.join(dir, 'daten.json'), 'utf8'))
    expect(saved.settings.setupDone).toBe(true)
  } catch (error) {
    console.log(`--- output of ${EXE}:\n${output.trim() || '(none)'}`)
    throw error
  } finally {
    child.kill()
    try {
      fs.rmSync(dir, { recursive: true, force: true })
    } catch {
      // Windows may still hold the profile for a moment
    }
  }
})
