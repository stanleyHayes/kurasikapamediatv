'use client'

import { useState, useTransition } from 'react'
import { callAction } from '../../actions/call'
import { queueSocialPostAction } from '../../actions/social'
import { CaptionField } from './caption-field'
import {
  ArticlePicker,
  Outcome,
  PlatformPicker,
  ScheduleField,
} from './social-compose-fields'
import { PlatformCaptionFields } from './social-platform-captions'

const text = (form: FormData, field: string): string => {
  const value = form.get(field)
  return typeof value === 'string' ? value : ''
}

/** Only the platforms whose override was actually written travel on the wire. */
const captionsFrom = (form: FormData, platforms: readonly string[]): Record<string, string> =>
  Object.fromEntries(
    platforms
      .map((platform) => [platform, text(form, `caption.${platform}`).trim()] as const)
      .filter(([, caption]) => caption !== ''),
  )

const requestFrom = (
  form: FormData,
  platforms: readonly string[],
  publishNow: boolean,
): unknown => {
  const scheduled = text(form, 'scheduledAt')
  return {
    articleId: text(form, 'articleId'),
    platforms,
    caption: text(form, 'caption'),
    captions: captionsFrom(form, platforms),
    scheduledAt: publishNow ? 'now' : scheduled === '' ? '' : new Date(scheduled).toISOString(),
  }
}

export interface PublishableArticle {
  readonly id: string
  readonly title: string
}

/** Compose panel. AI captions and summaries are proposals — never auto-queued. */
export function SocialComposer({
  articles,
}: {
  articles: readonly PublishableArticle[]
}): React.ReactElement {
  if (articles.length === 0) {
    return (
      <p className="text-on-surface-variant">
        Nothing is published yet. Social posts can only reference a live article.
      </p>
    )
  }

  return <ComposerForm articles={articles} />
}

function ComposerForm({
  articles,
}: {
  articles: readonly PublishableArticle[]
}): React.ReactElement {
  const [platforms, setPlatforms] = useState<string[]>(['facebook'])
  const [articleId, setArticleId] = useState(articles[0]?.id ?? '')
  const [publishNow, setPublishNow] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [queued, setQueued] = useState<number | null>(null)
  const [pending, startTransition] = useTransition()
  const captionPlatform = platforms.includes('instagram') ? 'instagram' : 'facebook'

  const submit = (form: FormData): void => {
    setError(null)
    setQueued(null)
    startTransition(async () => {
      const result = await callAction(() =>
        queueSocialPostAction(requestFrom(form, platforms, publishNow)),
      )
      if (result.ok) setQueued(result.data.queued)
      else setError(result.error.message)
    })
  }

  return (
    <form action={submit} className="flex flex-col gap-4">
      <ArticlePicker articles={articles} value={articleId} onChange={setArticleId} />
      <PlatformPicker
        selected={platforms}
        onToggle={(id) => {
          setPlatforms((current) =>
            current.includes(id) ? current.filter((p) => p !== id) : [...current, id],
          )
        }}
      />
      <CaptionField articleId={articleId} platform={captionPlatform} />
      <PlatformCaptionFields platforms={platforms} />
      <PublishNowField checked={publishNow} onChange={setPublishNow} />
      {!publishNow && <ScheduleField />}
      <button
        type="submit"
        disabled={pending || platforms.length === 0}
        className="bg-secondary-container text-on-secondary-container text-label-bold rounded-lg px-4 py-3 uppercase disabled:opacity-50"
      >
        {pending ? 'Queueing…' : publishNow ? 'Publish now' : 'Schedule post'}
      </button>
      <Outcome queued={queued} error={error} />
    </form>
  )
}

/**
 * "Publish now" is a schedule of right now, not a separate path: the use case
 * queues with `scheduledAt = now` and the fan-out worker sends it next pass.
 */
function PublishNowField({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
}): React.ReactElement {
  return (
    <label className="flex items-center gap-2">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => {
          onChange(event.target.checked)
        }}
        className="accent-secondary h-4 w-4"
      />
      <span className="text-label-bold text-on-surface-variant uppercase">Publish now</span>
    </label>
  )
}
