'use client'

import { useLocale } from 'next-intl'
import { useState, useTransition } from 'react'
import { callAction } from '../../actions/call'
import { proposeSocialCaptionAction } from '../../actions/side-actions'
import { proposeSocialSummaryAction } from '../../actions/social'

const FIELD =
  'border-outline-variant bg-surface-container-lowest text-on-surface rounded-lg border px-3 py-2'

const formatProposal = (caption: string, hashtags: readonly string[]): string => {
  const tags = hashtags.map((tag) => `#${tag}`).join(' ')
  return `${caption}${tags === '' ? '' : `\n\n${tags}`}`
}

/**
 * Caption textarea plus AI propose buttons.
 *
 * Both AI results are proposals (ADR-0005). A suggested caption fills the
 * field for the editor to edit; a summary waits beside the field until the
 * editor explicitly accepts it. Neither is queued on its own.
 */
export function CaptionField({
  articleId,
  platform,
}: {
  articleId: string
  platform: 'facebook' | 'instagram'
}): React.ReactElement {
  const s = useCaptionProposals(articleId, platform)

  return (
    <div className="flex flex-col gap-2">
      <CaptionTextarea value={s.caption} onChange={s.setCaption} />
      <div className="flex gap-4">
        <button
          type="button"
          disabled={s.pendingCaption || articleId === ''}
          onClick={s.suggestCaption}
          className="text-label-bold text-secondary self-start uppercase disabled:opacity-50"
        >
          {s.pendingCaption ? 'Proposing…' : 'Suggest caption'}
        </button>
        <button
          type="button"
          disabled={s.pendingSummary || articleId === ''}
          onClick={s.summarise}
          className="text-label-bold text-secondary self-start uppercase disabled:opacity-50"
        >
          {s.pendingSummary ? 'Summarising…' : 'Short summary'}
        </button>
      </div>
      {s.summary !== null && (
        <SummaryProposal text={s.summary} onAccept={s.acceptSummary} onDismiss={s.dismissSummary} />
      )}
      {s.error !== null && (
        <p role="alert" className="text-error text-sm">
          {s.error}
        </p>
      )}
    </div>
  )
}

interface CaptionProposals {
  readonly caption: string
  readonly setCaption: (value: string) => void
  readonly summary: string | null
  readonly error: string | null
  readonly pendingCaption: boolean
  readonly pendingSummary: boolean
  readonly suggestCaption: () => void
  readonly summarise: () => void
  readonly acceptSummary: () => void
  readonly dismissSummary: () => void
}

function useCaptionProposals(
  articleId: string,
  platform: 'facebook' | 'instagram',
): CaptionProposals {
  const locale = useLocale()
  const [caption, setCaption] = useState('')
  const [summary, setSummary] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pendingCaption, startCaption] = useTransition()
  const [pendingSummary, startSummary] = useTransition()

  const suggestCaption = (): void => {
    setError(null)
    startCaption(async () => {
      const result = await callAction(() => proposeSocialCaptionAction({ articleId, platform }))
      if (!result.ok) setError(result.error.message)
      else setCaption(formatProposal(result.data.caption, result.data.hashtags))
    })
  }

  const summarise = (): void => {
    setError(null)
    startSummary(async () => {
      const result = await callAction(() => proposeSocialSummaryAction({ articleId, locale }))
      if (!result.ok) setError(result.error.message)
      else setSummary(result.data.short)
    })
  }

  const acceptSummary = (): void => {
    if (summary !== null) setCaption(summary)
    setSummary(null)
  }

  return {
    caption,
    setCaption,
    summary,
    error,
    pendingCaption,
    pendingSummary,
    suggestCaption,
    summarise,
    acceptSummary,
    dismissSummary: () => {
      setSummary(null)
    },
  }
}

/** A proposed summary the editor may accept into the caption — or discard. */
function SummaryProposal({
  text,
  onAccept,
  onDismiss,
}: {
  text: string
  onAccept: () => void
  onDismiss: () => void
}): React.ReactElement {
  return (
    <div className="border-outline-variant/50 bg-surface-container-low flex flex-col gap-2 rounded-lg border p-3">
      <p className="text-on-surface text-sm">{text}</p>
      <div className="flex gap-4">
        <button
          type="button"
          onClick={onAccept}
          className="text-label-bold text-secondary uppercase"
        >
          Use as caption
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="text-label-bold text-on-surface-variant uppercase"
        >
          Dismiss
        </button>
      </div>
    </div>
  )
}

function CaptionTextarea({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}): React.ReactElement {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-label-bold text-on-surface-variant uppercase">Caption</span>
      <textarea
        name="caption"
        required
        rows={4}
        maxLength={2200}
        value={value}
        onChange={(event) => {
          onChange(event.target.value)
        }}
        placeholder="What should readers see on the post?"
        className={FIELD}
      />
    </label>
  )
}
