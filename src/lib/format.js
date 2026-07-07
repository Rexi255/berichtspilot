// Erzeugung der drei Ausgabeblöcke — das Format ist Pflicht und muss exakt
// den echten IHK-Berichten entsprechen (siehe CLAUDE.md / Beispieldaten).
import { formatDE, wochentagName } from './dates.js'

/** "Mittwoch, den 21.01.2026:" */
export function tagesHeader(iso) {
  return `${wochentagName(iso)}, den ${formatDE(iso)}:`
}

// Statuszeile für Nicht-Normal-Tage (ersetzt sämtliche Stichpunkte)
function statusZeile(tag) {
  if (tag.status === 'feiertag') return `- Feiertag: ${tag.feiertagName || 'Feiertag'}`
  if (tag.status === 'krank') return '- Krankheitstag'
  if (tag.status === 'urlaub') return '- Urlaub'
  return null
}

const nichtLeer = (s) => s.trim().length > 0

/**
 * Block 1 — Betriebliche Tätigkeiten.
 * Pro Betriebstag: Header + "- "-Bullets, EINE Leerzeile zwischen den Tagen.
 * Feiertag/Krank/Urlaub: nur die Statuszeile statt der Bullets.
 */
export function formatBetrieb(woche) {
  const bloecke = []
  for (const tag of woche.tage) {
    if (tag.typ !== 'betrieb') continue
    const status = statusZeile(tag)
    const zeilen = status
      ? [status]
      : tag.stichpunkte.filter(nichtLeer).map((s) => `- ${s.trim()}`)
    bloecke.push([tagesHeader(tag.datum), ...zeilen].join('\n'))
  }
  return bloecke.join('\n\n')
}

/** Block 2 — Unterweisungen: freier Text, unverändert übernommen. */
export function formatUnterweisungen(woche) {
  return (woche.unterweisungen || '').trim()
}

/**
 * Block 3 — Berufsschule.
 * Pro Schultag: Header, Leerzeile, dann je Fach "Label:" + Bullets.
 * EINE Leerzeile zwischen Fächern, ZWEI Leerzeilen zwischen den Tagen.
 * Feiertag/Krank/Urlaub-Tage sind kompakt (Header + Statuszeile) und werden
 * nur mit EINER Leerzeile abgetrennt — wie in den echten Berichten.
 */
export function formatBerufsschule(woche) {
  const bloecke = [] // { text, kompakt }
  for (const tag of woche.tage) {
    if (tag.typ !== 'schule') continue
    const status = statusZeile(tag)
    if (status) {
      bloecke.push({ text: `${tagesHeader(tag.datum)}\n${status}`, kompakt: true })
      continue
    }
    const faecher = tag.faecher
      .map((f) => ({ label: f.label.trim(), punkte: f.punkte.filter(nichtLeer) }))
      .filter((f) => f.label && f.punkte.length > 0)
      .map((f) => [`${f.label}:`, ...f.punkte.map((p) => `- ${p.trim()}`)].join('\n'))
    const inhalt = faecher.join('\n\n')
    bloecke.push({
      text: inhalt ? `${tagesHeader(tag.datum)}\n\n${inhalt}` : tagesHeader(tag.datum),
      kompakt: !inhalt,
    })
  }

  // Trennregel: zwei Leerzeilen zwischen vollen Schultagen, eine wenn ein
  // kompakter Statustag beteiligt ist.
  let out = ''
  bloecke.forEach((b, i) => {
    if (i > 0) {
      const vorher = bloecke[i - 1]
      out += vorher.kompakt || b.kompakt ? '\n\n' : '\n\n\n'
    }
    out += b.text
  })
  return out
}

/** Alle drei Blöcke auf einmal (für Vorschau + Export) */
export function formatAlle(woche) {
  return {
    betrieb: formatBetrieb(woche),
    unterweisungen: formatUnterweisungen(woche),
    berufsschule: formatBerufsschule(woche),
  }
}
