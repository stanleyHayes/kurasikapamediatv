'use client'

import { useState } from 'react'

const BUTTON = 'grid min-h-9 min-w-9 place-items-center border border-transparent px-2 text-xs font-bold text-on-surface-variant hover:border-outline-variant hover:bg-surface-container aria-pressed:border-secondary aria-pressed:bg-secondary-container aria-pressed:text-on-secondary-container disabled:opacity-35'

interface ToolbarProps { readonly editable: boolean; readonly surface: React.RefObject<HTMLDivElement | null>; readonly onApplied: () => void }

export function RichTextToolbar({ editable, surface, onApplied }: ToolbarProps): React.ReactElement {
  const [linkOpen, setLinkOpen] = useState(false)
  const apply = (command: string, value?: string): void => {
    surface.current?.focus()
    // eslint-disable-next-line @typescript-eslint/no-deprecated -- safe DOM command; output is immediately normalised back to Markdown.
    document.execCommand(command, false, value)
    onApplied()
  }
  return <div className="relative flex flex-wrap items-center gap-1 border border-b-0 border-outline-variant bg-surface-container-lowest p-2" role="toolbar" aria-label="Formatting">
    <Tool label="Undo" icon="↶" disabled={!editable} onClick={() => { apply('undo') }}/><Tool label="Redo" icon="↷" disabled={!editable} onClick={() => { apply('redo') }}/><Divider />
    <BlockStyle disabled={!editable} apply={apply}/><Divider />
    <Tool label="Bold" icon="B" disabled={!editable} onClick={() => { apply('bold') }} className="font-black"/><Tool label="Italic" icon="I" disabled={!editable} onClick={() => { apply('italic') }} className="italic"/><Tool label="Inline code" icon="<>" disabled={!editable} onClick={() => { apply('formatBlock', 'pre') }}/><Divider />
    <Tool label="Bulleted list" icon="•≡" disabled={!editable} onClick={() => { apply('insertUnorderedList') }}/><Tool label="Numbered list" icon="1≡" disabled={!editable} onClick={() => { apply('insertOrderedList') }}/><Divider />
    <Tool label="Add link" icon="↗" disabled={!editable} pressed={linkOpen} onClick={() => { setLinkOpen((open) => !open) }}/>
    {linkOpen && (
      <LinkPanel
        onCancel={() => { setLinkOpen(false) }}
        onApply={(url) => { apply('createLink', url); setLinkOpen(false) }}
      />
    )}
  </div>
}

function BlockStyle({ disabled, apply }: { disabled: boolean; apply: (command: string, value?: string) => void }): React.ReactElement {
  const [open, setOpen] = useState(false)
  const options = [['Paragraph', 'p'], ['Heading 1', 'h1'], ['Heading 2', 'h2'], ['Heading 3', 'h3']] as const
  return <div className="relative"><button type="button" disabled={disabled} aria-expanded={open} onClick={() => { setOpen((value) => !value) }} className={`${BUTTON} min-w-28 justify-between gap-3`}>Text style <span>⌄</span></button>{open && <div className="absolute left-0 top-full z-20 mt-1 min-w-44 border border-outline-variant bg-surface-container-lowest p-1 shadow-xl">{options.map(([label, tag]) => <button key={tag} type="button" className="block w-full px-3 py-2 text-left text-sm font-semibold text-on-surface hover:bg-surface-container" onClick={() => { apply('formatBlock', tag); setOpen(false) }}>{label}</button>)}</div>}</div>
}

function LinkPanel({ onApply, onCancel }: { onApply: (url: string) => void; onCancel: () => void }): React.ReactElement {
  const [url, setUrl] = useState('https://')
  return <div className="absolute left-2 top-full z-30 mt-2 w-[min(24rem,calc(100vw-3rem))] border-t-4 border-secondary bg-inverse-surface p-4 text-white shadow-2xl"><label className="text-xs font-bold uppercase tracking-wider">Link address<input autoFocus value={url} onChange={(event) => { setUrl(event.target.value) }} className="mt-2 h-11 w-full border border-white/20 bg-white px-3 text-on-surface outline-none focus:border-secondary"/></label><div className="mt-3 flex gap-2"><button type="button" onClick={() => { onApply(url) }} className="bg-secondary px-4 py-2 text-xs font-bold text-on-secondary">Apply link</button><button type="button" onClick={onCancel} className="border border-white/25 px-4 py-2 text-xs font-bold">Cancel</button></div></div>
}

function Tool({ label, icon, disabled, onClick, pressed, className = '' }: { label: string; icon: string; disabled: boolean; onClick: () => void; pressed?: boolean; className?: string }): React.ReactElement {
  return <button type="button" title={label} aria-label={label} aria-pressed={pressed} disabled={disabled} onMouseDown={(event) => { event.preventDefault() }} onClick={onClick} className={`${BUTTON} ${className}`}>{icon}</button>
}

function Divider(): React.ReactElement { return <span aria-hidden className="mx-1 h-6 w-px bg-outline-variant"/> }
