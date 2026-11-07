// Contrast of the design tokens in src/index.css (E-032): every mode × accent
// pair, the muted text, the status colors and the marks. Reads the CSS so a
// token tweak that breaks contrast fails here, not in someone's eyes.
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import { contrastRatio } from './lib/contrast.js'

const css = fs.readFileSync(new URL('./index.css', import.meta.url), 'utf8')

// "--color-x: #hex;" pairs of one declaration block
function tokens(block) {
  return Object.fromEntries([...block.matchAll(/--color-([\w-]+):\s*(#[0-9a-f]{3,6})\s*;/gi)].map((m) => [m[1], m[2]]))
}

function modeTokens(mode) {
  const m = new RegExp(`\\[data-mode='${mode}'\\]\\s*\\{([^}]*)\\}`).exec(css)
  if (!m) throw new Error(`mode block ${mode} missing`)
  return tokens(m[1])
}

function accentTokens(mode) {
  const re = new RegExp(`\\[data-mode='${mode}'\\]\\[data-accent='(\\w+)'\\][^{]*\\{([^}]*)\\}`, 'g')
  return Object.fromEntries([...css.matchAll(re)].map((m) => [m[1], tokens(m[2])]))
}

const ACCENTS = ['blue', 'coral', 'lilac', 'green']
const SURFACES = ['canvas', 'sidebar', 'surface', 'surface-2']
const STATUS = ['draft', 'missing', 'holiday', 'sick', 'vacation', 'warn']

describe.each(['dark', 'light'])('%s mode', (mode) => {
  const t = modeTokens(mode)
  const accents = accentTokens(mode)

  it('defines every neutral and status token', () => {
    for (const key of [...SURFACES, 'surface-3', 'line', 'mark', 'ink', 'ink-2', ...STATUS]) {
      expect(t[key], key).toMatch(/^#/)
    }
  })

  it('has all four accents', () => {
    expect(Object.keys(accents).sort()).toEqual([...ACCENTS].sort())
  })

  it.each(ACCENTS)('accent %s: 4.5:1 on every surface and for the text on it', (accent) => {
    const { accent: color, 'on-accent': on } = accents[accent]
    for (const s of SURFACES) expect(contrastRatio(color, t[s]), `${accent} on ${s}`).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(on, color), `text on ${accent}`).toBeGreaterThanOrEqual(4.5)
    // text on the accent is dark or near white — never grey
    expect([t.ink, '#121211', '#fcfcfa']).toContain(on.toLowerCase())
  })

  it('text and muted text reach 4.5:1 on every surface', () => {
    for (const s of [...SURFACES, 'surface-3']) {
      expect(contrastRatio(t.ink, t[s]), `ink on ${s}`).toBeGreaterThanOrEqual(4.5)
      expect(contrastRatio(t['ink-2'], t[s]), `ink-2 on ${s}`).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('status colors reach 4.5:1 as text and letters (also on the raised day-cell fill)', () => {
    for (const k of STATUS) {
      for (const s of SURFACES) expect(contrastRatio(t[k], t[s]), `${k} on ${s}`).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('marks that carry meaning (dashed "open" cells, input borders on hover) reach 3:1', () => {
    for (const s of SURFACES) expect(contrastRatio(t.mark, t[s]), `mark on ${s}`).toBeGreaterThanOrEqual(3)
  })
})
