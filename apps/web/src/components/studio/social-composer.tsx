'use client'

import { useState, useTransition } from 'react'
import { callAction } from '../../actions/call'
import { queueSocialPostAction } from '../../actions/editorial'
import { CaptionField } from './caption-field'

const PLATFORMS = [
  { id: 'facebook', label: 'Facebook' },
  { id: 'instagram', label: 'Instagram' },
] as const

const FIELD =
  'border-outline-variant bg-surface-container-lowest text-on-surface rounded-lg border px-3 py-2'

const text = (form: FormData, field: string): string => {
  const value = form.get(field)
  return typeof value === 'string' ? value : ''
}

const requestFrom = (form: FormData, platforms: readonly string[]): unknown => {
  const scheduled = text(form, 'scheduledAt')
  return {
    articleId: text(form, 'articleId'),
    platforms,
    caption: text(form, 'caption'),
    scheduledAt: scheduled === '' ? '' : new Date(scheduled).toISOString(),
  }
}

export interface PublishableArticle {
  readonly id: string
  readonly title: string
}

/** Compose panel. AI caption is a proposal — never auto-queued. */
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
  const [error, setError] = useState<string | null>(null)
  const [queued, setQueued] = useState<number | null>(null)
  const [pending, startTransition] = useTransition()
  const captionPlatform = platforms.includes('instagram') ? 'instagram' : 'facebook'

  return (
    <form
      action={(form) => {
        setError(null)
        setQueued(null)
        startTransition(async () => {
          const result = await callAction(() => queueSocialPostAction(requestFrom(form, platforms)))
          if (result.ok) setQueued(result.data.queued)
          else setError(result.error.message)
        })
      }}
      className="flex flex-col gap-4"
    >
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
      <ScheduleField />
      <button
        type="submit"
        disabled={pending || platforms.length === 0}
        className="bg-secondary-container text-on-secondary-container text-label-bold rounded-lg px-4 py-3 uppercase disabled:opacity-50"
      >
        {pending ? 'Queueing…' : 'Schedule post'}
      </button>
      <Outcome queued={queued} error={error} />
    </form>
  )
}

function ScheduleField(): React.ReactElement {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-label-bold text-on-surface-variant uppercase">Publish at</span>
      <input type="datetime-local" name="scheduledAt" required className={FIELD} />
    </label>
  )
}

function PlatformPicker({
  selected,
  onToggle,
}: {
  selected: readonly string[]
  onToggle: (id: string) => void
}): React.ReactElement {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-label-bold text-on-surface-variant mb-1 uppercase">Platforms</legend>
      <div className="flex gap-2">
        {PLATFORMS.map((platform) => {
          const on = selected.includes(platform.id)
          return (
            <button
              key={platform.id}
              type="button"
              aria-pressed={on}
              onClick={() => {
                onToggle(platform.id)
              }}
              className={
                on
                  ? 'bg-secondary-container text-on-secondary-container text-label-bold rounded-full px-4 py-2 uppercase'
                  : 'border-outline-variant text-on-surface-variant text-label-bold rounded-full border px-4 py-2 uppercase'
              }
            >
              {platform.label}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}

function Outcome({
  queued,
  error,
}: {
  queued: number | null
  error: string | null
}): React.ReactElement | null {
  if (error !== null) {
    return (
      <p role="alert" className="text-error text-sm">
        {error}
      </p>
    )
  }
  if (queued === null) return null
  return (
    <p role="status" className="text-secondary text-sm">
      Queued for {queued} {queued === 1 ? 'platform' : 'platforms'}.
    </p>
  )
}

function ArticlePicker({
  articles,
  value,
  onChange,
}: {
  articles: readonly PublishableArticle[]
  value: string
  onChange: (id: string) => void
}): React.ReactElement {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-label-bold text-on-surface-variant uppercase">Article</span>
      <select
        name="articleId"
        required
        value={value}
        onChange={(event) => {
          onChange(event.target.value)
        }}
        className={FIELD}
      >
        {articles.map((article) => (
          <option key={article.id} value={article.id}>
            {article.title}
          </option>
        ))}
      </select>
    </label>
  )
}
