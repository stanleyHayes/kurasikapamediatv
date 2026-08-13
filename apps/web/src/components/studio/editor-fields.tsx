'use client'

import { useRef, useState } from 'react'
import { MarkdownToolbar } from './markdown-toolbar'
import { RichTextEditor } from './rich-text-editor'

const FIELD =
  'border-outline-variant focus:border-secondary bg-surface-container-lowest text-on-surface rounded border px-3 py-2 outline-none transition-colors disabled:opacity-60'

const TOGGLE = 'rounded border px-2 py-1 text-xs uppercase'

type BodyMode = 'rich' | 'source'

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

      <BodyField body={body} editable={editable} onBody={onBody} />
    </>
  )
}

/**
 * The body in two modes over ONE markdown string: the rich surface for
 * writing, the source textarea for the constructs the rich surface does not
 * render. Both call the same onBody, so autosave and the co-pilot see no
 * difference between them — the toggle chooses a view, never a format.
 *
 * Rich is the default because that is the PRD's promise to editors; source
 * stays one click away because markdown is the storage format and some
 * bodies will always need it.
 */
function BodyField({
  body,
  editable,
  onBody,
}: {
  body: string
  editable: boolean
  onBody: (value: string) => void
}): React.ReactElement {
  const textarea = useRef<HTMLTextAreaElement>(null)
  const [mode, setMode] = useState<BodyMode>('rich')

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-label-bold text-on-surface-variant uppercase">Body — Markdown</span>
        <div className="flex gap-1" role="group" aria-label="Body editing mode">
          <ModeButton
            label="Write rich"
            active={mode === 'rich'}
            onClick={() => {
              setMode('rich')
            }}
          />
          <ModeButton
            label="Markdown source"
            active={mode === 'source'}
            onClick={() => {
              setMode('source')
            }}
          />
        </div>
      </div>

      {mode === 'rich' ? (
        <RichTextEditor body={body} editable={editable} onBody={onBody} />
      ) : (
        <SourceEditor body={body} editable={editable} textarea={textarea} onBody={onBody} />
      )}
    </div>
  )
}

/** The pre-existing textarea mode, unchanged apart from living in a toggle. */
function SourceEditor({
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
  return (
    <>
      <MarkdownToolbar body={body} editable={editable} textarea={textarea} onBody={onBody} />
      <textarea
        ref={textarea}
        value={body}
        rows={24}
        disabled={!editable}
        aria-label="Body markdown source"
        onChange={(e) => {
          onBody(e.target.value)
        }}
        className={`${FIELD} font-mono text-sm leading-relaxed`}
      />
    </>
  )
}

function ModeButton({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}): React.ReactElement {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`${TOGGLE} ${
        active
          ? 'border-secondary text-secondary'
          : 'border-outline-variant text-on-surface-variant hover:border-secondary'
      }`}
    >
      {label}
    </button>
  )
}
