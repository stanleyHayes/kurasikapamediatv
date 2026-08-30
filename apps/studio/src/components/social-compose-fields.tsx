'use client'

import { BrandedDateTime } from './branded-date-time'
import { BrandedSelect } from './branded-select'

export const PLATFORMS = [
  { id: 'facebook', label: 'Facebook' },
  { id: 'instagram', label: 'Instagram' },
] as const

export const FIELD =
  'border-outline-variant bg-surface-container-lowest text-on-surface rounded-lg border px-3 py-2'

export function ArticlePicker({
  articles,
  value,
  onChange,
}: {
  articles: readonly { id: string; title: string }[]
  value: string
  onChange: (id: string) => void
}): React.ReactElement {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-label-bold text-on-surface-variant uppercase">Article</span>
      <BrandedSelect
        name="articleId"
        value={value}
        label="Article"
        onChange={onChange}
        options={articles.map((article) => ({ value: article.id, label: article.title }))}
      />
    </label>
  )
}

export function PlatformPicker({
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

export function ScheduleField(): React.ReactElement {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-label-bold text-on-surface-variant uppercase">Publish at</span>
      <BrandedDateTime name="scheduledAt" label="Publish date and time" />
    </label>
  )
}

export function Outcome({
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
