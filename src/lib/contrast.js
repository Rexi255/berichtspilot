// WCAG 2.x contrast math for the design tokens (E-032): every accent must
// reach 4.5:1 for text and marks, and the text on an accent is dark or near
// white, whichever reads better. Pure — src/theme.test.js applies it to the
// tokens in src/index.css.

/** "#rgb" / "#rrggbb" → [r, g, b] (0–255); throws on anything else */
export function parseHex(hex) {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(hex).trim())
  if (!m) throw new Error(`Keine Hex-Farbe: ${hex}`)
  const h = m[1].length === 3 ? [...m[1]].map((c) => c + c).join('') : m[1]
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16))
}

/** Relative luminance (0 = black, 1 = white) */
export function luminance(hex) {
  const [r, g, b] = parseHex(hex).map((v) => {
    const c = v / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Contrast ratio between two colors (1 … 21), order doesn't matter */
export function contrastRatio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/** The better text color on `background`: `dark` or `light` */
export function textOn(background, dark = '#121211', light = '#fcfcfa') {
  return contrastRatio(background, dark) >= contrastRatio(background, light) ? dark : light
}
