// One input row per bullet (work days) or topic (school subjects): Enter adds
// a row below, Backspace in an empty row removes it, drag & drop or the
// arrows reorder, and while typing (from 2 characters) earlier bullets and the
// user's snippets are suggested.
import { useRef, useState } from 'react'
import { PlusIcon, XIcon, ArrowUpIcon, ArrowDownIcon, DotsSixVerticalIcon, ClipboardTextIcon } from '@phosphor-icons/react'
import { api } from '../../store.jsx'
import { Button, IconButton, Input, cx } from '../../ui/basics.jsx'
import { showToast } from '../../ui/toast.jsx'
import { BULLET_PREFIX } from '../../lib/notes.js'

// Move an array element (returns a new array)
export const move = (arr, from, to) => {
  if (to < 0 || to >= arr.length) return arr
  const copy = [...arr]
  const [el] = copy.splice(from, 1)
  copy.splice(to, 0, el)
  return copy
}

function BulletInput({ bullet, placeholder, label, suggestions, onChange, onEnter, onBackspaceEmpty }) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)

  const input = bullet.trim().toLowerCase()
  const matches =
    open && input.length >= 2
      ? suggestions.filter((s) => s.toLowerCase().includes(input) && s.toLowerCase() !== input).slice(0, 6)
      : []

  const accept = (value) => {
    onChange(value)
    setOpen(false)
  }

  return (
    <div className="relative min-w-0 flex-1">
      <Input
        value={bullet}
        placeholder={placeholder}
        aria-label={label}
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
          setActive(0)
        }}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (matches.length > 0) {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setActive((a) => (a + 1) % matches.length)
              return
            }
            if (e.key === 'ArrowUp') {
              e.preventDefault()
              setActive((a) => (a - 1 + matches.length) % matches.length)
              return
            }
            if (e.key === 'Escape' || e.key === 'Tab') {
              setOpen(false)
              return
            }
            if (e.key === 'Enter') {
              e.preventDefault()
              accept(matches[active])
              return
            }
          }
          if (e.key === 'Enter') onEnter()
          // Backspace on an empty row removes it (never the last one)
          if (e.key === 'Backspace' && bullet === '') {
            e.preventDefault()
            onBackspaceEmpty()
          }
        }}
      />
      {matches.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-control border border-line bg-surface p-1 shadow-float">
          {matches.map((s, i) => (
            <button
              key={s}
              type="button"
              // mousedown instead of click, so the input's blur doesn't close the list first
              onMouseDown={(e) => {
                e.preventDefault()
                accept(s)
              }}
              onMouseEnter={() => setActive(i)}
              className={cx(
                'block w-full truncate rounded-[6px] px-2 py-1.5 text-left text-body',
                i === active ? 'bg-surface-2 text-ink' : 'text-ink-2'
              )}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * `noun` names one row in the buttons ("Stichpunkt", "Thema"); `clipboard`
 * shows "Aus Zwischenablage" (lines from time tracking or WebUntis);
 * `compact` (school topics in their narrow column) drops the drag handle and
 * the arrows and keeps only "×" once there are two rows.
 */
export default function BulletList({
  bullets,
  onChange,
  placeholder,
  suggestions = [],
  noun = 'Stichpunkt',
  clipboard = true,
  compact = false,
}) {
  const containerRef = useRef(null)
  // Drag & drop reordering: index of the dragged and the hovered row
  const [dragIndex, setDragIndex] = useState(null)
  const [overIndex, setOverIndex] = useState(null)

  const focusAt = (index) => {
    requestAnimationFrame(() => {
      containerRef.current?.querySelectorAll('input')[index]?.focus()
    })
  }

  const setAt = (i, value) => onChange(bullets.map((b, j) => (j === i ? value : b)))
  const insertAfter = (index) => {
    const copy = [...bullets]
    copy.splice(index + 1, 0, '')
    onChange(copy)
    focusAt(index + 1)
  }
  const remove = (i) => {
    onChange(bullets.filter((_, j) => j !== i))
    focusAt(Math.max(0, i - 1))
  }
  const drop = (target) => {
    if (dragIndex !== null && dragIndex !== target) onChange(move(bullets, dragIndex, target))
    setDragIndex(null)
    setOverIndex(null)
  }

  // Append clipboard lines as rows; leading bullet characters/numbering go
  const pasteFromClipboard = async () => {
    const text = await api.readClipboard()
    const lines = (text ?? '')
      .split(/\r?\n/)
      .map((l) => l.replace(BULLET_PREFIX, '').trim())
      .filter(Boolean)
    if (lines.length === 0) {
      showToast('Zwischenablage enthält keinen Text', { kind: 'error' })
      return
    }
    onChange([...bullets.filter((b) => b.trim()), ...lines])
    showToast(lines.length === 1 ? `1 ${noun} eingefügt` : `${lines.length} Zeilen eingefügt`)
  }

  return (
    <div ref={containerRef} className="flex flex-col gap-1">
      {bullets.map((bullet, i) => (
        <div
          key={i}
          onDragOver={(e) => {
            if (dragIndex === null) return
            e.preventDefault()
            setOverIndex(i)
          }}
          onDrop={(e) => {
            e.preventDefault()
            drop(i)
          }}
          className={cx(
            'group/bullet flex items-center gap-1 rounded-control transition-[opacity,box-shadow] duration-150',
            dragIndex === i && 'opacity-40',
            overIndex === i && dragIndex !== null && dragIndex !== i && 'ring-1 ring-mark'
          )}
        >
          {!compact && (
            <button
              type="button"
              draggable
              onDragStart={(e) => {
                setDragIndex(i)
                e.dataTransfer.effectAllowed = 'move'
              }}
              onDragEnd={() => {
                setDragIndex(null)
                setOverIndex(null)
              }}
              title="Zum Umsortieren ziehen"
              aria-label={`${noun} umsortieren`}
              tabIndex={-1}
              className="flex h-8 w-4 shrink-0 cursor-grab items-center justify-center text-ink-2/50 transition-colors duration-150 hover:text-ink active:cursor-grabbing group-hover/bullet:text-ink-2"
            >
              <DotsSixVerticalIcon size={14} />
            </button>
          )}
          <BulletInput
            bullet={bullet}
            placeholder={placeholder}
            label={`${noun} ${i + 1}`}
            suggestions={suggestions}
            onChange={(value) => setAt(i, value)}
            onEnter={() => insertAfter(i)}
            onBackspaceEmpty={() => bullets.length > 1 && remove(i)}
          />
          {compact ? (
            bullets.length > 1 && (
              <IconButton label={`${noun} löschen`} size="sm" danger onClick={() => remove(i)}>
                <XIcon size={14} />
              </IconButton>
            )
          ) : (
            <div className="flex opacity-0 transition-opacity duration-150 group-focus-within/bullet:opacity-100 group-hover/bullet:opacity-100">
              <IconButton label="Nach oben" size="sm" disabled={i === 0} onClick={() => onChange(move(bullets, i, i - 1))}>
                <ArrowUpIcon size={14} />
              </IconButton>
              <IconButton label="Nach unten" size="sm" disabled={i === bullets.length - 1} onClick={() => onChange(move(bullets, i, i + 1))}>
                <ArrowDownIcon size={14} />
              </IconButton>
              <IconButton label={`${noun} löschen`} size="sm" danger disabled={bullets.length === 1} onClick={() => remove(i)}>
                <XIcon size={14} />
              </IconButton>
            </div>
          )}
        </div>
      ))}
      <div className={cx('flex items-center gap-1', compact ? '' : 'mt-1 pl-5')}>
        <Button size="sm" variant="ghost" onClick={() => insertAfter(bullets.length - 1)}>
          <PlusIcon size={14} /> {noun}
        </Button>
        {clipboard && (
          <Button
            size="sm"
            variant="ghost"
            onClick={pasteFromClipboard}
            title="Zeilen aus der Zwischenablage (z. B. Zeiterfassung oder WebUntis) anhängen"
          >
            <ClipboardTextIcon size={14} /> Aus Zwischenablage
          </Button>
        )}
      </div>
    </div>
  )
}
