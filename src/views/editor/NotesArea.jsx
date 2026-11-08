// Raw notes of a day (E-032): next to or above the bullets, shown or hidden
// for all days at once (settings.layout.notesVisible); the text itself stays
// per day and never reaches the output. On a work day the notes turn into
// bullets directly ("Als Stichpunkte übernehmen") or through any chat AI via
// the clipboard (E-011): copy this day's prompt, paste the answer back,
// check it, apply it — with undo. The week-wide flow is PhrasingPanel.jsx.
import { useMemo, useState } from 'react'
import { ListBulletsIcon, CopyIcon, ClipboardTextIcon, CheckIcon } from '@phosphor-icons/react'
import { api } from '../../store.jsx'
import { Button, Notice, TextArea } from '../../ui/basics.jsx'
import { showToast } from '../../ui/toast.jsx'
import { splitNotes } from '../../lib/notes.js'
import { buildPrompt, parseDayResponse, promptSensitive, SENSITIVE_LABELS } from '../../lib/phrasing.js'

function AiProposal({ bullets, replaces, onApply, onDiscard }) {
  return (
    <div className="flex flex-col gap-2 rounded-control border border-line bg-surface-2 p-3">
      <span className="text-meta font-medium text-ink-2">
        Vorschlag der KI
        {replaces > 0 && `, ersetzt ${replaces === 1 ? '1 Stichpunkt' : `${replaces} Stichpunkte`}`}
      </span>
      <ul className="flex flex-col gap-0.5 text-body text-ink">
        {bullets.map((b, i) => (
          <li key={i}>
            <span className="text-ink-2">- </span>
            {b}
          </li>
        ))}
      </ul>
      <div className="flex gap-1.5">
        <Button size="sm" variant="primary" onClick={onApply}>
          <CheckIcon size={14} /> Übernehmen
        </Button>
        <Button size="sm" variant="ghost" onClick={onDiscard}>
          Verwerfen
        </Button>
      </div>
    </div>
  )
}

export default function NotesArea({ day, onChange, week, examples, onApplyAi }) {
  const hasNotes = Boolean(day.notes?.trim())
  const work = day.type === 'work'
  const [copied, setCopied] = useState(false)
  const [proposal, setProposal] = useState(null)

  // This day's prompt and what in it looks like customer data (only the
  // user's own text is checked, never the prompt's rule lines). The style
  // examples come computed once from WeekEditor
  const dates = useMemo(() => [day.date], [day.date])
  const prompt = useMemo(() => (work ? buildPrompt(week, null, { dates, examples }) : null), [work, week, dates, examples])
  const sensitive = useMemo(
    () => (work ? promptSensitive(week, null, { dates, examples }) : []),
    [work, week, dates, examples]
  )

  // Each line or sentence becomes a bullet; empty placeholder rows go, the
  // notes stay for comparing
  const notesToBullets = () => {
    const items = splitNotes(day.notes)
    if (items.length === 0) {
      showToast('Keine Notizen zum Übernehmen', { kind: 'error' })
      return
    }
    onChange({ ...day, bullets: [...day.bullets.filter((b) => b.trim()), ...items] })
    showToast(items.length === 1 ? '1 Stichpunkt übernommen' : `${items.length} Stichpunkte übernommen`)
  }

  const copyPrompt = async () => {
    await navigator.clipboard.writeText(prompt)
    setCopied(true)
    showToast('KI-Prompt kopiert, jetzt in die KI einfügen')
  }

  const pasteAnswer = async () => {
    const bullets = parseDayResponse(await api.readClipboard(), day.date)
    if (bullets.length === 0) {
      showToast('In der Zwischenablage stehen keine Stichpunkte für diesen Tag', { kind: 'error', duration: 4000 })
      return
    }
    setProposal(bullets)
  }

  return (
    <section aria-label="Notizen" className="flex min-w-0 flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-meta font-medium text-ink-2">Notizen</h3>
        <span className="text-meta text-ink-2">nicht in der Ausgabe</span>
      </div>
      <TextArea
        rows={6}
        value={day.notes ?? ''}
        placeholder={work ? 'Rohnotizen zum Tag, z. B. diktiert oder aus der Zeiterfassung' : 'Rohnotizen zum Schultag'}
        onChange={(e) => onChange({ ...day, notes: e.target.value })}
        className="min-h-28"
      />
      {work && (
        <>
          <div className="flex flex-wrap items-center gap-1.5">
            <Button size="sm" onClick={notesToBullets} disabled={!hasNotes} title="Jede Zeile bzw. jeden Satz als eigenen Stichpunkt anhängen">
              <ListBulletsIcon size={14} /> Als Stichpunkte übernehmen
            </Button>
            <Button
              size="sm"
              variant={sensitive.length > 0 ? 'warning' : 'secondary'}
              onClick={copyPrompt}
              disabled={!prompt}
              title="Auftrag für eine Chat-KI (Claude.ai, ChatGPT …) mit den Notizen dieses Tages kopieren"
            >
              <CopyIcon size={14} /> {sensitive.length > 0 ? 'Trotzdem kopieren' : 'KI-Prompt kopieren'}
            </Button>
            <Button size="sm" variant="ghost" onClick={pasteAnswer} title="Die Antwort der KI aus der Zwischenablage holen">
              <ClipboardTextIcon size={14} /> Antwort einfügen
            </Button>
          </div>
          {sensitive.length > 0 && (
            <Notice>
              Mögliche Kundendaten im KI-Prompt:{' '}
              {sensitive.map((s, i) => (
                <span key={s.match}>
                  {i > 0 && ', '}
                  {SENSITIVE_LABELS[s.kind]} <span className="font-mono text-[12.5px]">{s.match}</span>
                </span>
              ))}
              . Passe die Notizen an, bevor du ihn weitergibst.
            </Notice>
          )}
          {/* What leaves the machine is visible before it is copied (hard rule 6):
              the notes plus the style examples from earlier weeks */}
          {prompt && (
            <details>
              <summary className="cursor-pointer text-meta text-ink-2 hover:text-ink">Auftrag ansehen</summary>
              <pre
                tabIndex={0}
                aria-label="KI-Prompt für diesen Tag"
                className="selectable mt-1.5 max-h-56 overflow-auto whitespace-pre-wrap rounded-control border border-line bg-canvas px-3 py-2 font-mono text-[12px] leading-5 text-ink"
              >
                {prompt}
              </pre>
            </details>
          )}
          {copied && !proposal && (
            <p className="text-meta text-ink-2">
              In Claude.ai, ChatGPT o. ä. einfügen, die Antwort kopieren und dann „Antwort einfügen“ wählen.
            </p>
          )}
          {proposal && (
            <AiProposal
              bullets={proposal}
              replaces={day.bullets.filter((b) => b.trim()).length}
              onApply={() => {
                onApplyAi(proposal)
                setProposal(null)
                setCopied(false)
              }}
              onDiscard={() => setProposal(null)}
            />
          )}
        </>
      )}
    </section>
  )
}
