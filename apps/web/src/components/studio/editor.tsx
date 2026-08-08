'use client'

import type { ArticleStatus } from '@kurasikapa/domain'
import { useState } from 'react'
import { updateDraftAction } from '../../actions/editorial'
import { SaveIndicator } from './save-indicator'
import { useAutosave } from './use-autosave'

export interface EditorProps {
  readonly articleId: string
  readonly initialTitle: string
  readonly initialBody: string
  readonly status: ArticleStatus
  readonly editable: boolean
}

const FIELD =
  'border-outline-variant focus:border-secondary bg-surface-container-lowest text-on-surface rounded border px-3 py-2 outline-none transition-colors disabled:opacity-60'

export function Editor(props: EditorProps): React.ReactElement {
  const [title, setTitle] = useState(props.initialTitle)
  const [body, setBody] = useState(props.initialBody)

  const autosave = useAutosave(
    () => updateDraftAction({ articleId: props.articleId, title, body }),
    props.editable,
    // \u0000 cannot appear in either field, so no title/body pair can collide
    // with another and suppress a save.
    `${title}\u0000${body}`,
  )

  const edit = <T,>(setter: (value: T) => void, value: T): void => {
    autosave.touch()
    setter(value)
  }

  return (
    <div className="flex flex-col gap-[var(--spacing-md)]">
      <label className="flex flex-col gap-2">
        <span className="text-label-bold text-on-surface-variant uppercase">Headline</span>
        <input
          value={title}
          disabled={!props.editable}
          onChange={(e) => {
            edit(setTitle, e.target.value)
          }}
          className={`${FIELD} font-display text-[length:var(--text-headline-sm)]`}
        />
      </label>

      <label className="flex flex-col gap-2">
        <span className="text-label-bold text-on-surface-variant uppercase">Body — Markdown</span>
        <textarea
          value={body}
          rows={24}
          disabled={!props.editable}
          onChange={(e) => {
            edit(setBody, e.target.value)
          }}
          className={`${FIELD} font-mono text-sm leading-relaxed`}
        />
      </label>

      <SaveIndicator save={autosave} editable={props.editable} />
    </div>
  )
}
