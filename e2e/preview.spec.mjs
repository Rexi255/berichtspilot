// Preview and copying in the week editor (E-032), browser build with the
// fictional demo record. The preview must show exactly the text that gets
// copied — in every state: whitespace markers on or off, preview hidden
// (copy bar), button or Strg+1/2/3. Also: the privacy warning and the saved
// layout switches.
import { test, expect } from '@playwright/test'
import fs from 'node:fs'

const DEMO = fs.readFileSync(new URL('./fixtures/demo-daten.json', import.meta.url), 'utf8')

test.use({ permissions: ['clipboard-read', 'clipboard-write'] })

let errors
test.beforeEach(async ({ page }) => {
  errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  // The demo record's "today": Wednesday of KW 45/2026
  await page.clock.setFixedTime(new Date('2026-11-04T10:00:00+01:00'))
  await page.addInitScript((json) => {
    // seed once per tab, so a reload shows what the app saved
    if (!sessionStorage.getItem('seeded')) {
      localStorage.setItem('daten', json)
      sessionStorage.setItem('seeded', '1')
    }
    // record every copy exactly as the app hands it over
    const write = navigator.clipboard.writeText.bind(navigator.clipboard)
    window.__copied = []
    navigator.clipboard.writeText = (text) => {
      window.__copied.push(text)
      return write(text)
    }
  }, DEMO)
  await page.goto('/')
  await openEditor(page)
  await expect(page.getByRole('heading', { name: 'KW 45' })).toBeVisible()
})

// The shortcut works once the app has loaded its data and shows the shell
async function openEditor(page) {
  await page.locator('[data-nav="editor"]').waitFor()
  await page.keyboard.press('Control+Shift+Digit2')
}

test.afterEach(() => {
  expect(errors).toEqual([])
})

const copies = (page) => page.evaluate(() => window.__copied.length)
const lastCopy = (page) => page.evaluate(() => window.__copied.at(-1) ?? null)
// textContent keeps every blank line and space (toHaveText() would normalise)
const preText = (page, block) => page.locator(`[data-output="${block}"] pre`).textContent()

test('the preview shows exactly the copied text, with and without whitespace markers', async ({ page }) => {
  for (const block of ['work', 'school']) {
    await page.locator(`[data-output="${block}"]`).getByRole('button', { name: 'Kopieren' }).click()
    expect(await lastCopy(page)).toBe(await preText(page, block))
  }
  const work = await preText(page, 'work')
  expect(work).toContain('Dienstag, den 03.11.2026:\n- ')

  // markers are drawn by CSS only: the text stays the same
  await page.getByRole('switch', { name: 'Leerzeichen anzeigen' }).click()
  await expect(page.locator('[data-output="work"] pre')).toHaveClass(/ws-on/)
  expect(await preText(page, 'work')).toBe(work)

  // Strg+1 copies the very same string
  await page.keyboard.press('Control+Digit1')
  await expect.poll(() => lastCopy(page)).toBe(work)
  await page.keyboard.press('Control+Digit3')
  await expect.poll(() => lastCopy(page)).toBe(await preText(page, 'school'))
})

test('with the preview hidden, the copy bar and Strg+1–3 copy the same text; the choice is saved', async ({ page }) => {
  const work = await preText(page, 'work')
  const school = await preText(page, 'school')

  await page.keyboard.press('Control+KeyP')
  await expect(page.locator('[data-copybar]')).toBeVisible()
  await expect(page.locator('[data-output]')).toHaveCount(0)

  await page.locator('[data-copy="work"]').click()
  expect(await lastCopy(page)).toBe(work)
  const before = await copies(page)
  await page.keyboard.press('Control+Digit3')
  await expect.poll(() => copies(page)).toBe(before + 1)
  expect(await lastCopy(page)).toBe(school)

  await expect
    .poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('daten')).settings.layout.previewVisible))
    .toBe(false)
  await page.reload()
  await openEditor(page)
  await expect(page.locator('[data-copybar]')).toBeVisible()
  await page.keyboard.press('Control+KeyP')
  await expect(page.locator('[data-output="work"] pre')).toBeVisible()
})

test('a block with likely customer data warns; Strg+1 copies only on the second press', async ({ page }) => {
  await page.keyboard.press('Alt+Digit3')
  await expect(page.locator('[data-daytab="2026-11-04"]')).toHaveAttribute('aria-selected', 'true')
  await page.locator('[data-daycard]').getByPlaceholder('Tätigkeit beschreiben …').fill('Rückruf beim Kunden wegen Druckerstörung')

  const card = page.locator('[data-output="work"]')
  await expect(card.getByText('Mögliche Kundendaten')).toBeVisible()
  await expect(card.getByRole('button', { name: 'Trotzdem kopieren' })).toBeVisible()

  const before = await copies(page)
  await page.keyboard.press('Control+Digit1')
  await expect(page.getByText('noch einmal drücken')).toBeVisible()
  expect(await copies(page)).toBe(before)

  await page.keyboard.press('Control+Digit1')
  await expect.poll(() => copies(page)).toBe(before + 1)
  const copied = await lastCopy(page)
  expect(copied).toBe(await preText(page, 'work'))
  expect(copied).toContain('Mittwoch, den 04.11.2026:\n- Rückruf beim Kunden wegen Druckerstörung')
})

test('sidebar and notes switches are saved', async ({ page }) => {
  await expect(page.getByRole('region', { name: 'Notizen' })).toBeVisible()
  await page.keyboard.press('Control+KeyB')
  await page.keyboard.press('Control+Shift+KeyN')
  await expect(page.getByRole('region', { name: 'Notizen' })).toHaveCount(0)
  await expect
    .poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('daten')).settings.layout))
    .toMatchObject({ sidebarCollapsed: true, notesVisible: false })

  await page.reload()
  await openEditor(page)
  await expect(page.locator('aside')).toHaveCSS('width', '68px')
  await expect(page.getByRole('heading', { name: 'KW 45' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Notizen' })).toHaveCount(0)
})
