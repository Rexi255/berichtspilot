// Setup wizard ("Einrichtung"): opens on a fresh install (settings.setupDone ===
// false) and from Settings → Verhalten. Walks through training dates, the
// current half-year profile, WebUntis and the start behavior; the logic
// (suggestions, checks, applying) is in src/lib/setup.js.
import { useState } from 'react'
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckIcon,
  DownloadSimpleIcon,
  GraduationCapIcon,
  CalendarBlankIcon,
  PlugsConnectedIcon,
  SlidersHorizontalIcon,
  SparkleIcon,
  ShieldCheckIcon,
} from '@phosphor-icons/react'
import { useStore } from '../store.jsx'
import { Button, Input, Select, Segment, Panel, Field, Switch, cx } from '../ui/basics.jsx'
import { showToast } from '../ui/toast.jsx'
import Logo from '../ui/Logo.jsx'
import { SubjectEditor } from './Profiles.jsx'
import { WEEKDAY_KEYS, WEEKDAY_LABELS, formatDE, toISO } from '../lib/dates.js'
import { STATES } from '../lib/holidays.js'
import { SETUP_STEPS, setupDraft, setupErrors, trainingEndAfter } from '../lib/setup.js'
import { parseWebuntisAddress } from '../lib/webuntis.js'

// Steps with a progress dot (welcome has none)
const STEP_META = {
  training: { title: 'Deine Ausbildung', icon: GraduationCapIcon },
  halfYear: { title: 'Aktuelles Schulhalbjahr', icon: CalendarBlankIcon },
  webuntis: { title: 'WebUntis', icon: PlugsConnectedIcon },
  behavior: { title: 'Beim Start', icon: SlidersHorizontalIcon },
  summary: { title: 'Alles bereit', icon: CheckIcon },
}
const DOTS = SETUP_STEPS.filter((s) => s !== 'welcome')

const DURATIONS = [
  { months: 24, label: '2 Jahre' },
  { months: 30, label: '2,5 Jahre' },
  { months: 36, label: '3 Jahre' },
  { months: 42, label: '3,5 Jahre' },
]

const stateName = (code) => STATES.find((s) => s.code === code)?.name ?? code
const dateOrDash = (iso) => (iso ? formatDE(iso) : '—')

/* ------------------------------- Steps ------------------------------- */

function WelcomeStep({ fresh, onStart, onImport, onSkip }) {
  return (
    <div className="flex flex-col items-center py-6 text-center">
      <Logo size={52} className="mb-4" />
      <h1 className="text-[22px] font-semibold tracking-tight">
        {fresh ? 'Willkommen bei Berichtspilot' : 'Einrichtung erneut durchlaufen'}
      </h1>
      <p className="mt-3 max-w-md text-[13.5px] leading-relaxed text-ink-2">
        In ein paar Schritten ist alles eingerichtet: dein Ausbildungszeitraum, das aktuelle
        Schulhalbjahr mit Schul- und Betriebstagen und — wenn du magst — WebUntis.
      </p>
      <p className="mt-2 max-w-md text-[12.5px] text-ink-3">
        Alles lässt sich später unter Profile und Einstellungen ändern.
      </p>
      <div className="mt-7 flex flex-col items-center gap-2">
        <Button variant="primary" onClick={onStart} className="min-w-56">
          <SparkleIcon size={15} /> Einrichtung starten
        </Button>
        {fresh && (
          <Button onClick={onImport} className="min-w-56" title="Export von einem anderen Gerät übernehmen">
            <DownloadSimpleIcon size={15} /> Vorhandene Daten importieren
          </Button>
        )}
        <Button variant="ghost" onClick={onSkip} className="min-w-56">
          {fresh ? 'Überspringen' : 'Abbrechen'}
        </Button>
      </div>
    </div>
  )
}

function TrainingStep({ answers, set }) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-[13px] text-ink-2">
        Mit Beginn und Ende zeigt die Übersicht deinen Fortschritt und erkennt fehlende Wochen.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Ausbildungsbeginn">
          <Input type="date" value={answers.trainingStart} onChange={(e) => set({ trainingStart: e.target.value })} />
        </Field>
        <Field label="Ausbildungsende">
          <Input type="date" value={answers.trainingEnd} onChange={(e) => set({ trainingEnd: e.target.value })} />
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-[12px] text-ink-3">Dauer:</span>
        {DURATIONS.map((d) => (
          <Button
            key={d.months}
            size="sm"
            disabled={!answers.trainingStart}
            onClick={() => set({ trainingEnd: trainingEndAfter(answers.trainingStart, d.months) })}
            title={answers.trainingStart ? 'Ende aus dem Beginn berechnen' : 'Erst den Beginn eintragen'}
          >
            {d.label}
          </Button>
        ))}
      </div>
      <Field label="Bundesland" hint="Bestimmt die Feiertage — sie werden automatisch eingetragen.">
        <Select value={answers.state} onChange={(e) => set({ state: e.target.value })}>
          {STATES.map((s) => (
            <option key={s.code} value={s.code}>
              {s.name}
            </option>
          ))}
        </Select>
      </Field>
    </div>
  )
}

function HalfYearStep({ answers, set }) {
  const profile = answers.profile
  const patch = (p) => set({ profile: { ...profile, ...p } })
  const patchDay = (key, p) => patch({ weekdays: { ...profile.weekdays, [key]: { ...profile.weekdays[key], ...p } } })

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[13px] text-ink-2">
        Welche Tage bist du in der Schule, welche im Betrieb? Daraus entstehen die Tage jeder neuen
        Woche. Das nächste Halbjahr legst du später unter Profile an („Duplizieren“).
      </p>
      <Field label="Name">
        <Input value={profile.name} onChange={(e) => patch({ name: e.target.value })} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Gültig von">
          <Input type="date" value={profile.validFrom} onChange={(e) => patch({ validFrom: e.target.value })} />
        </Field>
        <Field label="Gültig bis">
          <Input type="date" value={profile.validTo} onChange={(e) => patch({ validTo: e.target.value })} />
        </Field>
      </div>
      <div className="flex flex-col gap-1.5">
        {WEEKDAY_KEYS.map((key) => {
          const day = profile.weekdays[key] ?? { type: 'off', subjects: [] }
          return (
            <div
              key={key}
              className={cx('rounded-lg border border-white/[0.06] bg-inset/30 px-3 py-2', day.type === 'off' && 'opacity-70')}
            >
              <div className="flex items-center gap-3">
                <span className="w-24 text-[13px] font-medium">{WEEKDAY_LABELS[key]}</span>
                <Segment
                  size="sm"
                  options={[
                    { value: 'work', label: 'Betrieb' },
                    { value: 'school', label: 'Schule' },
                    { value: 'off', label: 'Frei' },
                  ]}
                  value={day.type}
                  onChange={(type) => patchDay(key, { type })}
                />
                {day.type === 'school' && !(day.subjects?.length > 0) && (
                  <span className="text-[11.5px] text-ink-3">Fächer eintragen (oder später ergänzen)</span>
                )}
              </div>
              {day.type === 'school' && (
                <SubjectEditor subjects={day.subjects ?? []} onChange={(subjects) => patchDay(key, { subjects })} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function WebuntisStep({ answers, set }) {
  const parsed = answers.webuntisAddress.trim() ? parseWebuntisAddress(answers.webuntisAddress) : null
  return (
    <div className="flex flex-col gap-4">
      <p className="text-[13px] text-ink-2">
        Nutzt deine Berufsschule WebUntis, kann Berichtspilot Schultage, Fächer und Lehrstoff einer
        Woche daraus übernehmen. Ohne WebUntis funktioniert alles genauso — nur von Hand.
      </p>
      <Segment
        options={[
          { value: true, label: 'Mit WebUntis' },
          { value: false, label: 'Ohne WebUntis' },
        ]}
        value={answers.webuntisEnabled}
        onChange={(webuntisEnabled) => set({ webuntisEnabled })}
      />
      {answers.webuntisEnabled && (
        <>
          <Field
            label="Adresse deiner WebUntis-Seite"
            hint="Öffne die WebUntis-Anmeldeseite deiner Schule im Browser und kopiere die Adresse hierher."
          >
            <Input
              value={answers.webuntisAddress}
              onChange={(e) => set({ webuntisAddress: e.target.value })}
              placeholder="https://schulname.webuntis.com/WebUntis/?school=schulname"
              spellCheck={false}
            />
          </Field>
          {parsed?.ok && (
            <p className="text-[12px] text-done">
              Erkannt: Server {parsed.host}
              {parsed.school ? ` · Schule „${parsed.school}“` : ''}
            </p>
          )}
          <p className="flex items-start gap-1.5 text-[11.5px] text-ink-3">
            <ShieldCheckIcon size={14} className="mt-px shrink-0" />
            <span>
              Angemeldet wird erst, wenn du im Editor „Aus WebUntis füllen“ nutzt — in einem eigenen
              Fenster direkt bei deiner Schule. Berichtspilot sieht dein Passwort nie.
            </span>
          </p>
        </>
      )}
    </div>
  )
}

function BehaviorStep({ answers, set }) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <Switch
          checked={answers.autoCreateWeek}
          onChange={(autoCreateWeek) => set({ autoCreateWeek })}
          label="Aktuelle Woche beim Start anlegen"
        />
        <p className="mt-1.5 text-[12.5px] text-ink-3">
          Fehlt die laufende Woche, legt die App sie Montag bis Freitag beim Start automatisch an — mit
          deinen Schul- und Betriebstagen und den Feiertagen.
        </p>
      </div>
      <div>
        <Switch
          checked={answers.updateCheck}
          onChange={(updateCheck) => set({ updateCheck })}
          label="Beim Start nach Updates suchen"
        />
        <p className="mt-1.5 text-[12.5px] text-ink-3">
          Fragt bei jedem Start einmal bei GitHub nach einer neuen Version — dabei wird nur die
          App-Version übertragen, keine Berichtsdaten. Installiert wird nur, wenn du darauf klickst.
        </p>
      </div>
    </div>
  )
}

function SummaryRow({ label, children }) {
  return (
    <div className="flex gap-3 border-b border-white/[0.05] py-2 last:border-b-0">
      <div className="w-36 shrink-0 text-[12.5px] text-ink-3">{label}</div>
      <div className="min-w-0 flex-1 text-[13px] text-ink">{children}</div>
    </div>
  )
}

function SummaryStep({ answers }) {
  const { profile } = answers
  const daysOf = (type) => WEEKDAY_KEYS.filter((k) => profile.weekdays[k]?.type === type)
  const schoolDays = daysOf('school')
  const workDays = daysOf('work')
  const address = answers.webuntisEnabled ? parseWebuntisAddress(answers.webuntisAddress) : null
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[13px] text-ink-2">So wird Berichtspilot eingerichtet:</p>
      <div className="rounded-lg border border-white/[0.06] bg-inset/30 px-4 py-1">
        <SummaryRow label="Ausbildung">
          {answers.trainingStart || answers.trainingEnd
            ? `${dateOrDash(answers.trainingStart)} – ${dateOrDash(answers.trainingEnd)}`
            : 'nicht angegeben'}
        </SummaryRow>
        <SummaryRow label="Bundesland">{stateName(answers.state)}</SummaryRow>
        <SummaryRow label="Halbjahr">
          {profile.name} ({dateOrDash(profile.validFrom)} – {dateOrDash(profile.validTo)})
        </SummaryRow>
        <SummaryRow label="Schultage">
          {schoolDays.length === 0
            ? 'keine'
            : schoolDays.map((k) => {
                const subjects = (profile.weekdays[k].subjects ?? []).filter((s) => s.trim())
                return (
                  <div key={k}>
                    {WEEKDAY_LABELS[k]}
                    {subjects.length > 0 && <span className="text-ink-3"> — {subjects.join(', ')}</span>}
                  </div>
                )
              })}
        </SummaryRow>
        <SummaryRow label="Betriebstage">
          {workDays.length === 0 ? 'keine' : workDays.map((k) => WEEKDAY_LABELS[k]).join(', ')}
        </SummaryRow>
        <SummaryRow label="WebUntis">
          {address?.ok ? `${address.host}${address.school ? ` · ${address.school}` : ''}` : 'aus'}
        </SummaryRow>
        <SummaryRow label="Beim Start">
          {[
            answers.autoCreateWeek ? 'aktuelle Woche anlegen' : null,
            answers.updateCheck ? 'nach Updates suchen' : null,
          ]
            .filter(Boolean)
            .join(' · ') || '—'}
        </SummaryRow>
      </div>
    </div>
  )
}

/* ------------------------------- Wizard ------------------------------- */

const STEP_BODY = {
  training: TrainingStep,
  halfYear: HalfYearStep,
  webuntis: WebuntisStep,
  behavior: BehaviorStep,
  summary: SummaryStep,
}

export default function SetupWizard() {
  const { data, completeSetup, skipSetup, importData } = useStore()
  const fresh = data.settings.setupDone === false
  const [answers, setAnswers] = useState(() => setupDraft(data, toISO(new Date())))
  const [step, setStep] = useState('welcome')
  const [errors, setErrors] = useState([])
  const index = SETUP_STEPS.indexOf(step)
  const set = (patch) => {
    setAnswers((a) => ({ ...a, ...patch }))
    setErrors([])
  }

  const go = (target) => {
    setErrors([])
    setStep(target)
  }
  const next = () => {
    const problems = setupErrors(step, answers)
    if (problems.length > 0) return setErrors(problems)
    if (step === 'summary') return completeSetup(answers)
    go(SETUP_STEPS[index + 1])
  }

  const importFromWizard = async () => {
    const res = await importData()
    if (res.ok) {
      skipSetup()
      showToast('Daten importiert')
    } else if (!res.canceled) {
      showToast(res.error ?? 'Import fehlgeschlagen', { kind: 'error', duration: 5000 })
    }
  }

  const meta = STEP_META[step]
  const Body = STEP_BODY[step]

  return (
    <main className="aurora min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex min-h-full max-w-2xl flex-col justify-center px-6 py-8">
        {step === 'welcome' ? (
          <Panel className="px-8 py-6">
            <WelcomeStep fresh={fresh} onStart={() => go('training')} onImport={importFromWizard} onSkip={skipSetup} />
          </Panel>
        ) : (
          <>
            {/* progress: one dot per step, the current one with its title */}
            <ol className="mb-4 flex items-center gap-2" aria-label="Fortschritt">
              {DOTS.map((s, i) => {
                const done = i < DOTS.indexOf(step)
                const current = s === step
                return (
                  <li key={s} className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => done && go(s)}
                      disabled={!done}
                      aria-current={current ? 'step' : undefined}
                      title={STEP_META[s].title}
                      className={cx(
                        'grid h-6 w-6 place-items-center rounded-full text-[11px] font-semibold transition-colors duration-150',
                        current && 'bg-accent text-inset',
                        done && 'bg-accent/20 text-accent-light hover:bg-accent/30',
                        !current && !done && 'bg-white/[0.06] text-ink-3'
                      )}
                    >
                      {done ? <CheckIcon size={12} weight="bold" /> : i + 1}
                    </button>
                    {i < DOTS.length - 1 && <span className={cx('h-px w-6', done ? 'bg-accent/40' : 'bg-white/[0.08]')} />}
                  </li>
                )
              })}
            </ol>

            <Panel className="flex flex-col">
              <div className="flex items-center gap-2 border-b border-white/[0.05] px-6 py-4">
                <meta.icon size={18} className="text-accent" />
                <h2 className="text-[16px] font-semibold">{meta.title}</h2>
                {step === 'webuntis' && <span className="text-[12px] text-ink-3">(optional)</span>}
              </div>
              <div className="px-6 py-5">{Body && <Body answers={answers} set={set} />}</div>
              {errors.length > 0 && (
                <div className="mx-6 mb-4 rounded-lg border border-sick/30 bg-sick/[0.07] px-3 py-2 text-[12.5px] text-sick" role="alert">
                  {errors.map((e) => (
                    <div key={e}>{e}</div>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-2 border-t border-white/[0.05] px-6 py-3">
                <Button variant="ghost" size="sm" onClick={skipSetup}>
                  {fresh ? 'Überspringen' : 'Abbrechen'}
                </Button>
                <div className="flex-1" />
                <Button size="sm" onClick={() => go(SETUP_STEPS[index - 1])}>
                  <ArrowLeftIcon size={14} /> Zurück
                </Button>
                <Button variant="primary" size="sm" onClick={next}>
                  {step === 'summary' ? (
                    <>
                      <CheckIcon size={14} weight="bold" /> Einrichtung abschließen
                    </>
                  ) : (
                    <>
                      Weiter <ArrowRightIcon size={14} />
                    </>
                  )}
                </Button>
              </div>
            </Panel>
          </>
        )}
      </div>
    </main>
  )
}
