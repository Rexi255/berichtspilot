// Datenmodell: Schema-Migration, Import-Validierung/-Merge, Zeiträume und
// Profil-Gültigkeitsprüfung.
import { describe, it, expect } from 'vitest'
import {
  DATEN_VERSION,
  migriereDaten,
  validiereDaten,
  mergeDaten,
  seedDaten,
  neueWoche,
  wendeZeitraumAn,
  zeitraumFuer,
  pruefeProfile,
  profilDupliziert,
  profilFuerDatum,
} from './model.js'

const profilMit = (patch) => ({
  id: 'p1',
  name: 'Testprofil',
  bundesland: 'SH',
  gueltigVon: '2026-02-02',
  gueltigBis: '2026-07-31',
  standardStichpunkte: 2,
  wochentage: {
    mo: { typ: 'schule', faecher: ['LF02'] },
    di: { typ: 'betrieb', faecher: [] },
    mi: { typ: 'betrieb', faecher: [] },
    do: { typ: 'betrieb', faecher: [] },
    fr: { typ: 'betrieb', faecher: [] },
    sa: { typ: 'frei', faecher: [] },
  },
  ...patch,
})

describe('migriereDaten (A2)', () => {
  it('hebt v1 auf die aktuelle Version und ergänzt neue Felder', () => {
    const v1 = {
      version: 1,
      einstellungen: { theme: 'graphit', ausbildungVon: '', ausbildungBis: '' },
      profile: [],
      wochen: [],
    }
    const migriert = migriereDaten(v1)
    expect(migriert.version).toBe(DATEN_VERSION)
    expect(migriert.zeitraeume).toEqual([])
    expect(migriert.einstellungen.startAnsicht).toBe('uebersicht')
    expect(migriert.einstellungen.textbausteine).toEqual([])
    expect(migriert.einstellungen.theme).toBe('graphit') // bleibt erhalten
  })

  it('behandelt fehlende version als v1', () => {
    expect(migriereDaten({ profile: [], wochen: [] }).version).toBe(DATEN_VERSION)
  })

  it('lehnt Daten aus einer neueren Version ab (Downgrade-Schutz)', () => {
    expect(() => migriereDaten({ version: DATEN_VERSION + 1 })).toThrow(/neueren Version/)
  })

  it('verändert das Original nicht', () => {
    const v1 = { version: 1, profile: [], wochen: [] }
    migriereDaten(v1)
    expect(v1.version).toBe(1)
    expect(v1.zeitraeume).toBeUndefined()
  })
})

describe('validiereDaten (A4)', () => {
  it('akzeptiert die Seed-Daten', () => {
    expect(() => validiereDaten(seedDaten())).not.toThrow()
  })

  it('wirft bei fehlenden Listen oder kaputten Strukturen', () => {
    expect(() => validiereDaten(null)).toThrow()
    expect(() => validiereDaten({ profile: [], wochen: 'nope' })).toThrow()
    expect(() => validiereDaten({ profile: [{}], wochen: [] })).toThrow(/Profil/)
    expect(() => validiereDaten({ profile: [], wochen: [{ id: 'kein-datum', tage: [] }] })).toThrow(/Woche/)
    expect(() =>
      validiereDaten({ profile: [], wochen: [{ id: '2026-07-06', tage: [{ datum: 'x' }] }] })
    ).toThrow(/Tag/)
  })
})

describe('mergeDaten (A4)', () => {
  it('ergänzt nur Fehlendes, Bestehendes bleibt unverändert', () => {
    const aktuell = {
      ...seedDaten(),
      wochen: [{ id: '2026-07-06', status: 'fertig', unterweisungen: '', tage: [] }],
    }
    const importiert = migriereDaten({
      version: 1,
      profile: [profilMit({ id: 'neu-1' })],
      wochen: [
        { id: '2026-07-06', status: 'entwurf', unterweisungen: 'anders', tage: [] }, // Konflikt
        { id: '2026-06-29', status: 'fertig', unterweisungen: '', tage: [] }, // neu
      ],
    })
    const ergebnis = mergeDaten(aktuell, importiert)
    expect(ergebnis.wochen.map((w) => w.id)).toEqual(['2026-06-29', '2026-07-06'])
    expect(ergebnis.wochen[1].status).toBe('fertig') // bestehende Woche gewinnt
    expect(ergebnis.profile.some((p) => p.id === 'neu-1')).toBe(true)
    expect(ergebnis.einstellungen).toEqual(aktuell.einstellungen)
  })
})

describe('Zeiträume (B5)', () => {
  const urlaub = { id: 'z1', typ: 'urlaub', label: 'Sommerurlaub', von: '2026-08-03', bis: '2026-08-14' }
  const ferien = { id: 'z2', typ: 'ferien', label: 'Sommerferien', von: '2026-07-20', bis: '2026-08-28' }

  it('zeitraumFuer findet den passenden Zeitraum', () => {
    expect(zeitraumFuer('2026-08-05', [urlaub, ferien])).toBe(urlaub)
    expect(zeitraumFuer('2026-08-20', [urlaub, ferien])).toBe(ferien)
    expect(zeitraumFuer('2026-09-01', [urlaub, ferien])).toBeNull()
  })

  it('neue Woche im Urlaub: Tage werden als Urlaub angelegt, Feiertag gewinnt', () => {
    const zeitraum = { id: 'z', typ: 'urlaub', label: '', von: '2026-04-27', bis: '2026-05-03' }
    // Woche ab Mo 27.04.2026 — Fr 01.05. ist Tag der Arbeit
    const woche = neueWoche('2026-04-27', [], [zeitraum])
    const freitag = woche.tage.find((t) => t.datum === '2026-05-01')
    expect(freitag.status).toBe('feiertag')
    expect(freitag.feiertagName).toBe('Tag der Arbeit')
    for (const t of woche.tage.filter((t) => t.datum !== '2026-05-01')) {
      expect(t.status).toBe('urlaub')
    }
  })

  it('neue Woche in den Ferien: Schultage werden zu Betriebstagen', () => {
    const profil = profilMit({ gueltigVon: '2026-02-02', gueltigBis: '2026-12-31' })
    const woche = neueWoche('2026-07-20', [profil], [ferien]) // Mo wäre Schule
    const montag = woche.tage.find((t) => t.datum === '2026-07-20')
    expect(montag.typ).toBe('betrieb')
    expect(montag.faecher).toEqual([])
  })

  it('wendeZeitraumAn markiert nur leere Normal-Tage bestehender Wochen', () => {
    const wochen = [
      {
        id: '2026-08-03',
        status: 'entwurf',
        unterweisungen: '',
        tage: [
          { datum: '2026-08-03', typ: 'betrieb', status: 'normal', feiertagName: null, stichpunkte: ['', ''], faecher: [] },
          { datum: '2026-08-04', typ: 'betrieb', status: 'normal', feiertagName: null, stichpunkte: ['Inhalt!'], faecher: [] },
          { datum: '2026-08-05', typ: 'betrieb', status: 'krank', feiertagName: null, stichpunkte: [''], faecher: [] },
        ],
      },
    ]
    const ergebnis = wendeZeitraumAn(wochen, urlaub)
    expect(ergebnis[0].tage[0].status).toBe('urlaub') // leer -> markiert
    expect(ergebnis[0].tage[1].status).toBe('normal') // Inhalt -> unangetastet
    expect(ergebnis[0].tage[2].status).toBe('krank') // manueller Status -> unangetastet
    // Ferien-Zeiträume verändern bestehende Wochen nicht
    expect(wendeZeitraumAn(wochen, ferien)).toBe(wochen)
  })
})

describe('pruefeProfile (D2)', () => {
  it('meldet Überlappungen', () => {
    const warnungen = pruefeProfile([
      profilMit({ id: 'a', name: 'A', gueltigVon: '2026-02-01', gueltigBis: '2026-07-31' }),
      profilMit({ id: 'b', name: 'B', gueltigVon: '2026-07-01', gueltigBis: '2026-12-31' }),
    ])
    expect(warnungen.some((w) => w.includes('überlappen'))).toBe(true)
  })

  it('meldet Lücken', () => {
    const warnungen = pruefeProfile([
      profilMit({ id: 'a', name: 'A', gueltigVon: '2026-02-01', gueltigBis: '2026-07-31' }),
      profilMit({ id: 'b', name: 'B', gueltigVon: '2026-09-01', gueltigBis: '2026-12-31' }),
    ])
    expect(warnungen.some((w) => w.includes('Lücke'))).toBe(true)
  })

  it('meldet fehlende/verdrehte Zeiträume', () => {
    expect(pruefeProfile([profilMit({ gueltigVon: '' })])[0]).toMatch(/vollständigen/)
    expect(
      pruefeProfile([profilMit({ gueltigVon: '2026-07-31', gueltigBis: '2026-02-02' })])[0]
    ).toMatch(/liegt vor/)
  })

  it('ist still bei sauber anschließenden Profilen', () => {
    expect(
      pruefeProfile([
        profilMit({ id: 'a', name: 'A', gueltigVon: '2025-08-01', gueltigBis: '2026-02-01' }),
        profilMit({ id: 'b', name: 'B', gueltigVon: '2026-02-02', gueltigBis: '2026-07-31' }),
      ])
    ).toEqual([])
  })
})

describe('profilDupliziert (D1) / profilFuerDatum', () => {
  it('kopiert mit neuer id und markiertem Namen', () => {
    const original = profilMit({})
    const kopie = profilDupliziert(original)
    expect(kopie.id).not.toBe(original.id)
    expect(kopie.name).toBe('Testprofil (Kopie)')
    expect(kopie.wochentage).toEqual(original.wochentage)
    expect(kopie.wochentage).not.toBe(original.wochentage) // echte Kopie
  })

  it('profilFuerDatum wählt das Profil über den Gültigkeitsbereich', () => {
    const a = profilMit({ id: 'a', gueltigVon: '2025-08-01', gueltigBis: '2026-02-01' })
    const b = profilMit({ id: 'b', gueltigVon: '2026-02-02', gueltigBis: '2026-07-31' })
    expect(profilFuerDatum([a, b], '2026-01-15')).toBe(a)
    expect(profilFuerDatum([a, b], '2026-03-01')).toBe(b)
    expect(profilFuerDatum([a, b], '2026-08-15')).toBeNull()
  })
})
