'use client'

import { prefixLine, wrapSelection, type Caret } from '../content-wrap-selection'

const BTN =
  'border-outline-variant text-on-surface-variant hover:border-secondary rounded border px-2 py-1 text-xs uppercase disabled:opacity-40'

/**
 * Inserts Markdown marks around the textarea selection. The body remains
 * plain text; the public renderer is the only place marks become elements.
 */
export function MarkdownToolbar({
  body,
  editable,
  textarea,
  onBody,
}: {
  body: string
  editable: boolean
  textarea: React.RefObject<HTMLTextAreaElement | null>
  onBody: (value: string) => void
}): React.ReactElement {
  const apply = (next: { next: string; start: number; end: number }): void => {
    onBody(next.next)
    restore(textarea.current, next)
  }

  return (
    <div className="flex flex-wrap gap-1" role="toolbar" aria-label="Markdown">
      <Mark
        label="Bold"
        disabled={!editable}
        onClick={() => {
          apply(wrapSelection(body, caretOf(textarea.current), { open: '**', close: '**' }))
        }}
      />
      <Mark
        label="Italic"
        disabled={!editable}
        onClick={() => {
          apply(wrapSelection(body, caretOf(textarea.current), { open: '*', close: '*' }))
        }}
      />
      <Mark
        label="Heading"
        disabled={!editable}
        onClick={() => {
          apply(prefixLine(body, caretOf(textarea.current), '## '))
        }}
      />
      <Mark
        label="Link"
        disabled={!editable}
        onClick={() => {
          apply(wrapSelection(body, caretOf(textarea.current), { open: '[', close: '](https://)' }))
        }}
      />
    </div>
  )
}

function Mark({
  label,
  disabled,
  onClick,
}: {
  label: string
  disabled: boolean
  onClick: () => void
}): React.ReactElement {
  return (
    <button type="button" className={BTN} disabled={disabled} onClick={onClick}>
      {label}
    </button>
  )
}

function caretOf(el: HTMLTextAreaElement | null): Caret {
  return { start: el?.selectionStart ?? 0, end: el?.selectionEnd ?? 0 }
}

function restore(el: HTMLTextAreaElement | null, range: Caret): void {
  requestAnimationFrame(() => {
    el?.focus()
    el?.setSelectionRange(range.start, range.end)
  })
}
