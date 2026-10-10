// AI phrasing via the clipboard bridge (DECISIONS E-011), shown inside the week
// editor: 1) copy the prompt into any chat AI, 2) paste the answer back,
// 3) review per day and apply. No network access — the user moves the text.
import { useMemo, useState } from 'react'
import {
  SparkleIcon,
  CopyIcon,
  ClipboardTextIcon,
  XIcon,
  WarningIcon,
  ArrowSquareOutIcon,
  CheckIcon,
} from '@phosphor-icons/react'
import { api } from '../store.jsx'
import { Button, IconButton, TextArea, Panel, cx } from '../ui/basics.jsx'
import { showToast } from '../ui/toast.jsx'
import { weekdayName, formatDE } from '../lib/dates.js'
import { buildPrompt, parseResponse, findSensitive, phrasingCandidates } from '../lib/phrasing.js'

// German labels for the kinds reported by findSensitive()
const SENSITIVE_LABELS = {
  email: 'E-Mail-Adresse',
  ip: 'IP-Adresse',
  mac: 'MAC-Adresse',
  ticket: 'Ticketnummer',
  phone: 'Telefonnummer',
}

const CHAT_LINKS = [
  ['Claude.ai', 'https://claude.ai/new'],
  ['ChatGPT', 'https://chatgpt.com/'],
  ['Gemini', 'https://gemini.google.com/app'],
]

function Step({ number, title, children }) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-accent/15 text-[11px] font-semibold text-accent tabular-nums">
        {number}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium text-ink">{title}</div>
        <div className="mt-1.5">{children}</div>
      </div>
    </div>
  )
}

export default function PhrasingPanel({ week, weeks, onApply, onClose }) {
  const [answer, setAnswer] = useState('')
  const [deselected, setDeselected] = useState(() => new Set())

  const prompt = useMemo(() => buildPrompt(week, weeks), [week, weeks])
  const sensitive = useMemo(() => (prompt ? findSensitive(prompt) : []), [prompt])
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
    showToast('Auftrag kopiert — jetzt in die KI einfügen')
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
    <Panel data-daycard className="shrink-0 border-accent/20">
      <div className="flex items-center gap-2 border-b border-white/[0.05] px-4 py-2.5">
        <SparkleIcon size={16} className="text-accent" />
        <span className="mr-auto text-[14px] font-semibold">Mit KI formulieren</span>
        <IconButton label="Schließen" onClick={onClose}>
          <XIcon size={14} />
        </IconButton>
      </div>

      {!prompt ? (
        <p className="px-4 py-4 text-[12.5px] text-ink-3">
          Keine Notizen an Betriebstagen. Trage zuerst bei den Tagen Notizen ein (Stift-Symbol) —
          daraus formuliert die KI die Stichpunkte.
        </p>
      ) : (
        <div className="flex flex-col gap-4 px-4 py-4">
          <Step number="1" title="Auftrag kopieren und in eine KI einfügen">
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="primary" onClick={copyPrompt}>
                <CopyIcon size={14} /> Auftrag kopieren
              </Button>
              {CHAT_LINKS.map(([name, url]) => (
                <a
                  key={name}
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex h-7 items-center gap-1 rounded-md px-2 text-[12px] font-medium text-ink-3 transition-colors duration-150 hover:bg-white/[0.05] hover:text-accent"
                >
                  {name} <ArrowSquareOutIcon size={12} />
                </a>
              ))}
            </div>
            <p className="mt-1.5 text-[11.5px] text-ink-3">
              {candidates.length === 1 ? '1 Tag' : `${candidates.length} Tage`} mit Notizen. Der Auftrag enthält
              deine Notizen und einige frühere Stichpunkte als Stilvorlage — sonst nichts.
            </p>
            {sensitive.length > 0 && (
              <div className="mt-2 flex items-start gap-2 rounded-lg border border-draft/25 bg-draft/[0.06] px-3 py-2">
                <WarningIcon size={15} className="mt-0.5 shrink-0 text-draft" />
                <div className="text-[12px] leading-snug text-ink-2">
                  Mögliche Kundendaten im Auftrag:{' '}
                  {sensitive.map((s, i) => (
                    <span key={s.match}>
                      {i > 0 && ', '}
                      {SENSITIVE_LABELS[s.kind]} <span className="font-mono text-ink">{s.match}</span>
                    </span>
                  ))}
                  . Passe die Notizen an, bevor du den Auftrag weitergibst.
                </div>
              </div>
            )}
            <details className="mt-2">
              <summary className="cursor-pointer text-[12px] text-ink-3 hover:text-ink-2">Auftrag ansehen</summary>
              <pre className="selectable mt-1.5 max-h-56 overflow-auto whitespace-pre-wrap rounded-lg border border-white/[0.06] bg-inset/50 px-3 py-2 font-mono text-[11.5px] leading-relaxed text-ink-2">
                {prompt}
              </pre>
            </details>
          </Step>

          <Step number="2" title="Antwort der KI hier einfügen">
            <TextArea
              rows={4}
              value={answer}
              placeholder={'### 2026-09-30\n- …'}
              onChange={(e) => setAnswer(e.target.value)}
              className="font-mono text-[12px]"
            />
            <Button size="sm" variant="ghost" onClick={pasteAnswer} className="mt-1">
              <ClipboardTextIcon size={14} /> Aus Zwischenablage einfügen
            </Button>
          </Step>

          {answer.trim() && (
            <Step number="3" title="Prüfen und übernehmen">
              {result.matched.length === 0 ? (
                <p className="text-[12px] text-sick">
                  In der Antwort wurden keine Stichpunkte zu den Tagen dieser Woche gefunden. Hat die KI das
                  Format mit den Datumszeilen (### JJJJ-MM-TT) eingehalten?
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
                          'flex cursor-pointer gap-2.5 rounded-lg border px-3 py-2 transition-colors duration-150',
                          on ? 'border-accent/20 bg-accent/[0.04]' : 'border-white/[0.06] opacity-60'
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() => toggle(day.date)}
                          className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-[var(--color-accent)]"
                        />
                        <div className="min-w-0">
                          <div className="text-[12.5px] font-medium text-ink">
                            {weekdayName(day.date)}, {formatDE(day.date)}
                            {existing > 0 && (
                              <span className="ml-2 text-[11px] font-normal text-ink-3">
                                ersetzt {existing === 1 ? '1 vorhandenen Stichpunkt' : `${existing} vorhandene Stichpunkte`}
                              </span>
                            )}
                          </div>
                          <ul className="mt-1 flex flex-col gap-0.5 text-[12px] text-ink-2">
                            {bullets.map((b, i) => (
                              <li key={i}>
                                <span className="text-ink-3">- </span>
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
                <ul className="mt-2 flex flex-col gap-0.5 text-[11.5px] text-ink-3">
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
                <Button variant="primary" onClick={apply} disabled={selected.length === 0} className="mt-3">
                  <CheckIcon size={15} weight="bold" />
                  {selected.length === 1 ? 'Für 1 Tag übernehmen' : `Für ${selected.length} Tage übernehmen`}
                </Button>
              )}
            </Step>
          )}
        </div>
      )}
    </Panel>
  )
}
