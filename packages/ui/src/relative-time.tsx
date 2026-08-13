/**
 * "2 Hours Ago", as the design writes it.
 *
 * Uses Intl.RelativeTimeFormat so French readers get "il y a 2 heures" rather
 * than an English string with a translated page around it.
 *
 * `now` is a REQUIRED input, not a default.
 *
 * Reading the clock in a Server Component is a prerender error — a prerendered
 * page has no request-time "now", and CLAUDE.md records this biting the project
 * before. The caller captures it inside a `'use cache'` boundary, where a
 * non-deterministic value is evaluated once per cache entry. The phrasing
 * therefore ages with the entry, which `cacheLife('minutes')` bounds.
 */
const DIVISIONS: readonly { limit: number; unit: Intl.RelativeTimeFormatUnit }[] = [
  { limit: 60, unit: 'second' },
  { limit: 3600, unit: 'minute' },
  { limit: 86_400, unit: 'hour' },
  { limit: 604_800, unit: 'day' },
  { limit: 2_629_800, unit: 'week' },
  { limit: 31_557_600, unit: 'month' },
]

const SECONDS_IN: Readonly<Record<string, number>> = {
  second: 1,
  minute: 60,
  hour: 3600,
  day: 86_400,
  week: 604_800,
  month: 2_629_800,
  year: 31_557_600,
}

export function RelativeTime({
  iso,
  locale,
  now,
}: {
  iso: string | null
  locale: string
  /** ISO instant captured inside a cached read — never `new Date()` here. */
  now: string
}): React.ReactElement | null {
  if (iso === null) return null

  const elapsed = (new Date(now).getTime() - new Date(iso).getTime()) / 1000
  const division = DIVISIONS.find((d) => Math.abs(elapsed) < d.limit)
  const unit = division?.unit ?? 'year'

  const value = -Math.round(elapsed / (SECONDS_IN[unit] ?? 1))
  const formatted = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(value, unit)

  return <time dateTime={iso}>{formatted}</time>
}
