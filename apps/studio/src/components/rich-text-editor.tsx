'use client'

import { useEffect, useRef } from 'react'
import { htmlToMarkdown, markdownToHtml } from './rich-text-markdown'
import { RichTextToolbar } from './rich-text-toolbar'

const SURFACE =
  'border-outline-variant focus-within:border-secondary bg-surface-container-lowest text-on-surface min-h-[32rem] rounded border px-3 py-2 leading-relaxed outline-none transition-colors'

/**
 * The WYSIWYG half of the body field.
 *
 * The surface is uncontrolled on purpose: a contenteditable re-rendered from
 * props on every keystroke loses the caret. Instead the div owns its DOM
 * while it is being typed in, serialises to Markdown on every input, and
 * only re-renders from props when the body changed somewhere else — the
 * co-pilot accepting a rewrite, or the mode toggle coming back from source.
 * `emitted` is how the two are told apart: it holds the Markdown this
 * surface last sent up, so a parent echoing that same value back is not a
 * reason to rebuild the DOM mid-word.
 *
 * HTML never leaves this file. What reaches `onBody` is the same Markdown
 * the textarea mode would have produced, into the same state autosave
 * watches.
 */
export function RichTextEditor({
  body,
  editable,
  onBody,
}: {
  body: string
  editable: boolean
  onBody: (value: string) => void
}): React.ReactElement {
  const surface = useRef<HTMLDivElement>(null)
  const emitted = useRef<string | null>(null)

  useEffect(() => {
    const el = surface.current
    if (el === null || emitted.current === body) return

    el.innerHTML = markdownToHtml(body)
    emitted.current = body
  }, [body])

  const emit = (): void => {
    const el = surface.current
    if (el === null) return

    const next = htmlToMarkdown(el.innerHTML)
    emitted.current = next
    onBody(next)
  }

  return (
    <>
      <RichTextToolbar editable={editable} surface={surface} onApplied={emit} />
      <div
        ref={surface}
        contentEditable={editable}
        suppressContentEditableWarning
        role="textbox"
        aria-label="Body"
        aria-multiline
        aria-readonly={!editable}
        onInput={emit}
        className={`${SURFACE} ${editable ? '' : 'opacity-60'}`}
      />
    </>
  )
}
