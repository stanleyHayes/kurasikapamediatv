'use client'

import { useState, useTransition } from 'react'
import { queueSocialPostAction } from '../../actions/editorial'

const PLATFORMS = [
  { id: 'facebook', label: 'Facebook' },
  { id: 'instagram', label: 'Instagram' },
] as const

/**
 * FormData.get returns `File | string | null`. Stringifying a File yields
 * "[object Object]" and would reach the server as a caption — so the non-string
 * case is dropped rather than coerced.
 */
const text = (form: FormData, field: string): string => {
  const value = form.get(field)

  return typeof value === 'string' ? value : ''
}

/**
 * Builds the action payload from the form.
 *
 * datetime-local carries no timezone, so the browser's own offset is what the
 * editor meant. Converting here rather than on the server keeps the API free
 * of assumptions about where the editor is sitting.
 */
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

/**
 * The composer panel from the Stitch social publishing design.
 *
 * The design draws AI caption generation, a tone selector, hashtag chips and a
 * media attachment. `AiPort` can genuinely write a caption — but the article's
 * body is not loaded on this screen, and generating a caption from a headline
 * alone produces the kind of thin copy a newsroom would not post. That work
 * belongs beside the editor, where the body is already in hand. Media
 * attachments are R3.
 *
 * What is here is real end to end: pick a published article, choose platforms,
 * write the caption, schedule it. The domain refuses an unpublished article
 * and a past time; both errors surface rather than being pre-empted, because
 * the domain is the authority on both.
 */
export function SocialComposer({
  articles,
}: {
  articles: readonly PublishableArticle[]
}): React.ReactElement {
  const [platforms, setPlatforms] = useState<string[]>(['facebook'])
  const [error, setError] = useState<string | null>(null)
  const [queued, setQueued] = useState<number | null>(null)
  const [pending, startTransition] = useTransition()

  const toggle = (id: string): void => {
    setPlatforms((current) =>
      current.includes(id) ? current.filter((p) => p !== id) : [...current, id],
    )
  }

  const submit = (form: FormData): void => {
    setError(null)
    setQueued(null)

    startTransition(async () => {
      const result = await queueSocialPostAction(requestFrom(form, platforms))

      if (result.ok) {
        setQueued(result.data.queued)

        return
      }

      setError(result.error.message)
    })
  }

  if (articles.length === 0) {
    return (
      <p className="text-on-surface-variant">
        Nothing is published yet. Social posts can only reference a live article.
      </p>
    )
  }

  return (
    <form action={submit} className="flex flex-col gap-4">
      <ArticlePicker articles={articles} />

      <PlatformPicker selected={platforms} onToggle={toggle} />

      <CaptionAndSchedule />

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

const FIELD =
  'border-outline-variant bg-surface-container-lowest text-on-surface rounded-lg border px-3 py-2'

function CaptionAndSchedule(): React.ReactElement {
  return (
    <>
      <label className="flex flex-col gap-1">
        <span className="text-label-bold text-on-surface-variant uppercase">Caption</span>
        <textarea
          name="caption"
          required
          rows={4}
          maxLength={2200}
          placeholder="What should readers see on the post?"
          className={FIELD}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-label-bold text-on-surface-variant uppercase">Publish at</span>
        <input type="datetime-local" name="scheduledAt" required className={FIELD} />
      </label>
    </>
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
}: {
  articles: readonly PublishableArticle[]
}): React.ReactElement {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-label-bold text-on-surface-variant uppercase">Article</span>
      <select name="articleId" required className={FIELD}>
        {articles.map((article) => (
          <option key={article.id} value={article.id}>
            {article.title}
          </option>
        ))}
      </select>
    </label>
  )
}
