// The three output blocks as they get copied. (Rebuilt in step 11.7b:
// line count, "Leerzeichen anzeigen", privacy check, hide → copy bar.)
import { Fragment, useState } from 'react'
import { CopyIcon, CheckIcon, FileArrowDownIcon } from '@phosphor-icons/react'
import { api } from '../../store.jsx'
import { Button, IconButton, Panel, SectionTitle } from '../../ui/basics.jsx'
import { showToast } from '../../ui/toast.jsx'

// Detects day headers like "Montag, den 20.04.2026:"
const IS_DAY_HEADER = /, den \d{2}\.\d{2}\.\d{4}:$/

// Quiet coloring of the preview. Rendering only — the copied text stays exact.
function OutputPreview({ text }) {
  if (!text) return <span className="text-ink-2">leer</span>
  const lines = text.split('\n')
  return lines.map((line, i) => {
    const nl = i < lines.length - 1 ? '\n' : ''
    let el
    if (IS_DAY_HEADER.test(line)) el = <span className="font-medium text-ink">{line}</span>
    else if (line.length > 1 && line.endsWith(':')) el = <span className="font-medium text-ink">{line}</span>
    else el = <span className="text-ink">{line}</span>
    return (
      <Fragment key={i}>
        {el}
        {nl}
      </Fragment>
    )
  })
}

// `block` = key in formatAll() — also the end-to-end tests' hook (data-output)
export function OutputBlock({ block, title, shortName, text, fileName }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    showToast(`„${shortName}" kopiert`)
    setTimeout(() => setCopied(false), 1600)
  }

  const exportTxt = async () => {
    const res = await api.exportText(fileName, text)
    if (res?.ok) showToast('Als .txt gespeichert')
    else if (res && !res.canceled) showToast(res.error ?? 'Export fehlgeschlagen', { kind: 'error' })
  }

  return (
    <Panel data-output={block} className="flex shrink-0 flex-col">
      <div className="flex items-center gap-1.5 border-b border-line py-2 pl-4 pr-2">
        <SectionTitle className="mr-auto">{title}</SectionTitle>
        <IconButton label="Als .txt exportieren" onClick={exportTxt} disabled={!text}>
          <FileArrowDownIcon size={16} />
        </IconButton>
        <Button size="sm" variant={copied ? 'primary' : 'secondary'} onClick={copy} disabled={!text} className="w-24">
          {copied ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
          {copied ? 'Kopiert' : 'Kopieren'}
        </Button>
      </div>
      <pre className="selectable min-h-[52px] overflow-auto whitespace-pre-wrap px-4 py-3 font-mono text-[12.5px] leading-5">
        <OutputPreview text={text} />
      </pre>
    </Panel>
  )
}

export const BLOCKS = [
  { block: 'work', title: '1 · Betriebliche Tätigkeiten', shortName: 'Betriebliche Tätigkeiten', fileName: '1Betriebliche Tätigkeiten.txt' },
  { block: 'instructions', title: '2 · Unterweisungen', shortName: 'Unterweisungen', fileName: '2Unterweisungen, betrieblicher Unterricht, sonstige Schulungen.txt' },
  { block: 'school', title: '3 · Berufsschule', shortName: 'Berufsschule', fileName: '3Berufsschule (Unterrichtsthemen).txt' },
]

export default function Preview({ blocks }) {
  return (
    <div className="flex flex-col gap-3">
      {BLOCKS.map((b) => (
        <OutputBlock key={b.block} {...b} text={blocks[b.block]} />
      ))}
    </div>
  )
}
