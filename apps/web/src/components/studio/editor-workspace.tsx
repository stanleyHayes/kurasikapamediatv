'use client'

import type { ArticleStatus } from '@kurasikapa/domain'
import { useState } from 'react'
import { updateDraftAction } from '../../actions/editorial'
import { callAction } from '../../actions/call'
import { Copilot } from './copilot'
import { EditorFields } from './editor-fields'
import type { RevisionView } from './revision-history'
import { SaveIndicator } from './save-indicator'
import { useAutosave } from './use-autosave'

export interface EditorWorkspaceProps {
  readonly articleId: string
  readonly initialTitle: string
  readonly initialBody: string
  readonly status: ArticleStatus
  readonly editable: boolean
  /** The article's own locale, which drives translation. */
  readonly articleLocale: string
  readonly familyId: string
  readonly categoryId: string
  readonly revisions: readonly RevisionView[]
  /** The UI locale, which drives date formatting. */
  readonly uiLocale: string
}

/**
 * The two-pane editor from the Stitch AI content-editor design: the writing
 * surface on the left, the co-pilot rail on the right.
 *
 * The draft's title and body live HERE rather than inside the editor pane,
 * which is the whole reason this component exists. Accepting a generated
 * headline has to reach the same state autosave watches — with the state one
 * level down, the assist panel could only live inside the editor pane, and the
 * design's rail could never hold it.
 *
 * Lifting it changes no behaviour: acceptance still writes into the field and
 * saves like any other edit. There is no path from a model to a published page
 * that skips the person. ADR-0005, product rule 1.
 */
export function EditorWorkspace(props: EditorWorkspaceProps): React.ReactElement {
  const [title, setTitle] = useState(props.initialTitle)
  const [body, setBody] = useState(props.initialBody)

  const autosave = useAutosave(
    () => callAction(() => updateDraftAction({ articleId: props.articleId, title, body })),
    props.editable,
    // \u0000 cannot appear in either field, so no title/body pair can collide
    // with another and suppress a save.
    `${title}\u0000${body}`,
  )

  const edit = <T,>(setter: (value: T) => void, value: T): void => {
    autosave.touch()
    setter(value)
  }

  const onHeadline = (headline: string): void => {
    edit(setTitle, headline)
  }

  const onBody = (next: string): void => {
    edit(setBody, next)
  }

  return (
    <div className="grid min-h-[70vh] grid-cols-1 gap-6 lg:grid-cols-12">
      <div className="flex flex-col gap-[var(--spacing-md)] lg:col-span-8">
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
      </div>

      <div className="lg:col-span-4">
        <Copilot {...copilotProps(props, { title, body, onHeadline, onBody })} />
      </div>
    </div>
  )
}

/**
 * Assembles the rail's three panels from the workspace's own state.
 *
 * Lifted out of the component only for size — the binding it expresses is the
 * point of this file: the assist panel writes a headline into the SAME state
 * autosave watches, which is what a rail separated from the editor could not
 * do before.
 */
interface Draft {
  readonly title: string
  readonly body: string
  readonly onHeadline: (headline: string) => void
  readonly onBody: (body: string) => void
}

function copilotProps(
  props: EditorWorkspaceProps,
  draft: Draft,
): React.ComponentProps<typeof Copilot> {
  const { title, body } = draft

  return {
    assist: {
      title,
      body,
      locale: props.articleLocale,
      editable: props.editable,
      onUseHeadline: draft.onHeadline,
    },
    generate: {
      locale: props.articleLocale,
      editable: props.editable,
      currentBody: body,
      onUseBody: draft.onBody,
    },
    translate: {
      title,
      body,
      locale: props.articleLocale,
      familyId: props.familyId,
      categoryId: props.categoryId,
    },
    history: {
      articleId: props.articleId,
      revisions: props.revisions,
      locale: props.uiLocale,
      editable: props.editable,
    },
  }
}
