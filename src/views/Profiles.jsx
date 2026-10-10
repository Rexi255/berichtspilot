// Profile management: half-year profiles (weekdays, subjects, federal state),
// periods (vacation/school breaks) + global training dates.
import { useMemo, useState } from 'react'
import {
  PlusIcon,
  XIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  TrashIcon,
  CalendarBlankIcon,
  CopyIcon,
  WarningIcon,
  SunIcon,
} from '@phosphor-icons/react'
import { useStore } from '../store.jsx'
import { Button, IconButton, Input, Select, Segment, Panel, Field, SectionTitle, Pill, cx } from '../ui/basics.jsx'
import { WEEKDAY_KEYS, WEEKDAY_LABELS, formatDE } from '../lib/dates.js'
import { STATES } from '../lib/holidays.js'
import { checkProfiles } from '../lib/model.js'

const move = (arr, from, to) => {
  if (to < 0 || to >= arr.length) return arr
  const copy = [...arr]
  const [el] = copy.splice(from, 1)
  copy.splice(to, 0, el)
  return copy
}

/* ----------------------- Subjects of a school day ----------------------- */

function SubjectEditor({ subjects, onChange }) {
  const [draft, setDraft] = useState('')

  const add = () => {
    const label = draft.trim()
    if (!label) return
    onChange([...subjects, label])
    setDraft('')
  }

  return (
    <div className="mt-2 flex flex-col gap-1">
      {subjects.map((label, i) => (
        <div key={`${label}-${i}`} className="group/subject flex items-center gap-1">
          <span className="flex h-7 min-w-24 items-center rounded-md border border-accent/15 bg-accent/[0.07] px-2.5 text-[12.5px] font-medium text-accent-light">
            {label}
          </span>
          <div className="flex opacity-0 transition-opacity duration-150 group-hover/subject:opacity-100">
            <IconButton label="Nach oben" disabled={i === 0} onClick={() => onChange(move(subjects, i, i - 1))}>
              <ArrowUpIcon size={13} />
            </IconButton>
            <IconButton label="Nach unten" disabled={i === subjects.length - 1} onClick={() => onChange(move(subjects, i, i + 1))}>
              <ArrowDownIcon size={13} />
            </IconButton>
            <IconButton label="Fach entfernen" danger onClick={() => onChange(subjects.filter((_, j) => j !== i))}>
              <XIcon size={13} />
            </IconButton>
          </div>
        </div>
      ))}
      <div className="mt-1 flex items-center gap-1.5">
        <Input
          value={draft}
          placeholder="z. B. LF07 oder Englisch"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          className="h-8 max-w-52"
        />
        <Button size="sm" onClick={add} disabled={!draft.trim()}>
          <PlusIcon size={13} weight="bold" /> Fach
        </Button>
      </div>
    </div>
  )
}

/* ------------------------------ Profile form ------------------------------ */

function ProfileForm({ profile, onDuplicate }) {
  const { data, updateProfile, deleteProfile } = useStore()
  const [confirmDelete, setConfirmDelete] = useState(false)

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
        sources.push({ profileId: p.id, key, label: `${WEEKDAY_LABELS[key]} — ${p.name}` })
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
    <div className="flex flex-col gap-5">
      <Panel className="flex flex-col gap-4 p-5">
        <div className="flex items-end gap-3">
          <Field label="Name des Profils" className="flex-1">
            <Input value={profile.name} onChange={(e) => patch({ name: e.target.value })} />
          </Field>
          <Button variant="ghost" onClick={onDuplicate} title="Kopie dieses Profils anlegen (z. B. fürs nächste Halbjahr)">
            <CopyIcon size={15} /> Duplizieren
          </Button>
          {confirmDelete ? (
            <Button variant="danger" onClick={() => deleteProfile(profile.id)} onBlur={() => setConfirmDelete(false)}>
              Wirklich löschen?
            </Button>
          ) : (
            <Button variant="ghost" onClick={() => setConfirmDelete(true)}>
              <TrashIcon size={15} /> Löschen
            </Button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="Gültig von">
            <Input type="date" value={profile.validFrom} onChange={(e) => patch({ validFrom: e.target.value })} />
          </Field>
          <Field label="Gültig bis">
            <Input type="date" value={profile.validTo} onChange={(e) => patch({ validTo: e.target.value })} />
          </Field>
          <Field label="Bundesland" hint="steuert die Feiertage">
            <Select value={profile.state} onChange={(e) => patch({ state: e.target.value })}>
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
      </Panel>

      <div>
        <SectionTitle className="mb-2 px-1">Wochentage</SectionTitle>
        <div className="flex flex-col gap-1.5">
          {WEEKDAY_KEYS.map((key) => {
            const day = profile.weekdays[key] ?? { type: 'off', subjects: [] }
            return (
              <Panel key={key} className={cx('shrink-0 px-4 py-3', day.type === 'off' && 'opacity-70')}>
                <div className="flex items-center gap-3">
                  <span className="w-24 text-[13.5px] font-medium">{WEEKDAY_LABELS[key]}</span>
                  <Segment
                    size="sm"
                    options={[
                      { value: 'work', label: 'Betrieb' },
                      { value: 'school', label: 'Schule' },
                      { value: 'off', label: 'Frei' },
                    ]}
                    value={day.type}
                    onChange={(type) => patchWeekday(key, { type })}
                  />
                  <span className="text-[12px] text-ink-3">
                    {day.type === 'work' && '→ Block „Betriebliche Tätigkeiten"'}
                    {day.type === 'school' && '→ Block „Berufsschule"'}
                    {day.type === 'off' && 'wird ignoriert'}
                  </span>
                </div>
                {day.type === 'school' && (
                  <>
                    <SubjectEditor subjects={day.subjects ?? []} onChange={(subjects) => patchWeekday(key, { subjects })} />
                    {subjectSources(key).length > 0 && (
                      <Select
                        value=""
                        onChange={(e) => e.target.value && copySubjects(key, e.target.value)}
                        className="mt-2 h-7 text-[11.5px] text-ink-3"
                        title="Fächerliste eines anderen Schultags in diesen Tag kopieren"
                      >
                        <option value="">Fächer übernehmen von …</option>
                        {subjectSources(key).map((s) => (
                          <option key={`${s.profileId}|${s.key}`} value={`${s.profileId}|${s.key}`}>
                            {s.label}
                          </option>
                        ))}
                      </Select>
                    )}
                  </>
                )}
              </Panel>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/* ------------------- Periods (vacation / school breaks) ------------------- */

function PeriodPanel() {
  const { data, createPeriod, updatePeriod, deletePeriod } = useStore()

  return (
    <Panel className="flex shrink-0 flex-col gap-3 p-4">
      <SectionTitle className="flex items-center gap-1.5">
        <SunIcon size={13} /> Zeiträume (Urlaub / Ferien)
      </SectionTitle>
      {data.periods.map((p) => (
        <div key={p.id} className="flex flex-col gap-1.5 rounded-lg border border-white/[0.06] bg-inset/40 p-2.5">
          <div className="flex items-center gap-1.5">
            <Select
              value={p.type}
              onChange={(e) => updatePeriod(p.id, { type: e.target.value })}
              className="h-8 flex-1 text-[12.5px]"
            >
              <option value="vacation">Urlaub</option>
              <option value="schoolBreak">Schulferien</option>
            </Select>
            <IconButton label="Zeitraum löschen" danger onClick={() => deletePeriod(p.id)}>
              <XIcon size={13} />
            </IconButton>
          </div>
          <Input
            value={p.label}
            placeholder="Bezeichnung (optional)"
            onChange={(e) => updatePeriod(p.id, { label: e.target.value })}
            className="h-8 text-[12.5px]"
          />
          <div className="grid grid-cols-2 gap-1.5">
            <Input
              type="date"
              value={p.from}
              onChange={(e) => updatePeriod(p.id, { from: e.target.value })}
              className="h-8 text-[12px]"
            />
            <Input
              type="date"
              value={p.to}
              onChange={(e) => updatePeriod(p.id, { to: e.target.value })}
              className="h-8 text-[12px]"
            />
          </div>
        </div>
      ))}
      <Button size="sm" onClick={createPeriod} className="w-fit">
        <PlusIcon size={13} weight="bold" /> Zeitraum
      </Button>
      <p className="text-[11.5px] text-ink-3">
        Urlaub setzt leere Tage im Zeitraum automatisch auf „Urlaub" (auch in bestehenden Wochen).
        Schulferien machen Schultage beim Anlegen neuer Wochen zu Betriebstagen.
      </p>
    </Panel>
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
      <div className="flex items-end justify-between px-8 pb-5 pt-7">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight">Profile</h1>
          <p className="mt-1 text-[13px] text-ink-2">
            Ein Profil pro Halbjahr — die App wählt anhand des Wochendatums automatisch das passende.
          </p>
        </div>
        <Button variant="primary" onClick={addProfile}>
          <PlusIcon size={15} weight="bold" /> Neues Profil
        </Button>
      </div>

      {warnings.length > 0 && (
        <div className="px-8 pb-4">
          <Panel className="border-draft/25 bg-draft/[0.05] px-4 py-3">
            <div className="flex items-start gap-2.5">
              <WarningIcon size={16} className="mt-0.5 shrink-0 text-draft" />
              <div className="flex min-w-0 flex-col gap-1">
                {warnings.map((w, i) => (
                  <span key={i} className="text-[12.5px] leading-snug text-ink-2">
                    {w}
                  </span>
                ))}
              </div>
            </div>
          </Panel>
        </div>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-[280px_1fr] gap-5 px-8 pb-8">
        {/* list */}
        <div className="flex min-h-0 flex-col gap-3 overflow-y-auto pr-1">
          <div className="flex shrink-0 flex-col gap-1.5">
            {data.profiles.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setActiveId(p.id)}
                className={cx(
                  'flex flex-col gap-1 rounded-xl border px-4 py-3 text-left transition-colors duration-150',
                  active?.id === p.id
                    ? 'border-accent/25 bg-accent/[0.07]'
                    : 'border-white/[0.05] bg-surface/60 hover:border-white/[0.1] hover:bg-surface-2/70'
                )}
              >
                <span className="text-[13.5px] font-medium">{p.name}</span>
                <span className="text-[11.5px] text-ink-3 tabular-nums">
                  {p.validFrom ? formatDE(p.validFrom) : '—'} bis {p.validTo ? formatDE(p.validTo) : '—'}
                </span>
                <div className="mt-0.5 flex gap-1">
                  {WEEKDAY_KEYS.map((k) => {
                    const type = p.weekdays[k]?.type ?? 'off'
                    if (type === 'off') return null
                    return (
                      <Pill key={k} dot={false} color={type === 'school' ? 'accent' : 'neutral'} className="px-1.5">
                        {WEEKDAY_LABELS[k].slice(0, 2)}
                      </Pill>
                    )
                  })}
                </div>
              </button>
            ))}
          </div>

          {/* training dates (app-wide) */}
          <Panel className="flex shrink-0 flex-col gap-3 p-4">
            <SectionTitle className="flex items-center gap-1.5">
              <CalendarBlankIcon size={13} /> Ausbildung (optional)
            </SectionTitle>
            <Field label="Beginn">
              <Input
                type="date"
                value={data.settings.trainingStart}
                onChange={(e) => updateSettings({ trainingStart: e.target.value })}
              />
            </Field>
            <Field label="Ende">
              <Input
                type="date"
                value={data.settings.trainingEnd}
                onChange={(e) => updateSettings({ trainingEnd: e.target.value })}
              />
            </Field>
            <p className="text-[11.5px] text-ink-3">
              Aktiviert in der Übersicht die Anzeige „Woche X von ca. Y".
            </p>
          </Panel>

          {/* vacation / school breaks — affect status or day type of new weeks */}
          <PeriodPanel />
        </div>

        {/* form */}
        <div className="min-h-0 overflow-y-auto pr-1">
          {active ? (
            <ProfileForm key={active.id} profile={active} onDuplicate={duplicate} />
          ) : (
            <Panel className="grid h-40 place-items-center text-[13px] text-ink-3">
              Kein Profil vorhanden — leg eines an.
            </Panel>
          )}
        </div>
      </div>
    </div>
  )
}
