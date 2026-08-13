'use client'

import { FIELD, PLATFORMS } from './social-compose-fields'

/**
 * Optional per-platform caption overrides.
 *
 * One textarea per selected platform, all optional: a platform left blank
 * falls back to the shared caption, which is the rule the domain applies
 * (`captionForPlatform`). Nothing here is required — requiring two captions
 * for every post would mean the second one is usually skipped anyway.
 */
export function PlatformCaptionFields({
  platforms,
}: {
  platforms: readonly string[]
}): React.ReactElement | null {
  const selected = PLATFORMS.filter((platform) => platforms.includes(platform.id))
  if (selected.length === 0) return null

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-label-bold text-on-surface-variant mb-1 uppercase">
        Per-platform captions
      </legend>
      {selected.map((platform) => (
        <label key={platform.id} className="flex flex-col gap-1">
          <span className="text-on-surface-variant text-sm">{platform.label}</span>
          <textarea
            name={`caption.${platform.id}`}
            rows={2}
            maxLength={2200}
            placeholder="Optional — falls back to the shared caption"
            className={FIELD}
          />
        </label>
      ))}
    </fieldset>
  )
}
