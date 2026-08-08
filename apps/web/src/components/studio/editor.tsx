'use client'

import type { ArticleStatus } from '@kurasikapa/domain'
import { useState } from 'react'
import { updateDraftAction } from '../../actions/editorial'
import { AiPanel } from './ai-panel'
import { EditorFields } from './editor-fields'
import { SaveIndicator } from './save-indicator'
import { useAutosave } from './use-autosave'

export interface EditorProps {
  readonly articleId: string
  readonly initialTitle: string
  readonly initialBody: string
  readonly status: ArticleStatus
  readonly editable: boolean
  readonly locale: string
}


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
      <EditorFields
        title={title}
        body={body}
        editable={props.editable}
        onTitle={(value) => {
          edit(setTitle, value)
        }}
        onBody={(value) => {
          edit(setBody, value)
        }}
      />

      <SaveIndicator save={autosave} editable={props.editable} />

      {props.editable && (
        <AiPanel
          title={title}
          body={body}
          locale={props.locale}
          onUseHeadline={(headline) => {
            // Straight into the editor's own field. It then saves like any
            // other edit — there is no path from a model to a published page
            // that skips the person. ADR-0005.
            edit(setTitle, headline)
          }}
        />
      )}
    </div>
  )
}
