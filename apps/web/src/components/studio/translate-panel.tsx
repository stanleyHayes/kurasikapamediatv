'use client'

import { useState, useTransition } from 'react'
import { callAction } from '../../actions/call'
import { translateAction } from '../../actions/ai'
import { createDraftAction } from '../../actions/editorial'

const OTHER_LOCALE: Readonly<Record<string, string>> = { en: 'fr', fr: 'en' }
const LOCALE_NAME: Readonly<Record<string, string>> = { en: 'English', fr: 'French' }

interface Proposal {
  readonly title: string
  readonly body: string
}

export interface TranslatePanelProps {
  readonly title: string
  readonly body: string
  readonly locale: string
  readonly familyId: string
  readonly categoryId: string
}

interface Translation {
  readonly proposal: Proposal | null
  readonly error: string | null
  readonly createdSlug: string | null
  readonly pending: boolean
  readonly propose: () => void
  readonly accept: () => void
}

/**
 * The two-step flow, kept out of the component so the component is layout.
 *
 * Propose then accept, never one call. Product rule 1: no AI output is
 * persisted without a named human approver, and collapsing these into a single
 * button is exactly how that rule gets lost to convenience.
 */
function useTranslation(props: TranslatePanelProps, target: string): Translation {
  const [proposal, setProposal] = useState<Proposal | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [createdSlug, setCreatedSlug] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const propose = (): void => {
    setError(null)
    setCreatedSlug(null)

    startTransition(async () => {
      const result = await callAction(() =>
        translateAction({
        title: props.title,
        body: props.body,
        locale: props.locale,
          targetLocale: target,
        }),
      )

      if (result.ok) {
        setProposal({ title: result.data.title, body: result.data.body })

        return
      }

      setError(result.error.message)
    })
  }

  const accept = (): void => {
    if (proposal === null) return
    setError(null)

    startTransition(async () => {
      const result = await callAction(() =>
        createDraftAction({
        locale: target,
        title: proposal.title,
        body: proposal.body,
        categoryId: props.categoryId,
        // The family is what joins the translations. Without it this would be
        // an unrelated article that merely happens to say the same thing.
          familyId: props.familyId,
        }),
      )

      if (result.ok) {
        setCreatedSlug(result.data.slug)
        setProposal(null)

        return
      }

      setError(result.error.message)
    })
  }

  return { proposal, error, createdSlug, pending, propose, accept }
}

/**
 * Translating an article into its other locale.
 *
 * The model proposes; the editor reads it and decides. That second step is
 * product rule 1 — no AI output is persisted or published without a named
 * human approver — and it is what keeps a newsroom's name off a sentence
 * nobody checked.
 *
 * The result is a NEW draft in the same family, never an edit of the original.
 * "Locale is data": the French article is its own document with its own slug,
 * byline and publish state. That is also what makes this safe to get wrong —
 * a bad translation is a draft nobody published, not a corrupted article.
 */
export function TranslatePanel(props: TranslatePanelProps): React.ReactElement {
  const target = OTHER_LOCALE[props.locale] ?? 'fr'
  const { proposal, error, createdSlug, pending, propose, accept } = useTranslation(props, target)

  return (
    <section className="border-outline-variant/50 bg-surface-container-low rounded-xl border p-5">
      <h3 className="font-display text-on-surface mb-1 text-lg font-semibold">Translate</h3>
      <p className="text-on-surface-variant mb-4 text-sm">
        Proposes a {LOCALE_NAME[target] ?? target} version. Nothing is saved until you accept it.
      </p>

      <button
        type="button"
        onClick={propose}
        disabled={pending || props.body.trim() === ''}
        className="border-outline-variant text-label-bold text-on-surface w-full rounded-lg border px-4 py-2 uppercase disabled:opacity-50"
      >
        {pending && proposal === null ? 'Translating…' : `Propose ${LOCALE_NAME[target] ?? target}`}
      </button>

      {proposal !== null && (
        <ProposalReview proposal={proposal} pending={pending} onAccept={accept} />
      )}

      {createdSlug !== null && (
        <p role="status" className="text-secondary mt-3 text-sm">
          Draft created: {createdSlug}. It is a draft — review and submit it like any other.
        </p>
      )}

      {error !== null && (
        <p role="alert" className="text-error mt-3 text-sm">
          {error}
        </p>
      )}
    </section>
  )
}

/**
 * The review step, read-only.
 *
 * Corrections happen after acceptance, in the editor, where autosave and
 * revision history already apply. Making this box editable would mean a second
 * place to write article text whose edits are not versioned — and the whole
 * point of accepting into a draft is that everything after it follows the
 * normal path.
 */
function ProposalReview({
  proposal,
  pending,
  onAccept,
}: {
  proposal: Proposal
  pending: boolean
  onAccept: () => void
}): React.ReactElement {
  return (
    <div className="mt-4 flex flex-col gap-3">
      <div>
        <span className="text-label-bold text-on-surface-variant uppercase">Proposed headline</span>
        <p className="font-display text-on-surface mt-1 text-lg">{proposal.title}</p>
      </div>

      <div>
        <span className="text-label-bold text-on-surface-variant uppercase">Proposed text</span>
        <p className="text-on-surface-variant border-outline-variant/40 mt-1 max-h-48 overflow-y-auto rounded border p-3 text-sm whitespace-pre-wrap">
          {proposal.body}
        </p>
      </div>

      <button
        type="button"
        onClick={onAccept}
        disabled={pending}
        className="bg-secondary-container text-on-secondary-container text-label-bold rounded-lg px-4 py-2 uppercase disabled:opacity-50"
      >
        {pending ? 'Creating…' : 'Accept and create draft'}
      </button>
    </div>
  )
}
