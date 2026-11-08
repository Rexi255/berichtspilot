// UI screenshots of Berichtspilot with the fictional demo record
// (e2e/fixtures/demo-daten.json) — for Claude's own visual checks while
// working on the UI and for README images. Never touches a real daten.json.
//
//   node .claude/skills/ui-shots/shots.mjs [options]
//
//   --label=name            output folder scratch/shots/<name> (default: now)
//   --views=a,b             overview,editor,profiles,settings (+ styleguide in dev)
//   --modes=dark,light      color modes (settings.appearance.mode, schema v12)
//   --accents=blue          accents (settings.appearance.accent, schema v12)
//   --widths=1440,940       window widths (height --height=900)
//   --electron              the real app (unpacked) instead of the browser build
//   --hook=path.mjs         module whose default export (page, ctx) runs before
//                           each screenshot (clicks, typing, scrolling …)
//   --set='{"layout":{…}}'  JSON merged into settings (deep, one level)
//   --today=2026-11-04      frozen "today" (the demo record's today)
//
// Browser mode needs a current build (`npm run build:renderer`); it serves
// dist/ with `vite preview` on port 4174. Exit code 1 on console errors.
import { chromium, _electron as electron } from '@playwright/test'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const FIXTURE = path.join(ROOT, 'e2e/fixtures/demo-daten.json')
const PORT = 4174

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [key, ...rest] = a.replace(/^--/, '').split('=')
    return [key, rest.length ? rest.join('=') : true]
  })
)
const list = (value, fallback) => (typeof value === 'string' ? value.split(',').filter(Boolean) : fallback)

const label = typeof args.label === 'string' ? args.label : new Date().toISOString().replace(/[:.]/g, '-')
const OUT = path.join(ROOT, 'scratch/shots', label)
const views = list(args.views, ['overview', 'editor', 'profiles', 'settings'])
const modes = list(args.modes, ['dark', 'light'])
const accents = list(args.accents, ['blue'])
const widths = list(args.widths, ['1440', '940']).map(Number)
const height = Number(args.height ?? 900)
const today = typeof args.today === 'string' ? args.today : '2026-11-04'
const extra = typeof args.set === 'string' ? JSON.parse(args.set) : {}
const hook = typeof args.hook === 'string' ? (await import(pathToFileURL(path.resolve(args.hook)).href)).default : null

fs.mkdirSync(OUT, { recursive: true })
const fixture = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'))

// The demo record with mode/accent and extra settings applied
function record(mode, accent) {
  const data = structuredClone(fixture)
  const settings = { ...data.settings }
  settings.appearance = { ...(settings.appearance ?? {}), mode, accent }
  for (const [key, value] of Object.entries(extra)) {
    settings[key] = value && typeof value === 'object' && !Array.isArray(value) ? { ...(settings[key] ?? {}), ...value } : value
  }
  data.settings = settings
  return data
}

const problems = []
const watch = (page, tag) => {
  page.on('pageerror', (e) => problems.push(`${tag} pageerror: ${e.message}`))
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') problems.push(`${tag} console.${m.type()}: ${m.text()}`)
  })
}

// Wait until animations/transitions on the page have settled
const settle = (page) => page.waitForTimeout(450)

async function openView(page, view) {
  // The component gallery has no nav entry: App.jsx opens it on "#styleguide"
  // (browser build only)
  if (view === 'styleguide') {
    await page.evaluate(() => {
      window.location.hash = 'styleguide'
    })
    await settle(page)
    return
  }
  const nav = page.locator(`[data-nav="${view}"]`)
  if (await nav.count()) await nav.first().click()
  await settle(page)
}

async function shoot(page, file, tag) {
  // The page itself must never scroll sideways (inner scrollers may)
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement
    const main = document.querySelector('main')
    return {
      page: doc.scrollWidth > doc.clientWidth + 1,
      main: main ? main.scrollWidth > main.clientWidth + 1 : false,
    }
  })
  if (overflow.page || overflow.main) problems.push(`${tag} horizontal overflow (${JSON.stringify(overflow)})`)
  await page.screenshot({ path: path.join(OUT, file) })
}

async function serve() {
  const server = spawn('npx', ['vite', 'preview', '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'], {
    cwd: ROOT,
    shell: true,
    stdio: 'ignore',
  })
  for (let i = 0; i < 60; i++) {
    try {
      await fetch(`http://127.0.0.1:${PORT}/`)
      return server
    } catch {
      await new Promise((r) => setTimeout(r, 250))
    }
  }
  throw new Error('vite preview did not start')
}

async function browserRun() {
  if (!fs.existsSync(path.join(ROOT, 'dist/index.html'))) throw new Error('dist/ missing — run npm run build:renderer')
  const server = await serve()
  const browser = await chromium.launch()
  try {
    for (const mode of modes) {
      for (const accent of accents) {
        for (const width of widths) {
          const context = await browser.newContext({
            viewport: { width, height },
            timezoneId: 'Europe/Berlin',
            locale: 'de-DE',
            permissions: ['clipboard-read', 'clipboard-write'],
            colorScheme: mode === 'light' ? 'light' : 'dark',
          })
          const page = await context.newPage()
          const tag = `${mode}/${accent}/${width}`
          watch(page, tag)
          await page.clock.setFixedTime(new Date(`${today}T10:00:00`))
          await page.addInitScript((json) => {
            if (sessionStorage.getItem('ui-shots')) return
            localStorage.setItem('daten', json)
            sessionStorage.setItem('ui-shots', '1')
          }, JSON.stringify(record(mode, accent)))
          await page.goto(`http://127.0.0.1:${PORT}/`)
          await page.locator('[data-nav]').first().waitFor()
          for (const view of views) {
            await openView(page, view)
            if (hook) await hook(page, { view, mode, accent, width })
            await shoot(page, `${view}-${mode}-${accent}-${width}.png`, `${tag} ${view}`)
          }
          await context.close()
        }
      }
    }
  } finally {
    await browser.close()
    server.kill()
    if (process.platform === 'win32') spawn('taskkill', ['/pid', String(server.pid), '/t', '/f'], { stdio: 'ignore' })
  }
}

async function electronRun() {
  for (const mode of modes) {
    for (const accent of accents) {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'berichtspilot-shots-'))
      fs.writeFileSync(path.join(dir, 'daten.json'), JSON.stringify(record(mode, accent), null, 2))
      const env = { ...process.env }
      delete env.ELECTRON_RUN_AS_NODE
      delete env.VITE_DEV_SERVER_URL
      const app = await electron.launch({
        args: [ROOT, `--user-data-dir=${path.join(dir, 'profile')}`, ...(process.platform === 'linux' ? ['--no-sandbox'] : [])],
        cwd: dir,
        env,
      })
      try {
        const page = await app.firstWindow()
        const tag = `electron ${mode}/${accent}`
        watch(page, tag)
        await page.clock.setFixedTime(new Date(`${today}T10:00:00`))
        await page.reload()
        await page.locator('[data-nav]').first().waitFor()
        for (const width of widths) {
          await app.evaluate(({ BrowserWindow }, size) => BrowserWindow.getAllWindows()[0].setSize(size[0], size[1]), [width, height])
          for (const view of views) {
            await openView(page, view)
            if (hook) await hook(page, { view, mode, accent, width, app })
            await shoot(page, `electron-${view}-${mode}-${accent}-${width}.png`, `${tag}/${width} ${view}`)
          }
        }
      } finally {
        await app.close()
        try {
          fs.rmSync(dir, { recursive: true, force: true })
        } catch {
          // Windows may still hold the profile for a moment
        }
      }
    }
  }
}

await (args.electron ? electronRun() : browserRun())
console.log(`screenshots: ${path.relative(ROOT, OUT)}`)
for (const file of fs.readdirSync(OUT)) console.log(`  ${file}`)
if (problems.length) {
  console.log('\nproblems:')
  for (const p of problems) console.log(`  ${p}`)
  process.exitCode = 1
}
