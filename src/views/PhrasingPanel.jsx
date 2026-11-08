// AI phrasing of the whole week via the clipboard bridge (DECISIONS E-011),
// shown inside the week editor: copy the prompt into any chat AI, paste the
// answer back, review per day and apply. No network access — the user moves
// the text. (One day at a time: the notes area, NotesArea.jsx.)
import { useMemo, useState } from 'react'
import { ChatCenteredTextIcon, CopyIcon, ClipboardTextIcon, XIcon, ArrowSquareOutIcon, CheckIcon } from '@phosphor-icons/react'
import { api } from '../store.jsx'
import { Button, Card, IconButton, Notice, TextArea, cx } from '../ui/basics.jsx'
import { showToast } from '../ui/toast.jsx'
import { weekdayName, formatDE } from '../lib/dates.js'
import { buildPrompt, parseResponse, promptSensitive, phrasingCandidates, SENSITIVE_LABELS } from '../lib/phrasing.js'

const CHAT_LINKS = [
  ['Claude.ai', 'https://claude.ai/new'],
  ['ChatGPT', 'https://chatgpt.com/'],
  ['Gemini', 'https://gemini.google.com/app'],
]

// One part of the flow: a heading that says what to do, then its controls
function Part({ title, children }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-body font-medium text-ink">{title}</h3>
      {children}
    </section>
  )
}

export default function PhrasingPanel({ week, examples, onApply, onClose }) {
  const [answer, setAnswer] = useState('')
  const [deselected, setDeselected] = useState(() => new Set())

  const prompt = useMemo(() => buildPrompt(week, null, { examples }), [week, examples])
  // only the user's own text in the prompt (its rule lines mention "Kunden")
  const sensitive = useMemo(() => promptSensitive(week, null, { examples }), [week, examples])
  const candidates = useMemo(() => phrasingCandidates(week), [week])
  const parsed = useMemo(() => parseResponse(answer), [answer])

  // Map the answer onto this week's candidate days; report what didn't match
  const result = useMemo(() => {
    const candidateDates = new Set(candidates.map((d) => d.date))
    const matched = candidates
      .filter((d) => parsed.days[d.date]?.length > 0)
      .map((d) => ({ day: d, bullets: parsed.days[d.date] }))
    const unknown = Object.keys(parsed.days).filter((date) => !candidateDates.has(date))
    const missing = candidates.filter((d) => !(parsed.days[d.date]?.length > 0))
    return { matched, unknown, missing }
  }, [candidates, parsed])

  const selected = result.matched.filter((m) => !deselected.has(m.day.date))

  const copyPrompt = async () => {
    await navigator.clipboard.writeText(prompt)
    showToast('Auftrag kopiert, jetzt in die KI einfügen')
  }

  const pasteAnswer = async () => {
    const text = await api.readClipboard()
    if (!text?.trim()) {
      showToast('Zwischenablage enthält keinen Text', { kind: 'error' })
      return
    }
    setAnswer(text)
  }

  const toggle = (date) =>
    setDeselected((s) => {
      const next = new Set(s)
      if (next.has(date)) next.delete(date)
      else next.add(date)
      return next
    })

  const apply = () => onApply(Object.fromEntries(selected.map((m) => [m.day.date, m.bullets])))

  return (
    <Card className="shrink-0">
      <div className="flex items-center gap-2 border-b border-line py-2 pl-4 pr-2">
        <ChatCenteredTextIcon size={16} className="text-ink-2" />
        <h2 className="mr-auto text-title font-medium text-ink">Ganze Woche mit KI formulieren</h2>
        <IconButton label="Schließen" side="bottom-end" onClick={onClose}>
          <XIcon size={16} />
        </IconButton>
      </div>

      {!prompt ? (
        <p className="px-4 py-4 text-body text-ink-2">
          Keine Notizen an Betriebstagen. Schreib zuerst Notizen zu den Tagen, daraus formuliert die KI die
          Stichpunkte.
        </p>
      ) : (
        <div className="flex flex-col gap-5 p-4">
          <Part title="Auftrag kopieren und in eine KI einfügen">
            <div className="flex flex-wrap items-center gap-1.5">
              <Button size="sm" variant={sensitive.length > 0 ? 'warning' : 'primary'} onClick={copyPrompt}>
                <CopyIcon size={14} /> {sensitive.length > 0 ? 'Trotzdem kopieren' : 'Auftrag kopieren'}
              </Button>
              {CHAT_LINKS.map(([name, url]) => (
                <a
                  key={name}
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex h-7 items-center gap-1 rounded-control px-2 text-meta font-medium text-ink-2 transition-colors duration-150 hover:bg-surface-2 hover:text-ink"
                >
                  {name} <ArrowSquareOutIcon size={12} />
                </a>
              ))}
            </div>
            <p className="text-meta text-ink-2">
              {candidates.length === 1 ? '1 Tag' : `${candidates.length} Tage`} mit Notizen. Der Auftrag enthält
              deine Notizen und einige frühere Stichpunkte als Stilvorlage, sonst nichts.
            </p>
            {sensitive.length > 0 && (
              <Notice>
                Mögliche Kundendaten im Auftrag:{' '}
                {sensitive.map((s, i) => (
                  <span key={s.match}>
                    {i > 0 && ', '}
                    {SENSITIVE_LABELS[s.kind]} <span className="font-mono text-[12.5px]">{s.match}</span>
                  </span>
                ))}
                . Passe die Notizen an, bevor du den Auftrag weitergibst.
              </Notice>
            )}
            <details>
              <summary className="cursor-pointer text-meta text-ink-2 hover:text-ink">Auftrag ansehen</summary>
              <pre className="selectable mt-1.5 max-h-56 overflow-auto whitespace-pre-wrap rounded-control border border-line bg-canvas px-3 py-2 font-mono text-[12px] leading-5 text-ink">
                {prompt}
              </pre>
            </details>
          </Part>

          <Part title="Antwort der KI hier einfügen">
            <TextArea
              rows={4}
              value={answer}
              placeholder={'### 2026-09-30\n- …'}
              onChange={(e) => setAnswer(e.target.value)}
              className="font-mono text-[12.5px]"
            />
            <Button size="sm" variant="ghost" onClick={pasteAnswer} className="w-fit">
              <ClipboardTextIcon size={14} /> Aus Zwischenablage einfügen
            </Button>
          </Part>

          {answer.trim() && (
            <Part title="Prüfen und übernehmen">
              {result.matched.length === 0 ? (
                <p className="text-body text-missing">
                  In der Antwort stehen keine Stichpunkte zu den Tagen dieser Woche. Hat die KI die Datumszeilen
                  (### JJJJ-MM-TT) behalten?
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {result.matched.map(({ day, bullets }) => {
                    const on = !deselected.has(day.date)
                    const existing = day.bullets.filter((b) => b.trim()).length
                    return (
                      <label
                        key={day.date}
                        className={cx(
                          'flex cursor-pointer gap-2.5 rounded-control border border-line px-3 py-2 transition-colors duration-150',
                          on ? 'bg-surface-2' : 'opacity-60'
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() => toggle(day.date)}
                          className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-[var(--color-accent)]"
                        />
                        <div className="min-w-0">
                          <div className="text-body font-medium text-ink">
                            {weekdayName(day.date)}, {formatDE(day.date)}
                            {existing > 0 && (
                              <span className="ml-2 text-meta font-normal text-ink-2">
                                ersetzt {existing === 1 ? '1 vorhandenen Stichpunkt' : `${existing} vorhandene Stichpunkte`}
                              </span>
                            )}
                          </div>
                          <ul className="mt-1 flex flex-col gap-0.5 text-body text-ink">
                            {bullets.map((b, i) => (
                              <li key={i}>
                                <span className="text-ink-2">- </span>
                                {b}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </label>
                    )
                  })}
                </div>
              )}

              {(result.missing.length > 0 || result.unknown.length > 0 || parsed.ignoredLines > 0) && (
                <ul className="flex flex-col gap-0.5 text-meta text-ink-2">
                  {result.missing.length > 0 && (
                    <li>Ohne Ergebnis: {result.missing.map((d) => weekdayName(d.date)).join(', ')}</li>
                  )}
                  {result.unknown.length > 0 && (
                    <li>Nicht in dieser Woche: {result.unknown.map((date) => formatDE(date)).join(', ')}</li>
                  )}
                  {parsed.ignoredLines > 0 && (
                    <li>
                      {parsed.ignoredLines === 1 ? '1 Zeile' : `${parsed.ignoredLines} Zeilen`} ohne Stichpunkt
                      ignoriert (z. B. Einleitung der KI)
                    </li>
                  )}
                </ul>
              )}

              {result.matched.length > 0 && (
                <Button variant="primary" onClick={apply} disabled={selected.length === 0} className="w-fit">
                  <CheckIcon size={16} />
                  {selected.length === 1 ? 'Für 1 Tag übernehmen' : `Für ${selected.length} Tage übernehmen`}
                </Button>
              )}
            </Part>
          )}
        </div>
      )}
    </Card>
  )
}
