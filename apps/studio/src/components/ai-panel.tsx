'use client'

import { useState, useTransition } from 'react'
import { type Suggestion, SuggestionList } from './suggestion-list'
import { ASSISTS, LABEL, type Assist } from './assists'

export interface AiPanelProps {
  readonly title: string
  readonly body: string
  readonly locale: string
  /** Called when the editor accepts a headline. Acceptance is theirs alone. */
  readonly onUseHeadline: (headline: string) => void
  /**
   * False once an article leaves draft. Suggestions stay readable, but
   * accepting one would write into a field the domain refuses to change.
   */
  readonly editable: boolean
}

/**
 * AI assists for the editor.
 *
 * Everything here is a proposal. Nothing writes to the article — accepting a
 * headline puts it in the editor's own field, where it saves like any other
 * edit. That is ADR-0005 made structural: there is no code path from a model's
 * output to a published page that does not pass through a person.
 */
export function AiPanel(props: AiPanelProps): React.ReactElement {
  const [active, setActive] = useState<Assist | null>(null)
  const [items, setItems] = useState<readonly Suggestion[]>([])
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const run = (assist: Assist): void => {
    setActive(assist)
    setItems([])
    setError(null)

    startTransition(async () => {
      const ctx = { title: props.title, body: props.body, locale: props.locale }
      const result = await ASSISTS[assist](ctx)

      if (!result.ok) {
        setError(result.error.message)
        return
      }

      setItems(result.data)
    })
  }

  return (
    <aside className="border-outline-variant rounded-lg border p-[var(--spacing-sm)]">
      <h2 className="text-label-bold text-secondary uppercase">AI assist</h2>
      <p className="text-on-surface-variant mt-1 text-sm">
        Suggestions only. Nothing is applied until you apply it.
      </p>

      <AssistButtons disabled={pending || !props.editable || props.body.trim() === ''} onRun={run} />

      <AssistResults
        pending={pending}
        error={error}
        ran={active !== null}
        items={items}
        onApply={props.onUseHeadline}
      />
    </aside>
  )
}

/**
 * One place decides what the results region shows.
 *
 * Four states — thinking, failed, empty, and results — read as a sequence here
 * rather than as four conditionals tangled into the panel's own render.
 */
function AssistResults(props: {
  pending: boolean
  error: string | null
  ran: boolean
  items: readonly Suggestion[]
  onApply: (text: string) => void
}): React.ReactElement {
  const body = (): React.ReactElement | null => {
    if (props.pending) return <p className="text-on-surface-variant text-sm">Thinking…</p>
    if (props.error !== null) return <p className="text-error text-sm">{props.error}</p>
    if (props.items.length > 0) {
      return <SuggestionList items={props.items} onApply={props.onApply} />
    }
    if (props.ran) return <p className="text-on-surface-variant text-sm">No suggestions came back.</p>

    return null
  }

  return (
    <div aria-live="polite" className="mt-[var(--spacing-sm)]">
      {body()}
    </div>
  )
}

function AssistButtons({
  disabled,
  onRun,
}: {
  disabled: boolean
  onRun: (assist: Assist) => void
}): React.ReactElement {
  return (
    <div className="mt-[var(--spacing-sm)] flex flex-wrap gap-2">
      {(Object.keys(ASSISTS) as Assist[]).map((assist) => (
        <button
          key={assist}
          type="button"
          disabled={disabled}
          onClick={() => {
            onRun(assist)
          }}
          className="border-outline-variant text-label-bold rounded border px-3 py-1 uppercase disabled:opacity-50"
        >
          {LABEL[assist]}
        </button>
      ))}
    </div>
  )
}
