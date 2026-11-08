// The editor card of one day (E-032; the week editor stacks all of them): title, the 5-way type switch
// (Betrieb · Schule · Feiertag · Krank · Urlaub — dayChoice/withChoice in
// model.js) and the body: bullets for a work day, subjects with their topics
// for a school day, a note on what the output shows for a status day. The
// notes area sits next to or above the bullets when it is switched on.
import { PlusIcon, XIcon, ArrowUpIcon, ArrowDownIcon } from '@phosphor-icons/react'
import { Card, Field, IconButton, Input, Notice, Segment, Button, cx } from '../../ui/basics.jsx'
import { formatDE, weekdayName } from '../../lib/dates.js'
import { dayChoice, withChoice } from '../../lib/model.js'
import { formatAll } from '../../lib/format.js'
import BulletList, { move } from './BulletList.jsx'
import NotesArea from './NotesArea.jsx'

const CHOICES = [
  { value: 'work', label: 'Betrieb' },
  { value: 'school', label: 'Schule' },
  { value: 'holiday', label: 'Feiertag' },
  { value: 'sick', label: 'Krank' },
  { value: 'vacation', label: 'Urlaub' },
]

// The status line the output will show — from format.js itself, so the hint
// can never drift from the real text
function statusLineOf(day) {
  const blocks = formatAll({ id: day.date, status: 'draft', instructions: '', days: [day] })
  const text = day.type === 'school' ? blocks.school : blocks.work
  return text.split('\n').find((line) => line.startsWith('- ')) ?? ''
}

function StatusBody({ day, onChange }) {
  return (
    <div className="flex flex-col gap-3 p-4">
      {day.status === 'holiday' && (
        <Field label="Name des Feiertags" className="max-w-sm">
          <Input
            value={day.holidayName ?? ''}
            placeholder="z. B. Tag der Arbeit"
            onChange={(e) => onChange({ ...day, holidayName: e.target.value })}
          />
        </Field>
      )}
      <Notice tone="info">
        Kein Eintrag nötig. In {day.type === 'school' ? 'Block 3 (Berufsschule)' : 'Block 1 (Betrieb)'} steht{' '}
        <span className="font-mono text-[12.5px]">{statusLineOf(day)}</span>
      </Notice>
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-meta text-ink-2">Zählt als</span>
        <Segment
          size="sm"
          label="Zählt als"
          options={[
            { value: 'work', label: 'Betriebstag' },
            { value: 'school', label: 'Schultag' },
          ]}
          value={day.type}
          onChange={(type) => onChange({ ...day, type })}
        />
        <span className="text-meta text-ink-2">bestimmt, in welchem Block die Zeile steht</span>
      </div>
    </div>
  )
}

function SchoolSubjects({ day, onChange, suggestions }) {
  const setSubjects = (subjects) => onChange({ ...day, subjects })
  const setSubject = (i, subject) => setSubjects(day.subjects.map((s, j) => (j === i ? subject : s)))

  return (
    <div className="flex min-w-0 flex-col">
      {day.subjects.map((subject, i) => (
        <div key={i} className="grid grid-cols-[minmax(80px,120px)_minmax(0,1fr)_auto] items-start gap-2 border-b border-line py-3 first:pt-0">
          <Input
            value={subject.label}
            placeholder="Fach"
            aria-label={`Fach ${i + 1}`}
            onChange={(e) => setSubject(i, { ...subject, label: e.target.value })}
            className="font-medium"
          />
          <BulletList
            bullets={subject.bullets}
            onChange={(bullets) => setSubject(i, { ...subject, bullets })}
            placeholder="Thema …"
            noun="Thema"
            clipboard={false}
            compact
            suggestions={suggestions.forSubject(subject.label)}
          />
          <div className="flex">
            <IconButton label="Fach nach oben" size="sm" disabled={i === 0} onClick={() => setSubjects(move(day.subjects, i, i - 1))}>
              <ArrowUpIcon size={14} />
            </IconButton>
            <IconButton
              label="Fach nach unten"
              size="sm"
              disabled={i === day.subjects.length - 1}
              onClick={() => setSubjects(move(day.subjects, i, i + 1))}
            >
              <ArrowDownIcon size={14} />
            </IconButton>
            <IconButton label="Fach entfernen" size="sm" danger onClick={() => setSubjects(day.subjects.filter((_, j) => j !== i))}>
              <XIcon size={14} />
            </IconButton>
          </div>
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-3 pt-2">
        <Button size="sm" variant="ghost" onClick={() => setSubjects([...day.subjects, { label: '', bullets: [''] }])}>
          <PlusIcon size={14} /> Fach
        </Button>
        <span className="text-meta text-ink-2">Fächer ohne Thema lässt die Ausgabe weg.</span>
      </div>
    </div>
  )
}

export default function DayEditor({ day, state, onChange, suggestions, notesVisible, week, examples, onApplyAi }) {
  const choice = dayChoice(day)
  const normal = day.status === 'normal'

  const content =
    day.type === 'school' ? (
      <SchoolSubjects day={day} onChange={onChange} suggestions={suggestions} />
    ) : (
      <section aria-label="Stichpunkte" className="flex min-w-0 flex-col gap-2">
        <h3 className="text-meta font-medium text-ink-2">Stichpunkte</h3>
        <BulletList
          bullets={day.bullets}
          onChange={(bullets) => onChange({ ...day, bullets })}
          placeholder="Tätigkeit beschreiben …"
          suggestions={suggestions.work}
        />
      </section>
    )

  return (
    <Card as="section" data-daycard={day.date} aria-labelledby={`day-${day.date}`} className="@container">
      <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3">
        <h2 id={`day-${day.date}`} className="mr-auto text-title font-medium text-ink">
          {weekdayName(day.date)}, {formatDE(day.date)}
        </h2>
        <Segment
          size="sm"
          label="Art des Tages"
          options={CHOICES}
          value={choice}
          onChange={(c) => onChange(withChoice(day, c, state))}
        />
      </div>

      {!normal ? (
        <StatusBody day={day} onChange={onChange} />
      ) : notesVisible ? (
        // notes beside the bullets on a wide card, above them on a narrow one —
        // and always above the subjects of a school day, which need the width
        <div className={cx('grid', day.type === 'work' && '@2xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]')}>
          <div className={cx('border-b border-line p-4', day.type === 'work' && '@2xl:border-b-0 @2xl:border-r')}>
            <NotesArea day={day} onChange={onChange} week={week} examples={examples} onApplyAi={onApplyAi} />
          </div>
          <div className={cx('min-w-0 p-4')}>{content}</div>
        </div>
      ) : (
        <div className="p-4">{content}</div>
      )}
    </Card>
  )
}
