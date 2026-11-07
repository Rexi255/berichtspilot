// The fictional demo record (e2e/fixtures/demo-daten.json) feeds UI
// screenshots and README images. It must load like an import and must never
// contain anything that looks like customer data.
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import { migrateData, validateData } from './lib/model.js'
import { findSensitive } from './lib/phrasing.js'

const raw = JSON.parse(fs.readFileSync(new URL('../e2e/fixtures/demo-daten.json', import.meta.url), 'utf8'))

describe('demo fixture', () => {
  it('loads like an import (migrate + validate)', () => {
    expect(() => validateData(migrateData(raw))).not.toThrow()
  })

  it('contains the demo "today" week (KW 45/2026) as a draft', () => {
    expect(raw.weeks.find((w) => w.id === '2026-11-02')?.status).toBe('draft')
  })

  it('has nothing the privacy check would flag', () => {
    const texts = raw.weeks.flatMap((w) => [
      w.instructions,
      ...w.days.flatMap((d) => [d.notes ?? '', ...d.bullets, ...(d.subjects ?? []).flatMap((s) => s.bullets)]),
    ])
    expect(findSensitive(texts.join('\n'))).toEqual([])
  })
})
