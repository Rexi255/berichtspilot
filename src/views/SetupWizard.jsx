// Setup wizard ("Einrichtung"): opens on a fresh install (settings.setupDone ===
// false) and from Settings → Verhalten. Walks through training dates, the
// current half-year profile, WebUntis and the start behavior; the logic
// (suggestions, checks, applying) is in src/lib/setup.js. One card, rows
// separated by lines, progress as quiet segments (E-032).
import { useState } from 'react'
import { ArrowLeftIcon, ArrowRightIcon, CheckIcon, DownloadSimpleIcon, ShieldCheckIcon, WarningIcon } from '@phosphor-icons/react'
import { useStore } from '../store.jsx'
import { Button, Card, Input, Select, Segment, Field, Switch, cx } from '../ui/basics.jsx'
import { showToast } from '../ui/toast.jsx'
import Logo from '../ui/Logo.jsx'
import { SubjectEditor } from './Profiles.jsx'
import { WEEKDAY_KEYS, WEEKDAY_LABELS, formatDE, toISO } from '../lib/dates.js'
import { STATES } from '../lib/holidays.js'
import { SETUP_STEPS, setupDraft, setupErrors, trainingEndAfter } from '../lib/setup.js'
import { ignoredRange, ignoredRangeLabel } from '../lib/overview.js'
import { parseWebuntisAddress } from '../lib/webuntis.js'

// The steps after the welcome screen, each one a segment of the progress bar
const STEP_TITLES = {
  training: 'Deine Ausbildung',
  halfYear: 'Aktuelles Schulhalbjahr',
  webuntis: 'WebUntis',
  behavior: 'Beim Start',
  summary: 'Alles bereit',
}
const STEPS = SETUP_STEPS.filter((s) => s !== 'welcome')

const DURATIONS = [
  { months: 24, label: '2 Jahre' },
  { months: 30, label: '2,5 Jahre' },
  { months: 36, label: '3 Jahre' },
  { months: 42, label: '3,5 Jahre' },
]

const stateName = (code) => STATES.find((s) => s.code === code)?.name ?? code
const dateOrOpen = (iso) => (iso ? formatDE(iso) : 'offen')

/* ------------------------------- Steps ------------------------------- */

function WelcomeStep({ fresh, onStart, onImport, onSkip }) {
  return (
    <div className="flex flex-col items-center px-8 py-10 text-center">
      <Logo size={48} className="mb-4" />
      <h1 className="font-display text-page font-medium text-ink">
        {fresh ? 'Willkommen bei Berichtspilot' : 'Einrichtung erneut durchlaufen'}
      </h1>
      <p className="mt-3 max-w-md text-body text-ink-2">
        In ein paar Schritten ist alles eingerichtet: dein Ausbildungszeitraum, das aktuelle Schulhalbjahr mit
        Schul- und Betriebstagen und, wenn du magst, WebUntis. Alles lässt sich später unter Profile und
        Einstellungen ändern.
      </p>
      <div className="mt-7 flex flex-col items-center gap-2">
        <Button variant="primary" onClick={onStart} className="min-w-56">
          Einrichtung starten <ArrowRightIcon size={16} />
        </Button>
        {fresh && (
          <Button onClick={onImport} className="min-w-56" title="Export von einem anderen Gerät übernehmen">
            <DownloadSimpleIcon size={16} /> Vorhandene Daten importieren
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
      <p className="text-body text-ink-2">
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
        <span className="mr-1 text-meta text-ink-2">Dauer</span>
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
      <Field label="Bundesland" hint="Bestimmt die Feiertage, sie werden automatisch eingetragen.">
        <Select value={answers.state} onChange={(e) => set({ state: e.target.value })} className="w-full">
          {STATES.map((s) => (
            <option key={s.code} value={s.code}>
              {s.name}
            </option>
          ))}
        </Select>
      </Field>
      <IgnoreEarlier answers={answers} set={set} />
    </div>
  )
}

// Started mid-training: the weeks before Berichtspilot need no report
function IgnoreEarlier({ answers, set }) {
  const range = answers.ignoreEarlier
    ? ignoredRange({ settings: { trainingStart: answers.trainingStart, ignoredUntil: answers.ignoredUntil }, weeks: [] })
    : null
  return (
    <div className="flex flex-col gap-3 border-t border-line pt-4">
      <div>
        <Switch
          checked={answers.ignoreEarlier}
          onChange={(ignoreEarlier) => set({ ignoreEarlier })}
          label="Ich steige mitten in der Ausbildung ein"
        />
        <p className="mt-1 text-meta text-ink-2">
          Frühere Berichte musst du nicht nachtragen: Wochen vom Ausbildungsbeginn bis zum gewählten Datum zählen
          nicht als fehlend.
        </p>
      </div>
      {answers.ignoreEarlier && (
        <Field
          label="Frühere Wochen ignorieren bis einschließlich"
          hint={range ? `Ignoriert: ${ignoredRangeLabel(range)}` : 'Die Woche mit diesem Datum zählt noch dazu.'}
          className="max-w-xs"
        >
          <Input type="date" value={answers.ignoredUntil} onChange={(e) => set({ ignoredUntil: e.target.value })} />
        </Field>
      )}
    </div>
  )
}

function HalfYearStep({ answers, set }) {
  const profile = answers.profile
  const patch = (p) => set({ profile: { ...profile, ...p } })
  const patchDay = (key, p) => patch({ weekdays: { ...profile.weekdays, [key]: { ...profile.weekdays[key], ...p } } })

  return (
    <div className="flex flex-col gap-4">
      <p className="text-body text-ink-2">
        Welche Tage bist du in der Schule, welche im Betrieb? Daraus entstehen die Tage jeder neuen Woche. Das
        nächste Halbjahr legst du später unter Profile an („Duplizieren“).
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
      <div className="border-t border-line">
        {WEEKDAY_KEYS.map((key) => {
          const day = profile.weekdays[key] ?? { type: 'off', subjects: [] }
          return (
            <div key={key} className="flex flex-col gap-2 border-b border-line py-3">
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
                  onChange={(type) => patchDay(key, { type })}
                />
                {day.type === 'school' && !(day.subjects?.length > 0) && (
                  <span className="text-meta text-ink-2">Fächer eintragen oder später ergänzen</span>
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
      <p className="text-body text-ink-2">
        Nutzt deine Berufsschule WebUntis, kann Berichtspilot Schultage, Fächer und Lehrstoff einer Woche daraus
        übernehmen. Ohne WebUntis funktioniert alles genauso, nur von Hand.
      </p>
      <Segment
        label="WebUntis"
        options={[
          { value: true, label: 'Mit WebUntis' },
          { value: false, label: 'Ohne WebUntis' },
        ]}
        value={answers.webuntisEnabled}
        onChange={(webuntisEnabled) => set({ webuntisEnabled })}
        className="w-fit"
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
            <p className="flex items-center gap-1.5 text-meta text-ink">
              <CheckIcon size={14} className="text-accent" />
              Erkannt: Server {parsed.host}
              {parsed.school ? `, Schule „${parsed.school}“` : ''}
            </p>
          )}
          <p className="flex items-start gap-1.5 text-meta text-ink-2">
            <ShieldCheckIcon size={14} className="mt-px shrink-0" />
            <span>
              Angemeldet wird erst, wenn du im Editor „Aus WebUntis“ nutzt, in einem eigenen Fenster direkt bei
              deiner Schule. Berichtspilot sieht dein Passwort nie.
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
        <p className="mt-1 text-meta text-ink-2">
          Fehlt die laufende Woche, legt die App sie von Montag bis Freitag beim Start an, mit deinen Schul- und
          Betriebstagen und den Feiertagen.
        </p>
      </div>
      <div>
        <Switch checked={answers.updateCheck} onChange={(updateCheck) => set({ updateCheck })} label="Beim Start nach Updates suchen" />
        <p className="mt-1 text-meta text-ink-2">
          Fragt bei jedem Start einmal bei GitHub nach einer neuen Version. Dabei wird nur die App-Version
          übertragen, keine Berichtsdaten. Installiert wird nur, wenn du darauf klickst.
        </p>
      </div>
    </div>
  )
}

function SummaryRow({ label, children }) {
  return (
    <div className="flex gap-3 border-b border-line py-2.5">
      <div className="w-36 shrink-0 text-body text-ink-2">{label}</div>
      <div className="min-w-0 flex-1 text-body text-ink">{children}</div>
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
      <p className="text-body text-ink-2">So wird Berichtspilot eingerichtet:</p>
      <div className="border-t border-line">
        <SummaryRow label="Ausbildung">
          {answers.trainingStart || answers.trainingEnd
            ? `${dateOrOpen(answers.trainingStart)} bis ${dateOrOpen(answers.trainingEnd)}`
            : 'nicht angegeben'}
        </SummaryRow>
        <SummaryRow label="Frühere Wochen">
          {answers.ignoreEarlier ? `ignoriert bis ${dateOrOpen(answers.ignoredUntil)}` : 'keine ignoriert'}
        </SummaryRow>
        <SummaryRow label="Bundesland">{stateName(answers.state)}</SummaryRow>
        <SummaryRow label="Halbjahr">
          {profile.name} ({dateOrOpen(profile.validFrom)} bis {dateOrOpen(profile.validTo)})
        </SummaryRow>
        <SummaryRow label="Schultage">
          {schoolDays.length === 0
            ? 'keine'
            : schoolDays.map((k) => {
                const subjects = (profile.weekdays[k].subjects ?? []).filter((s) => s.trim())
                return (
                  <div key={k}>
                    {WEEKDAY_LABELS[k]}
                    {subjects.length > 0 && <span className="text-ink-2">: {subjects.join(', ')}</span>}
                  </div>
                )
              })}
        </SummaryRow>
        <SummaryRow label="Betriebstage">
          {workDays.length === 0 ? 'keine' : workDays.map((k) => WEEKDAY_LABELS[k]).join(', ')}
        </SummaryRow>
        <SummaryRow label="WebUntis">
          {address?.ok ? `${address.host}${address.school ? `, ${address.school}` : ''}` : 'aus'}
        </SummaryRow>
        <SummaryRow label="Beim Start">
          {[answers.autoCreateWeek ? 'aktuelle Woche anlegen' : null, answers.updateCheck ? 'nach Updates suchen' : null]
            .filter(Boolean)
            .join(', ') || 'nichts'}
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

// One segment per step: done and current in the accent, ahead in the raised
// gray; done steps can be revisited
function Progress({ step, go }) {
  const current = STEPS.indexOf(step)
  return (
    <ol className="mb-4 grid grid-cols-5 gap-1.5" aria-label="Fortschritt der Einrichtung">
      {STEPS.map((s, i) => (
        <li key={s}>
          <button
            type="button"
            onClick={() => i < current && go(s)}
            disabled={i >= current}
            aria-current={i === current ? 'step' : undefined}
            aria-label={`${STEP_TITLES[s]}${i < current ? ', erledigt' : ''}`}
            title={STEP_TITLES[s]}
            className={cx(
              'block h-1.5 w-full rounded-full transition-colors duration-150',
              i <= current ? 'bg-accent' : 'bg-surface-2',
              i < current && 'hover:bg-accent-hover'
            )}
          />
        </li>
      ))}
    </ol>
  )
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

  const Body = STEP_BODY[step]

  return (
    <main className="min-h-0 flex-1 bg-canvas">
      <div className="h-full overflow-y-auto">
        <div className="mx-auto flex min-h-full max-w-2xl flex-col justify-center px-6 py-8">
          {step === 'welcome' ? (
            <Card>
              <WelcomeStep fresh={fresh} onStart={() => go('training')} onImport={importFromWizard} onSkip={skipSetup} />
            </Card>
          ) : (
            <>
              <Progress step={step} go={go} />
              <Card className="flex flex-col">
                <div className="flex items-baseline gap-2 border-b border-line px-6 py-4">
                  <h2 className="font-display text-[20px] font-medium leading-7 text-ink">{STEP_TITLES[step]}</h2>
                  {step === 'webuntis' && <span className="text-meta text-ink-2">optional</span>}
                </div>
                <div className="px-6 py-5">{Body && <Body answers={answers} set={set} />}</div>
                {errors.length > 0 && (
                  <div
                    className="mx-6 mb-4 flex items-start gap-2 rounded-control border border-missing/50 bg-missing/[0.08] px-3 py-2 text-body text-ink"
                    role="alert"
                  >
                    <WarningIcon size={16} className="mt-0.5 shrink-0 text-missing" />
                    <div>
                      {errors.map((e) => (
                        <div key={e}>{e}</div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-2 border-t border-line px-6 py-3">
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
                        <CheckIcon size={14} /> Einrichtung abschließen
                      </>
                    ) : (
                      <>
                        Weiter <ArrowRightIcon size={14} />
                      </>
                    )}
                  </Button>
                </div>
              </Card>
            </>
          )}
        </div>
      </div>
    </main>
  )
}
