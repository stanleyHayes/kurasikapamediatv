'use client'

import { useState, useTransition } from 'react'
import { callAction } from '../../actions/call'
import { proposeSocialCaptionAction } from '../../actions/side-actions'

const FIELD =
  'border-outline-variant bg-surface-container-lowest text-on-surface rounded-lg border px-3 py-2'

const formatProposal = (caption: string, hashtags: readonly string[]): string => {
  const tags = hashtags.map((tag) => `#${tag}`).join(' ')
  return `${caption}${tags === '' ? '' : `\n\n${tags}`}`
}

/** Caption textarea plus an AI propose button — proposal only, never auto-queue. */
export function CaptionField({
  articleId,
  platform,
}: {
  articleId: string
  platform: 'facebook' | 'instagram'
}): React.ReactElement {
  const [caption, setCaption] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  return (
    <div className="flex flex-col gap-2">
      <CaptionTextarea value={caption} onChange={setCaption} />
      <button
        type="button"
        disabled={pending || articleId === ''}
        onClick={() => {
          setError(null)
          startTransition(async () => {
            const result = await callAction(() =>
              proposeSocialCaptionAction({ articleId, platform }),
            )
            if (!result.ok) {
              setError(result.error.message)
              return
            }
            setCaption(formatProposal(result.data.caption, result.data.hashtags))
          })
        }}
        className="text-label-bold text-secondary self-start uppercase disabled:opacity-50"
      >
        {pending ? 'Proposing…' : 'Suggest caption'}
      </button>
      {error !== null && (
        <p role="alert" className="text-error text-sm">
          {error}
        </p>
      )}
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
