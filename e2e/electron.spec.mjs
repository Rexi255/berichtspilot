// Electron end-to-end test (step 10.2): the real app with its main process,
// preload and daten.json. Closing right after typing must keep the text (the
// close flush, E-023), and a restart must show it again. Needs a display —
// CI runs it under xvfb-run.
import { test, expect, _electron as electron } from '@playwright/test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { BLOCK_1, BULLET, MONDAY, WEDNESDAY, typeBullet, block1Text, closeWindow } from './week.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

// Unpacked runs keep daten.json in the working directory (electron/main.js),
// so a temp folder keeps the developer's own file out of it. The Chromium
// profile goes there too: an installed Berichtspilot shares the default one
// and its single-instance lock would end the test app at once.
function launch(dir) {
  const env = { ...process.env }
  delete env.ELECTRON_RUN_AS_NODE // set in VS Code terminals → Electron would start as plain Node
  delete env.VITE_DEV_SERVER_URL // load the built dist/, not a dev server
  return electron.launch({
    args: [
      ROOT,
      `--user-data-dir=${path.join(dir, 'profile')}`,
      // GitHub's Ubuntu runners block the Chromium sandbox (AppArmor)
      ...(process.platform === 'linux' ? ['--no-sandbox'] : []),
    ],
    cwd: dir,
    env,
  })
}

let dir
test.beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'berichtspilot-e2e-'))
})
test.afterEach(() => {
  try {
    fs.rmSync(dir, { recursive: true, force: true })
  } catch {
    // Windows may still hold the profile for a moment — the temp folder can stay
  }
})

test('closing right after typing keeps the text; a restart shows it', async () => {
  let app = await launch(dir)
  let page = await app.firstWindow()
  await page.getByRole('button', { name: 'Überspringen' }).click()

  // A fixed week whatever today is: the editor's date field jumps there
  await page.locator('[data-nav="editor"]').click()
  await page.locator('input[type="date"]').fill(WEDNESDAY)
  await page.getByRole('button', { name: 'Woche anlegen', exact: true }).click()
  await typeBullet(page)

  // Close at once — well inside the 400 ms autosave delay
  await Promise.all([app.waitForEvent('close'), closeWindow(page)])

  const saved = JSON.parse(fs.readFileSync(path.join(dir, 'daten.json'), 'utf8'))
  const day = saved.weeks.find((w) => w.id === MONDAY)?.days.find((d) => d.date === WEDNESDAY)
  expect(day?.bullets).toEqual([BULLET])

  // Restart: no wizard any more, the week is in the overview with the text
  app = await launch(dir)
  page = await app.firstWindow()
  await page.locator('[data-row]', { hasText: 'KW 18' }).click()
  await expect.poll(() => block1Text(page)).toBe(BLOCK_1)
  await app.close()
})
