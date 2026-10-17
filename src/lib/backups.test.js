import { describe, it, expect } from 'vitest'
import { BACKUP_KINDS, backupTitle, sizeLabel } from './backups.js'

describe('backupTitle', () => {
  it('shows weekday, German date and the time if there is one', () => {
    expect(backupTitle({ date: '2026-10-16', time: '14:32:05' })).toBe('Fr, 16.10.2026 · 14:32')
    expect(backupTitle({ date: '2026-10-19', time: null })).toBe('Mo, 19.10.2026')
  })

  it('stays empty for a broken entry', () => {
    expect(backupTitle({ date: 'x' })).toBe('')
    expect(backupTitle()).toBe('')
  })
})

describe('sizeLabel', () => {
  it('uses KB below one megabyte and a German decimal comma above', () => {
    expect(sizeLabel(10)).toBe('1 KB')
    expect(sizeLabel(412 * 1024)).toBe('412 KB')
    expect(sizeLabel(1.34 * 1024 * 1024)).toBe('1,3 MB')
    expect(sizeLabel(undefined)).toBe('1 KB')
  })
})

describe('BACKUP_KINDS', () => {
  it('has a German label for every reason storage.js writes', () => {
    expect(Object.keys(BACKUP_KINDS).sort()).toEqual(['daily', 'import', 'restore', 'update'])
  })
})
