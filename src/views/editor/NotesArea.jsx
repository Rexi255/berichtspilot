// Raw notes of a day (E-032): next to or above the bullets, shown or hidden
// for all days at once (settings.layout.notesVisible); the text itself stays
// per day. Notes never reach the output. On work days they turn into bullets
// directly ("Als Stichpunkte übernehmen") or through a chat AI (11.7c).
import { ListBulletsIcon } from '@phosphor-icons/react'
import { Button, TextArea } from '../../ui/basics.jsx'
import { showToast } from '../../ui/toast.jsx'
import { splitNotes } from '../../lib/notes.js'

export default function NotesArea({ day, onChange, children }) {
  const hasNotes = Boolean(day.notes?.trim())
  const work = day.type === 'work'

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
        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            size="sm"
            onClick={notesToBullets}
            disabled={!hasNotes}
            title="Jede Zeile bzw. jeden Satz als eigenen Stichpunkt anhängen"
          >
            <ListBulletsIcon size={14} /> Als Stichpunkte übernehmen
          </Button>
          {children}
        </div>
      )}
    </section>
  )
}
