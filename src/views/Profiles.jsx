// Profile management: half-year profiles (weekdays, subjects, federal state),
// periods (vacation/school breaks) + global training dates. One card level
// (E-032): rows inside a card are separated by lines.
import { useMemo, useState } from 'react'
import { PlusIcon, XIcon, ArrowUpIcon, ArrowDownIcon, TrashIcon, CopyIcon, ArrowRightIcon } from '@phosphor-icons/react'
import { useStore } from '../store.jsx'
import { Button, Card, IconButton, Input, Select, Segment, Field, Notice, cx } from '../ui/basics.jsx'
import { WEEKDAY_KEYS, WEEKDAY_LABELS, formatDE } from '../lib/dates.js'
import { STATES } from '../lib/holidays.js'
import { checkProfiles } from '../lib/model.js'
import { profileSubjectLabels, subjectKey } from '../lib/webuntis.js'

const move = (arr, from, to) => {
  if (to < 0 || to >= arr.length) return arr
  const copy = [...arr]
  const [el] = copy.splice(from, 1)
  copy.splice(to, 0, el)
  return copy
}

const TYPE_LETTER = { work: 'B', school: 'S' }

function CardHeader({ title, children }) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
      <h2 className="mr-auto text-title font-medium text-ink">{title}</h2>
      {children}
    </div>
  )
}

/* ----------------------- Subjects of a school day ----------------------- */

export function SubjectEditor({ subjects, onChange }) {
  const [draft, setDraft] = useState('')

  const add = () => {
    const label = draft.trim()
    if (!label) return
    onChange([...subjects, label])
    setDraft('')
  }

  return (
    <div className="flex flex-col gap-2">
      {subjects.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {subjects.map((label, i) => (
            <span
              key={`${label}-${i}`}
              className="group/subject inline-flex h-7 items-center gap-0.5 rounded-chip border border-line bg-surface-2 pl-2.5 pr-0.5 text-body font-medium text-ink"
            >
              {label}
              <span className="flex opacity-0 transition-opacity duration-150 group-focus-within/subject:opacity-100 group-hover/subject:opacity-100">
                <IconButton label="Nach vorn" size="sm" className="h-6 w-6" disabled={i === 0} onClick={() => onChange(move(subjects, i, i - 1))}>
                  <ArrowUpIcon size={12} className="-rotate-90" />
                </IconButton>
                <IconButton
                  label="Nach hinten"
                  size="sm"
                  className="h-6 w-6"
                  disabled={i === subjects.length - 1}
                  onClick={() => onChange(move(subjects, i, i + 1))}
                >
                  <ArrowDownIcon size={12} className="-rotate-90" />
                </IconButton>
                <IconButton label="Fach entfernen" size="sm" className="h-6 w-6" danger onClick={() => onChange(subjects.filter((_, j) => j !== i))}>
                  <XIcon size={12} />
                </IconButton>
              </span>
            </span>
          ))}
        </div>
      )}
      <div className="flex items-center gap-1.5">
        <Input
          value={draft}
          placeholder="z. B. LF07 oder Englisch"
          aria-label="Neues Fach"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          className="max-w-52"
        />
        <Button size="sm" onClick={add} disabled={!draft.trim()}>
          <PlusIcon size={14} /> Fach
        </Button>
      </div>
    </div>
  )
}

/* ------------------- WebUntis subject mapping (per profile) ------------------- */

// Select value for "ignore" (the stored value is '')
const IGNORE = '__ignore__'

// Only differing names need an entry: identical ones (LF07 = LF7 = lf07) and the
// WebUntis long name are matched automatically on import (src/lib/webuntis.js)
function WebuntisSubjectMap({ profile }) {
  const { setWebuntisSubject } = useStore()
  const labels = profileSubjectLabels(profile)
  const entries = Object.entries(profile.webuntisSubjects ?? {}).sort(([a], [b]) => a.localeCompare(b, 'de'))
  const [short, setShort] = useState('')
  const [label, setLabel] = useState('')
  // What the select shows: the last pick if it is still an option, else the first label
  const choice = label === IGNORE || labels.includes(label) ? label : (labels[0] ?? IGNORE)

  const add = () => {
    if (!short.trim()) return
    setWebuntisSubject(profile.id, short, choice === IGNORE ? '' : choice)
    setShort('')
  }

  // Options for one row: the profile's labels, a saved label that is no longer in
  // the profile (kept, marked), and "ignore"
  const options = (current) => (
    <>
      {current && !labels.some((l) => subjectKey(l) === subjectKey(current)) && (
        <option value={current}>{current} (nicht im Profil)</option>
      )}
      {labels.map((l) => (
        <option key={l} value={l}>
          {l}
        </option>
      ))}
      <option value={IGNORE}>ignorieren</option>
    </>
  )

  return (
    <Card>
      <CardHeader title="WebUntis-Fächer" />
      <div className="flex flex-col gap-2 p-4">
        <p className="text-meta text-ink-2">
          Gleich benannte Fächer (z. B. LF07) erkennt der Import selbst. Hier nur Abkürzungen eintragen (z. B. kom →
          Kommunikation) oder Fächer ignorieren, die nicht ins Berichtsheft gehören.
        </p>
        {entries.map(([key, value]) => (
          <div key={key} className="flex items-center gap-2">
            <span className="flex h-8 w-28 items-center truncate rounded-control border border-line bg-surface-2 px-2.5 text-body font-medium text-ink">
              {key}
            </span>
            <ArrowRightIcon size={14} className="shrink-0 text-ink-2" />
            <Select
              value={value === '' ? IGNORE : value}
              onChange={(e) => setWebuntisSubject(profile.id, key, e.target.value === IGNORE ? '' : e.target.value)}
              className="w-48"
              aria-label={`Zuordnung für ${key}`}
            >
              {options(value)}
            </Select>
            <IconButton label="Zuordnung entfernen" danger onClick={() => setWebuntisSubject(profile.id, key, null)}>
              <XIcon size={14} />
            </IconButton>
          </div>
        ))}
        <div className="mt-1 flex items-center gap-2">
          <div className="w-28 shrink-0">
            <Input
              value={short}
              placeholder="z. B. kom"
              onChange={(e) => setShort(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && add()}
              aria-label="Fach in WebUntis"
            />
          </div>
          <ArrowRightIcon size={14} className="shrink-0 text-ink-2" />
          <Select value={choice} onChange={(e) => setLabel(e.target.value)} className="w-48" aria-label="Fach im Profil">
            {options('')}
          </Select>
          <Button size="sm" onClick={add} disabled={!short.trim()}>
            <PlusIcon size={14} /> Zuordnen
          </Button>
        </div>
      </div>
    </Card>
  )
}

/* ------------------------------ Profile form ------------------------------ */

function ProfileForm({ profile, onDuplicate }) {
  const { data, updateProfile, deleteProfile } = useStore()
  const [armedId, setArmedId] = useState(null)
  const webuntisEnabled = data.settings.webuntis?.enabled === true

  const patch = (p) => updateProfile(profile.id, (old) => ({ ...old, ...p }))
  const patchWeekday = (key, p) =>
    updateProfile(profile.id, (old) => ({
      ...old,
      weekdays: { ...old.weekdays, [key]: { ...old.weekdays[key], ...p } },
    }))

  // Sources for "Fächer übernehmen von …": every school day with subjects —
  // from this and all other profiles, except the target day itself.
  const subjectSources = (targetKey) => {
    const sources = []
    for (const p of data.profiles) {
      for (const key of WEEKDAY_KEYS) {
        const day = p.weekdays[key]
        if (day?.type !== 'school' || !(day.subjects?.length > 0)) continue
        if (p.id === profile.id && key === targetKey) continue
        sources.push({ profileId: p.id, key, label: `${WEEKDAY_LABELS[key]} (${p.name})` })
      }
    }
    return sources
  }

  const copySubjects = (targetKey, value) => {
    const [profileId, key] = value.split('|')
    const source = data.profiles.find((p) => p.id === profileId)?.weekdays[key]
    if (source?.subjects?.length) patchWeekday(targetKey, { subjects: [...source.subjects] })
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="@container">
        <CardHeader title="Profil">
          <Button size="sm" variant="ghost" onClick={onDuplicate} title="Kopie dieses Profils anlegen, z. B. fürs nächste Halbjahr">
            <CopyIcon size={14} /> Duplizieren
          </Button>
          {/* Two steps: the first click arms, the second deletes; leaving the button disarms */}
          <Button
            size="sm"
            variant="danger"
            onClick={() => (armedId === profile.id ? deleteProfile(profile.id) : setArmedId(profile.id))}
            onBlur={() => setArmedId(null)}
          >
            <TrashIcon size={14} /> {armedId === profile.id ? 'Wirklich löschen?' : 'Löschen'}
          </Button>
        </CardHeader>
        <div className="flex flex-col gap-4 p-4">
          <Field label="Name des Profils">
            <Input value={profile.name} onChange={(e) => patch({ name: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3 @3xl:grid-cols-4">
            <Field label="Gültig von">
              <Input type="date" value={profile.validFrom} onChange={(e) => patch({ validFrom: e.target.value })} />
            </Field>
            <Field label="Gültig bis">
              <Input type="date" value={profile.validTo} onChange={(e) => patch({ validTo: e.target.value })} />
            </Field>
            <Field label="Bundesland" hint="steuert die Feiertage">
              <Select value={profile.state} onChange={(e) => patch({ state: e.target.value })} className="w-full">
                {STATES.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Leere Stichpunkte" hint="Startvorlage je Betriebstag">
              <Input
                type="number"
                min="1"
                max="10"
                value={profile.defaultBulletCount}
                onChange={(e) => patch({ defaultBulletCount: Math.max(1, Math.min(10, Number(e.target.value) || 1)) })}
              />
            </Field>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Wochentage" />
        {WEEKDAY_KEYS.map((key) => {
          const day = profile.weekdays[key] ?? { type: 'off', subjects: [] }
          const sources = day.type === 'school' ? subjectSources(key) : []
          return (
            <div key={key} className="flex flex-col gap-3 border-b border-line px-4 py-3 last:border-b-0">
              <div className="flex flex-wrap items-center gap-3">
                <span className={cx('w-24 text-body font-medium', day.type === 'off' ? 'text-ink-2' : 'text-ink')}>
                  {WEEKDAY_LABELS[key]}
                </span>
                <Segment
                  size="sm"
                  label={`${WEEKDAY_LABELS[key]}: Art`}
                  options={[
                    { value: 'work', label: 'Betrieb' },
                    { value: 'school', label: 'Schule' },
                    { value: 'off', label: 'Frei' },
                  ]}
                  value={day.type}
                  onChange={(type) => patchWeekday(key, { type })}
                />
                <span className="text-meta text-ink-2">
                  {day.type === 'work' && 'Block 1, Betriebliche Tätigkeiten'}
                  {day.type === 'school' && 'Block 3, Berufsschule'}
                  {day.type === 'off' && 'nicht im Bericht'}
                </span>
              </div>
              {day.type === 'school' && (
                <div className="flex flex-col gap-2 pl-0 @xl:pl-27">
                  <SubjectEditor subjects={day.subjects ?? []} onChange={(subjects) => patchWeekday(key, { subjects })} />
                  {sources.length > 0 && (
                    <Select
                      value=""
                      onChange={(e) => e.target.value && copySubjects(key, e.target.value)}
                      className="w-fit text-meta text-ink-2"
                      title="Fächerliste eines anderen Schultags in diesen Tag kopieren"
                      aria-label="Fächer übernehmen von"
                    >
                      <option value="">Fächer übernehmen von …</option>
                      {sources.map((s) => (
                        <option key={`${s.profileId}|${s.key}`} value={`${s.profileId}|${s.key}`}>
                          {s.label}
                        </option>
                      ))}
                    </Select>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </Card>

      {webuntisEnabled && <WebuntisSubjectMap profile={profile} />}
    </div>
  )
}

/* ------------------- Periods (vacation / school breaks) ------------------- */

function PeriodCard() {
  const { data, createPeriod, updatePeriod, deletePeriod } = useStore()

  return (
    <Card>
      <CardHeader title="Urlaub und Ferien">
        <Button size="sm" variant="ghost" onClick={createPeriod}>
          <PlusIcon size={14} /> Zeitraum
        </Button>
      </CardHeader>
      {data.periods.map((p) => (
        <div key={p.id} className="flex flex-col gap-1.5 border-b border-line px-4 py-3">
          <div className="flex items-center gap-1.5">
            <Select
              value={p.type}
              onChange={(e) => updatePeriod(p.id, { type: e.target.value })}
              className="flex-1"
              aria-label="Art des Zeitraums"
            >
              <option value="vacation">Urlaub</option>
              <option value="schoolBreak">Schulferien</option>
            </Select>
            <IconButton label="Zeitraum löschen" side="top-end" danger onClick={() => deletePeriod(p.id)}>
              <XIcon size={14} />
            </IconButton>
          </div>
          <Input
            value={p.label}
            placeholder="Bezeichnung (optional)"
            aria-label="Bezeichnung"
            onChange={(e) => updatePeriod(p.id, { label: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-1.5">
            <Input type="date" aria-label="Von" value={p.from} onChange={(e) => updatePeriod(p.id, { from: e.target.value })} />
            <Input type="date" aria-label="Bis" value={p.to} onChange={(e) => updatePeriod(p.id, { to: e.target.value })} />
          </div>
        </div>
      ))}
      <p className="px-4 py-3 text-meta text-ink-2">
        Urlaub setzt leere Tage im Zeitraum auf „Urlaub“, auch in bestehenden Wochen. Schulferien machen Schultage
        beim Anlegen neuer Wochen zu Betriebstagen.
      </p>
    </Card>
  )
}

/* --------------------------------- View --------------------------------- */

export default function Profiles() {
  const { data, createProfile, duplicateProfile, updateSettings } = useStore()
  const [activeId, setActiveId] = useState(data.profiles[0]?.id ?? null)
  const active = data.profiles.find((p) => p.id === activeId) ?? data.profiles[0]

  // Warnings about validity ranges (overlaps, gaps, missing dates)
  const warnings = useMemo(() => checkProfiles(data.profiles), [data.profiles])

  const addProfile = () => {
    const p = createProfile()
    setActiveId(p.id)
  }

  const duplicate = () => {
    const copy = duplicateProfile(active.id)
    if (copy) setActiveId(copy.id)
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center gap-3 px-6 pb-4 pt-5">
        <div className="mr-auto">
          <h1 className="font-display text-page font-medium text-ink">Profile</h1>
          <p className="text-meta text-ink-2">Ein Profil pro Halbjahr. Die App wählt anhand des Wochendatums das passende.</p>
        </div>
        <Button variant="primary" onClick={addProfile}>
          <PlusIcon size={16} /> Neues Profil
        </Button>
      </header>

      <div className="@container min-h-0 flex-1 overflow-y-auto px-6 pb-6">
        {warnings.length > 0 && (
          <Notice className="mb-4 max-w-[1100px]">
            <ul className="flex flex-col gap-1">
              {warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </Notice>
        )}

        {/* Wide: list + dates + periods on the left, the form spanning the
            right. Stacked (narrow window): list, then the form, then the rest —
            so the profile being edited never ends up below all periods. */}
        <div className="grid max-w-[1100px] gap-4 @4xl:grid-cols-[280px_minmax(0,1fr)] @4xl:items-start">
          <div className="flex flex-col gap-4 @4xl:col-start-1 @4xl:row-start-1">
            <Card className="overflow-hidden">
              <CardHeader title="Halbjahre" />
              {data.profiles.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  aria-current={active?.id === p.id ? 'true' : undefined}
                  onClick={() => setActiveId(p.id)}
                  className={cx(
                    'flex w-full flex-col gap-1.5 border-b border-line px-4 py-3 text-left transition-colors duration-150 last:border-b-0',
                    active?.id === p.id ? 'bg-surface-2' : 'hover:bg-surface-2/60'
                  )}
                >
                  <span className="text-body font-medium text-ink">{p.name}</span>
                  <span className="text-meta tabular-nums text-ink-2">
                    {p.validFrom ? formatDE(p.validFrom) : 'offen'} bis {p.validTo ? formatDE(p.validTo) : 'offen'}
                  </span>
                  <span className="flex flex-wrap gap-1">
                    {WEEKDAY_KEYS.map((k) => {
                      const type = p.weekdays[k]?.type ?? 'off'
                      if (type === 'off') return null
                      return (
                        <span
                          key={k}
                          className="inline-flex h-5 items-center gap-1 rounded-chip border border-line px-1.5 text-[11px] text-ink-2"
                        >
                          {WEEKDAY_LABELS[k].slice(0, 2)}
                          <span className="font-semibold text-ink">{TYPE_LETTER[type]}</span>
                        </span>
                      )
                    })}
                  </span>
                </button>
              ))}
            </Card>
          </div>

          <div className="min-w-0 @4xl:col-start-2 @4xl:row-span-2 @4xl:row-start-1">
            {active ? (
              <ProfileForm key={active.id} profile={active} onDuplicate={duplicate} />
            ) : (
              <Card className="p-5 text-body text-ink-2">Noch kein Profil. Leg über „Neues Profil“ eines an.</Card>
            )}
          </div>

          <div className="flex flex-col gap-4 @4xl:col-start-1 @4xl:row-start-2">
            <Card>
              <CardHeader title="Ausbildung" />
              <div className="flex flex-col gap-3 p-4">
                <Field label="Beginn">
                  <Input
                    type="date"
                    value={data.settings.trainingStart}
                    onChange={(e) => updateSettings({ trainingStart: e.target.value })}
                  />
                </Field>
                <Field label="Ende">
                  <Input type="date" value={data.settings.trainingEnd} onChange={(e) => updateSettings({ trainingEnd: e.target.value })} />
                </Field>
                <p className="text-meta text-ink-2">Für die Ausbildungswoche, die fälligen Wochen und das Jahresband in der Übersicht.</p>
              </div>
            </Card>

            <PeriodCard />
          </div>
        </div>
      </div>
    </div>
  )
}
