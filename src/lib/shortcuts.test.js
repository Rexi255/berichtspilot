import { describe, it, expect } from 'vitest'
import { matchShortcut, SHORTCUT_HELP } from './shortcuts.js'

// Minimal KeyboardEvent stand-in
const key = (code, mods = {}) => ({ code, ctrlKey: false, shiftKey: false, altKey: false, metaKey: false, ...mods })
const ALL = ['global', 'editor', 'overview']

describe('matchShortcut', () => {
  it('switches views with Strg+Umschalt+1–4 (German layout: key "!" but code Digit1)', () => {
    expect(matchShortcut({ ...key('Digit1', { ctrlKey: true, shiftKey: true }), key: '!' }, ALL)).toEqual({ id: 'view', arg: 0 })
    expect(matchShortcut(key('Digit4', { ctrlKey: true, shiftKey: true }), ALL)).toEqual({ id: 'view', arg: 3 })
    expect(matchShortcut(key('Digit5', { ctrlKey: true, shiftKey: true }), ALL)).toBeNull()
  })

  it('copies blocks with Strg+1–3, only in the editor', () => {
    expect(matchShortcut(key('Digit2', { ctrlKey: true }), ALL)).toEqual({ id: 'copy', arg: 1 })
    expect(matchShortcut(key('Digit4', { ctrlKey: true }), ALL)).toBeNull()
    expect(matchShortcut(key('Digit1', { ctrlKey: true }), ['global', 'overview'])).toBeNull()
  })

  it('selects days with Alt+1–6 and changes weeks with Alt+arrows', () => {
    expect(matchShortcut(key('Digit3', { altKey: true }), ALL)).toEqual({ id: 'day', arg: 2 })
    expect(matchShortcut(key('Digit6', { altKey: true }), ALL)).toEqual({ id: 'day', arg: 5 })
    expect(matchShortcut(key('ArrowLeft', { altKey: true }), ALL)).toEqual({ id: 'week', arg: -1 })
    expect(matchShortcut(key('ArrowRight', { altKey: true }), ALL)).toEqual({ id: 'week', arg: 1 })
  })

  it('never fires for AltGr (Ctrl+Alt) — typing "²", "@" or "{" stays typing', () => {
    expect(matchShortcut(key('Digit2', { ctrlKey: true, altKey: true }), ALL)).toBeNull()
    expect(matchShortcut(key('KeyQ', { ctrlKey: true, altKey: true }), ALL)).toBeNull()
    expect(matchShortcut(key('Digit7', { ctrlKey: true, altKey: true }), ALL)).toBeNull()
  })

  it('tells Strg+N (create week) from Strg+Umschalt+N (notes area)', () => {
    expect(matchShortcut(key('KeyN', { ctrlKey: true }), ALL)).toEqual({ id: 'createWeek', arg: true })
    expect(matchShortcut(key('KeyN', { ctrlKey: true, shiftKey: true }), ALL)).toEqual({ id: 'notes', arg: true })
  })

  it('knows sidebar, preview and search in their scopes', () => {
    expect(matchShortcut(key('KeyB', { ctrlKey: true }), ['global'])).toEqual({ id: 'sidebar', arg: true })
    expect(matchShortcut(key('KeyP', { ctrlKey: true }), ['global', 'editor'])).toEqual({ id: 'preview', arg: true })
    expect(matchShortcut(key('KeyP', { ctrlKey: true }), ['global', 'overview'])).toBeNull()
    expect(matchShortcut(key('KeyF', { ctrlKey: true }), ['global', 'overview'])).toEqual({ id: 'search', arg: true })
  })

  it('ignores plain keys, held-down repeats and Cmd', () => {
    expect(matchShortcut(key('Digit1'), ALL)).toBeNull()
    expect(matchShortcut(key('KeyB', { ctrlKey: true, repeat: true }), ALL)).toBeNull()
    expect(matchShortcut(key('KeyB', { metaKey: true }), ALL)).toBeNull()
    expect(matchShortcut(null, ALL)).toBeNull()
  })
})

describe('SHORTCUT_HELP', () => {
  it('lists every shortcut once with a German description', () => {
    const keys = SHORTCUT_HELP.map(([k]) => k)
    expect(new Set(keys).size).toBe(keys.length)
    expect(keys).toContain('Strg+B')
    for (const [, text] of SHORTCUT_HELP) expect(text).not.toMatch(/[.!]$/)
  })
})
