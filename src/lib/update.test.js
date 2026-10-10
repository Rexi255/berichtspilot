import { describe, it, expect } from 'vitest'
import { versionLabel, updateHint, updateSummary, canCheckForUpdate } from './update.js'

const status = (state, extra = {}) => ({ ok: state !== 'error', state, current: '1.2.0', ...extra })

describe('versionLabel', () => {
  it('adds exactly one v', () => {
    expect(versionLabel('1.3.0')).toBe('v1.3.0')
    expect(versionLabel('v1.3.0')).toBe('v1.3.0')
    expect(versionLabel(undefined)).toBe('')
  })
})

describe('updateHint', () => {
  it('shows nothing without a found release', () => {
    expect(updateHint(null)).toBeNull()
    for (const s of ['idle', 'checking', 'none', 'unsupported']) expect(updateHint(status(s))).toBeNull()
  })

  it('stays quiet when the check itself failed (no version)', () => {
    expect(updateHint(status('error', { code: 'offline', error: 'Keine Internetverbindung' }))).toBeNull()
  })

  it('walks download → progress → install', () => {
    expect(updateHint(status('available', { version: '1.3.0' }))).toEqual({ step: 'download', version: '1.3.0' })
    expect(updateHint(status('downloading', { version: '1.3.0', percent: 42.7 }))).toEqual({
      step: 'downloading',
      version: '1.3.0',
      percent: 42,
    })
    expect(updateHint(status('ready', { version: '1.3.0' }))).toEqual({ step: 'install', version: '1.3.0' })
  })

  it('clamps a missing or odd percentage', () => {
    expect(updateHint(status('downloading', { version: '1.3.0' })).percent).toBe(0)
    expect(updateHint(status('downloading', { version: '1.3.0', percent: 140 })).percent).toBe(100)
  })

  it('offers a retry when the download failed', () => {
    const s = status('error', { version: '1.3.0', code: 'integrity', error: 'Datei beschädigt' })
    expect(updateHint(s)).toEqual({ step: 'retry', version: '1.3.0', error: 'Datei beschädigt' })
  })
})

describe('updateSummary', () => {
  it('maps every state to a German line', () => {
    expect(updateSummary(null).tone).toBe('neutral')
    expect(updateSummary(status('idle')).text).toBe('Noch nicht gesucht')
    expect(updateSummary(status('checking')).text).toBe('Suche nach Updates …')
    expect(updateSummary(status('none'))).toEqual({ tone: 'done', text: 'Du hast die neueste Version' })
    expect(updateSummary(status('available', { version: '1.3.0' }))).toEqual({
      tone: 'accent',
      text: 'Version 1.3.0 verfügbar',
    })
    expect(updateSummary(status('downloading', { version: '1.3.0', percent: 5 })).text).toBe(
      'Version 1.3.0 wird heruntergeladen … 5 %'
    )
    expect(updateSummary(status('ready', { version: '1.3.0' })).text).toBe('Version 1.3.0 bereit zur Installation')
  })

  it('passes the German error / unsupported reason through', () => {
    expect(updateSummary(status('error', { error: 'Keine Internetverbindung' }))).toEqual({
      tone: 'sick',
      text: 'Keine Internetverbindung',
    })
    expect(updateSummary(status('unsupported', { error: 'Nur in der installierten App' })).text).toBe(
      'Nur in der installierten App'
    )
  })
})

describe('canCheckForUpdate', () => {
  it('allows a check unless busy, done or unsupported', () => {
    expect(canCheckForUpdate(null)).toBe(false)
    for (const s of ['idle', 'none', 'available', 'error']) expect(canCheckForUpdate(status(s))).toBe(true)
    for (const s of ['unsupported', 'checking', 'downloading', 'ready']) expect(canCheckForUpdate(status(s))).toBe(false)
  })
})
