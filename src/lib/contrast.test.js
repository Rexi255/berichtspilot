import { describe, it, expect } from 'vitest'
import { parseHex, luminance, contrastRatio, textOn } from './contrast.js'

describe('parseHex', () => {
  it('reads long and short hex, any case', () => {
    expect(parseHex('#6CC9DE')).toEqual([108, 201, 222])
    expect(parseHex('#fff')).toEqual([255, 255, 255])
  })

  it('rejects anything else', () => {
    expect(() => parseHex('oklch(0.8 0.1 200)')).toThrow()
    expect(() => parseHex('#12345')).toThrow()
  })
})

describe('contrastRatio', () => {
  it('is 21 for black on white and 1 for equal colors', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5)
    expect(contrastRatio('#6CC9DE', '#6CC9DE')).toBe(1)
  })

  it('matches known WCAG values', () => {
    // #767676 on white is the classic "just passes AA" grey
    expect(contrastRatio('#767676', '#ffffff')).toBeCloseTo(4.54, 2)
    expect(luminance('#ffffff')).toBe(1)
  })

  it('does not depend on the order', () => {
    expect(contrastRatio('#121211', '#6CC9DE')).toBe(contrastRatio('#6CC9DE', '#121211'))
  })
})

describe('textOn', () => {
  it('picks dark text on the light logo blue and light text on a deep accent', () => {
    expect(textOn('#6CC9DE')).toBe('#121211')
    expect(textOn('#1F6F82')).toBe('#fcfcfa')
  })
})
