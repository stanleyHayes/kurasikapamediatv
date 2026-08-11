'use client'

import { useRef } from 'react'
import { MarkdownToolbar } from './markdown-toolbar'

const FIELD =
  'border-outline-variant focus:border-secondary bg-surface-container-lowest text-on-surface rounded border px-3 py-2 outline-none transition-colors disabled:opacity-60'

export function EditorFields({
  title,
  body,
  editable,
  onTitle,
  onBody,
}: {
  title: string
  body: string
  editable: boolean
  onTitle: (value: string) => void
  onBody: (value: string) => void
}): React.ReactElement {
  const textarea = useRef<HTMLTextAreaElement>(null)

  return (
    <>
      <label className="flex flex-col gap-2">
        <span className="text-label-bold text-on-surface-variant uppercase">Headline</span>
        <input
          value={title}
          disabled={!editable}
          onChange={(e) => {
            onTitle(e.target.value)
          }}
          className={`${FIELD} font-display text-[length:var(--text-headline-sm)]`}
        />
      </label>

      <label className="flex flex-col gap-2">
        <span className="text-label-bold text-on-surface-variant uppercase">Body — Markdown</span>
        <MarkdownToolbar body={body} editable={editable} textarea={textarea} onBody={onBody} />
        <textarea
          ref={textarea}
          value={body}
          rows={24}
          disabled={!editable}
          onChange={(e) => {
            onBody(e.target.value)
          }}
          className={`${FIELD} font-mono text-sm leading-relaxed`}
        />
      </label>
    </>
  )
}
