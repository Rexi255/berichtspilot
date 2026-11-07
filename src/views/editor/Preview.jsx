// The three output blocks exactly as they get pasted (E-032). One string per
// block — formatAll() — feeds the preview, the copy buttons, the copy bar and
// Strg+1/2/3, so what you see is what you copy. The preview never wraps or
// trims (white-space: pre); "Leerzeichen anzeigen" draws its markers with
// CSS (.ws-on in index.css), so even a mouse selection copies the real text.
// A privacy check per block warns about likely customer data first.
import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { CopyIcon, CheckIcon, FileArrowDownIcon, SidebarSimpleIcon, WarningIcon } from '@phosphor-icons/react'
import { api } from '../../store.jsx'
import { Button, Card, IconButton, Kbd, Notice, Switch, cx } from '../../ui/basics.jsx'
import { showToast } from '../../ui/toast.jsx'
import { previewLines, lineCount } from '../../lib/preview.js'
import { findSensitive, SENSITIVE_LABELS } from '../../lib/phrasing.js'
import { SHORTCUT_KEYS } from '../../lib/shortcuts.js'

// `block` = key in formatAll() — also the end-to-end tests' hook (data-output)
export const BLOCKS = [
  { block: 'work', number: 1, title: 'Betriebliche Tätigkeiten', short: 'Betrieb', fileName: '1Betriebliche Tätigkeiten.txt' },
  { block: 'instructions', number: 2, title: 'Unterweisungen', short: 'Unterweisungen', fileName: '2Unterweisungen, betrieblicher Unterricht, sonstige Schulungen.txt' },
  { block: 'school', number: 3, title: 'Berufsschule', short: 'Berufsschule', fileName: '3Berufsschule (Unterrichtsthemen).txt' },
]

// A shortcut press on a block with a warning arms it; the second press within
// this time copies ("Trotzdem kopieren" by keyboard)
const ARM_MS = 4000

/**
 * Copying the blocks: { sensitive: { block: findings }, copiedBlock,
 * copy(index), copyByShortcut(index) }. The buttons copy right away — they
 * already read "Trotzdem kopieren" next to the warning.
 */
export function useBlockCopy(blocks) {
  const [copiedBlock, setCopiedBlock] = useState(null)
  const armed = useRef({ index: null, until: 0 })
  const timer = useRef(null)

  const sensitive = useMemo(
    () => Object.fromEntries(BLOCKS.map(({ block }) => [block, blocks ? findSensitive(blocks[block]) : []])),
    [blocks]
  )

  const copy = async (index) => {
    const { block, title } = BLOCKS[index]
    const text = blocks?.[block]
    if (!text) {
      showToast(`„${title}" ist leer`, { kind: 'error' })
      return
    }
    await navigator.clipboard.writeText(text)
    showToast(`„${title}" kopiert`)
    setCopiedBlock(block)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopiedBlock(null), 1600)
  }

  const copyByShortcut = (index) => {
    const { block, title } = BLOCKS[index]
    const now = Date.now()
    if (sensitive[block].length > 0 && !(armed.current.index === index && now < armed.current.until)) {
      armed.current = { index, until: now + ARM_MS }
      showToast(`„${title}" enthält mögliche Kundendaten. ${SHORTCUT_KEYS.copy[index]} noch einmal drücken, um trotzdem zu kopieren`, {
        kind: 'error',
        duration: ARM_MS,
      })
      return
    }
    armed.current = { index: null, until: 0 }
    copy(index)
  }

  return { sensitive, copiedBlock, copy, copyByShortcut }
}

// "Kundenbezug „Kunden", IP-Adresse 192.168.1.20"
function SensitiveList({ found }) {
  return found.map((s, i) => (
    <Fragment key={s.match}>
      {i > 0 && ', '}
      {SENSITIVE_LABELS[s.kind]} <span className="font-mono text-[12.5px]">{s.match}</span>
    </Fragment>
  ))
}

const LINE_CLASS = { header: 'font-medium', subject: 'font-medium' }

/** The block text, line by line; whitespace segments carry the marker classes */
function PreviewText({ text, showWhitespace }) {
  const lines = useMemo(() => previewLines(text), [text])
  return (
    <pre
      className={cx(
        'selectable overflow-x-auto whitespace-pre px-4 py-3 font-mono text-[12.5px] leading-5 text-ink [tab-size:4]',
        showWhitespace && 'ws-on'
      )}
    >
      {lines.map((line, i) => (
        <Fragment key={i}>
          <span className={LINE_CLASS[line.kind]}>
            {line.segments.map((s, j) =>
              s.ws ? (
                <span key={j} className={`ws ws-${s.ws}`}>
                  {s.text}
                </span>
              ) : (
                <Fragment key={j}>{s.text}</Fragment>
              )
            )}
          </span>
          {line.eol && (
            <>
              <span className="eol" />
              {'\n'}
            </>
          )}
        </Fragment>
      ))}
    </pre>
  )
}

function BlockCard({ meta, text, found, copied, onCopy, showWhitespace }) {
  const lines = lineCount(text)

  const exportTxt = async () => {
    const res = await api.exportText(meta.fileName, text)
    if (res?.ok) showToast('Als .txt gespeichert')
    else if (res && !res.canceled) showToast(res.error ?? 'Export fehlgeschlagen', { kind: 'error' })
  }

  return (
    <Card data-output={meta.block} className="flex shrink-0 flex-col overflow-hidden">
      <div className="flex items-center gap-2 border-b border-line py-2 pl-4 pr-2">
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-chip border border-line text-meta font-medium tabular-nums text-ink-2">
          {meta.number}
        </span>
        <span className="mr-auto min-w-0">
          <span className="block truncate text-body font-medium text-ink">{meta.title}</span>
          <span className="block text-meta tabular-nums text-ink-2">
            {lines === 0 ? 'leer' : lines === 1 ? '1 Zeile' : `${lines} Zeilen`}
          </span>
        </span>
        <IconButton label="Als .txt exportieren" size="sm" onClick={exportTxt} disabled={!text}>
          <FileArrowDownIcon size={16} />
        </IconButton>
        <Button
          size="sm"
          variant={found.length > 0 ? 'warning' : 'secondary'}
          onClick={onCopy}
          disabled={!text}
          title={`Kopieren (${SHORTCUT_KEYS.copy[meta.number - 1]})`}
        >
          {copied ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
          {copied ? 'Kopiert' : found.length > 0 ? 'Trotzdem kopieren' : 'Kopieren'}
        </Button>
      </div>
      {found.length > 0 && (
        <Notice className="mx-3 mt-3">
          Mögliche Kundendaten: <SensitiveList found={found} />. Prüfe den Text, bevor du ihn einfügst.
        </Notice>
      )}
      {text ? (
        <PreviewText text={text} showWhitespace={showWhitespace} />
      ) : (
        <p className="px-4 py-3 text-body text-ink-2">Leer, nichts zu kopieren.</p>
      )}
    </Card>
  )
}

/** The preview column: toolbar + one card per block */
export default function Preview({ blocks, copier, showWhitespace, setShowWhitespace, onHide }) {
  return (
    <section aria-label="Vorschau" className="flex flex-col gap-3">
      <div className="flex items-center gap-3 pl-1">
        <h2 className="mr-auto text-title font-medium text-ink">Vorschau</h2>
        <Switch checked={showWhitespace} onChange={setShowWhitespace} label="Leerzeichen anzeigen" />
        <IconButton label="Vorschau ausblenden" shortcut={SHORTCUT_KEYS.preview} side="bottom-end" onClick={onHide}>
          <SidebarSimpleIcon size={17} style={{ transform: 'scaleX(-1)' }} />
        </IconButton>
      </div>
      {BLOCKS.map((meta, i) => (
        <BlockCard
          key={meta.block}
          meta={meta}
          text={blocks[meta.block]}
          found={copier.sensitive[meta.block]}
          copied={copier.copiedBlock === meta.block}
          onCopy={() => copier.copy(i)}
          showWhitespace={showWhitespace}
        />
      ))}
    </section>
  )
}

/** With the preview hidden: the three copy buttons and the warning in a slim bar */
export function CopyBar({ blocks, copier, onShow }) {
  const flagged = BLOCKS.filter((b) => copier.sensitive[b.block].length > 0)

  // Toasts sit above the bar while it is shown — also when it wraps into two
  // rows (toast.jsx reads the variable)
  const barRef = useRef(null)
  useEffect(() => {
    const root = document.documentElement
    const bar = barRef.current
    const place = () => root.style.setProperty('--toast-bottom', `${(bar?.offsetHeight ?? 48) + 16}px`)
    place()
    const observer = new ResizeObserver(place)
    if (bar) observer.observe(bar)
    return () => {
      observer.disconnect()
      root.style.removeProperty('--toast-bottom')
    }
  }, [])

  return (
    <div
      ref={barRef}
      data-copybar
      className="@container/bar flex flex-wrap items-center gap-2 border-t border-line bg-sidebar px-6 py-2.5"
    >
      {BLOCKS.map((meta, i) => {
        const warn = copier.sensitive[meta.block].length > 0
        const copied = copier.copiedBlock === meta.block
        return (
          <Button
            key={meta.block}
            size="sm"
            data-copy={meta.block}
            variant={warn ? 'warning' : 'secondary'}
            disabled={!blocks[meta.block]}
            onClick={() => copier.copy(i)}
            aria-label={`${meta.title} ${warn ? 'trotzdem ' : ''}kopieren`}
          >
            {copied ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
            <span className="tabular-nums">{meta.number}</span> {meta.short}
            <span className="ml-1 hidden @3xl/bar:inline">
              <Kbd keys={SHORTCUT_KEYS.copy[i]} />
            </span>
          </Button>
        )
      })}
      {flagged.length > 0 && (
        <span className="flex items-center gap-1.5 text-meta text-ink" role="status">
          <WarningIcon size={15} className="text-warn" />
          Mögliche Kundendaten in Block {flagged.map((b) => b.number).join(' und ')}
        </span>
      )}
      <span className="ml-auto">
        <IconButton label="Vorschau einblenden" shortcut={SHORTCUT_KEYS.preview} side="top-end" onClick={onShow}>
          <SidebarSimpleIcon size={17} style={{ transform: 'scaleX(-1)' }} />
        </IconButton>
      </span>
    </div>
  )
}
