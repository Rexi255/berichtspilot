// Main window guard: app URL check (dev server + built file on Linux/Windows),
// trusted IPC senders and the shape check before saving.
import { describe, it, expect } from 'vitest'
import { ALLOWED_PERMISSIONS, createAppUrlCheck, isTrustedSender, checkSaveData } from './guard.js'

describe('createAppUrlCheck', () => {
  it('accepts only the built index.html (query and hash ignored)', () => {
    const isAppUrl = createAppUrlCheck({ indexFile: '/opt/Berichtspilot/resources/app.asar/dist/index.html', platform: 'linux' })
    expect(isAppUrl('file:///opt/Berichtspilot/resources/app.asar/dist/index.html')).toBe(true)
    expect(isAppUrl('file:///opt/Berichtspilot/resources/app.asar/dist/index.html#/x?y=1')).toBe(true)
    expect(isAppUrl('file:///home/me/Downloads/evil.html')).toBe(false)
    expect(isAppUrl('file:///opt/Berichtspilot/resources/app.asar/dist/other.html')).toBe(false)
    expect(isAppUrl('https://example.com/')).toBe(false)
    expect(isAppUrl('about:blank')).toBe(false)
    expect(isAppUrl('not a url')).toBe(false)
  })

  it('compares Windows paths case-insensitively and decodes percent-encoding', () => {
    const isAppUrl = createAppUrlCheck({
      indexFile: 'C:\\Users\\Jänn Müller\\AppData\\Local\\Programs\\Berichtspilot\\resources\\app.asar\\dist\\index.html',
      platform: 'win32',
    })
    expect(
      isAppUrl('file:///c:/Users/J%C3%A4nn%20M%C3%BCller/AppData/Local/Programs/Berichtspilot/resources/app.asar/dist/index.html')
    ).toBe(true)
    expect(isAppUrl('file:///C:/Users/J%C3%A4nn%20M%C3%BCller/Downloads/evil.html')).toBe(false)
  })

  it('accepts every page of the dev server origin, nothing else', () => {
    const isAppUrl = createAppUrlCheck({ devServerUrl: 'http://localhost:5173', indexFile: '/x/dist/index.html' })
    expect(isAppUrl('http://localhost:5173/')).toBe(true)
    expect(isAppUrl('http://localhost:5173/src/main.jsx?t=1')).toBe(true)
    expect(isAppUrl('http://localhost:5174/')).toBe(false)
    expect(isAppUrl('file:///x/dist/index.html')).toBe(false)
  })
})

describe('isTrustedSender', () => {
  const isAppUrl = (url) => url === 'file:///app/index.html'
  const webContents = { id: 7, isDestroyed: () => false }
  const event = (over = {}) => ({ sender: { id: 7 }, senderFrame: { url: 'file:///app/index.html', parent: null }, ...over })

  it('accepts the app page in the main window', () => {
    expect(isTrustedSender(event(), { webContents, isAppUrl })).toBe(true)
  })

  it('refuses foreign pages, iframes, other windows and missing frames', () => {
    expect(isTrustedSender(event({ senderFrame: { url: 'file:///tmp/evil.html', parent: null } }), { webContents, isAppUrl })).toBe(false)
    expect(isTrustedSender(event({ senderFrame: { url: 'file:///app/index.html', parent: {} } }), { webContents, isAppUrl })).toBe(false)
    expect(isTrustedSender(event({ sender: { id: 8 } }), { webContents, isAppUrl })).toBe(false)
    expect(isTrustedSender(event({ senderFrame: null }), { webContents, isAppUrl })).toBe(false)
    expect(isTrustedSender(event(), { webContents: null, isAppUrl })).toBe(false)
    expect(isTrustedSender(event(), { webContents: { id: 7, isDestroyed: () => true }, isAppUrl })).toBe(false)
  })
})

describe('checkSaveData', () => {
  it('accepts the record shape of any schema version', () => {
    expect(checkSaveData({ version: 11, settings: {}, profiles: [], weeks: [], periods: [] })).toBeNull()
    expect(checkSaveData({ version: 99, settings: { theme: 'x' }, profiles: [{}], weeks: [{}] })).toBeNull()
  })

  it('refuses null, arrays and objects without the lists', () => {
    for (const bad of [null, undefined, 'x', [], {}, { version: '11', settings: {}, profiles: [], weeks: [] },
      { version: 11, settings: null, profiles: [], weeks: [] }, { version: 11, settings: {}, profiles: {}, weeks: [] },
      { version: 11, settings: {}, profiles: [] }, { version: 0, settings: {}, profiles: [], weeks: [] }]) {
      expect(checkSaveData(bad)).toMatch(/nichts gespeichert/)
    }
  })
})

describe('ALLOWED_PERMISSIONS', () => {
  it('only allows writing to the clipboard', () => {
    expect([...ALLOWED_PERMISSIONS]).toEqual(['clipboard-sanitized-write'])
  })
})
