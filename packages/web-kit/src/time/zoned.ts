/**
 * Wall-clock time in a named zone, and the instant it actually happens.
 *
 * An event has two different times and they are not interchangeable: the one
 * an organiser types on a form ("the dinner starts at 19:00") and the instant
 * that is ("17:00Z, because Paris is on CEST in September"). Storing the first
 * as though it were the second is the defect this module replaces — the studio
 * form did `${input}:00.000Z`, declaring the typed clock to BE UTC. Accra is
 * UTC+0 year-round so it was accidentally correct there and silently two hours
 * wrong for Paris.
 *
 * No date library. `Intl` already knows every zone's rules including the
 * historical ones, and it ships with the runtime.
 */

/** `datetime-local` emits `YYYY-MM-DDTHH:mm`, optionally with seconds. */
const WALL_CLOCK = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/u

/**
 * Zones the newsroom publishes in, mapped to ISO 3166-1 alpha-2.
 *
 * Deliberately a short explicit list rather than a derived lookup: a wrong
 * country in schema.org markup is worse than no country, so anything not named
 * here returns undefined and the caller omits the field.
 */
const COUNTRY_BY_ZONE: Readonly<Record<string, string>> = {
  'Africa/Accra': 'GH',
  'Africa/Abidjan': 'CI',
  'Africa/Lagos': 'NG',
  'Europe/Paris': 'FR',
  'Europe/Brussels': 'BE',
  'Europe/London': 'GB',
  'America/New_York': 'US',
  'America/Toronto': 'CA',
}

/** The zones offered in the studio picker, in the order they are shown. */
export const EVENT_TIME_ZONES: readonly string[] = [
  'Africa/Accra',
  'Europe/Paris',
  'Europe/London',
  'Europe/Brussels',
  'Africa/Lagos',
  'Africa/Abidjan',
  'America/New_York',
  'America/Toronto',
]

/** True when the runtime's ICU data actually knows this zone. */
export function isSupportedTimeZone(timeZone: string): boolean {
  if (timeZone === '') return false

  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format(0)

    return true
  } catch {
    return false
  }
}

/** ISO 3166-1 alpha-2 for a zone, or undefined when we cannot say. */
export function countryForTimeZone(timeZone: string): string | undefined {
  return COUNTRY_BY_ZONE[timeZone]
}

/**
 * How far ahead of UTC `timeZone` is at a given instant, in milliseconds.
 *
 * Read back through `Intl` rather than computed, so DST, historical changes
 * and half-hour zones are all handled by the runtime's own tz database.
 */
function offsetMsAt(instant: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(instant)

  const at = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((part) => part.type === type)?.value ?? '0')

  // `hour` comes back as 24 for midnight in some ICU builds; % 24 normalises it.
  const wallClock = Date.UTC(
    at('year'), at('month') - 1, at('day'), at('hour') % 24, at('minute'), at('second'),
  )

  return wallClock - instant
}

/**
 * The UTC instant at which a wall clock reads `local` in `timeZone`.
 *
 * Two passes, because the offset depends on the very instant being solved for.
 * The first pass guesses using the offset at the naive time; near a DST
 * boundary that guess can land on the wrong side, and the second pass corrects
 * it. In a spring-forward gap the typed time does not exist at all — the
 * result is then the instant the clock jumps to, which is the only sane answer
 * and is better than throwing at someone filling in a form.
 *
 * @throws if `local` is not a wall clock, or `timeZone` is not a real zone.
 */
export function zonedWallClockToISO(local: string, timeZone: string): string {
  if (!WALL_CLOCK.test(local)) {
    throw new Error(`Expected a YYYY-MM-DDTHH:mm wall clock, received "${local}"`)
  }
  if (!isSupportedTimeZone(timeZone)) {
    throw new Error(`Unknown time zone "${timeZone}"`)
  }

  const naive = Date.parse(`${local.length === 16 ? `${local}:00` : local}Z`)
  const firstPass = naive - offsetMsAt(naive, timeZone)
  const secondPass = naive - offsetMsAt(firstPass, timeZone)

  return new Date(secondPass).toISOString()
}

/**
 * The inverse of `zonedWallClockToISO`: a stored instant as a `datetime-local`
 * value in `timeZone`.
 *
 * What an edit form loads. Showing the raw UTC value instead would shift the
 * event by the zone offset every time anyone saved the form.
 *
 * Returns '' rather than throwing on an unusable input, so a form renders an
 * empty field instead of a crash.
 */
export function isoToZonedWallClock(iso: string, timeZone: string): string {
  const instant = Date.parse(iso)
  if (Number.isNaN(instant) || !isSupportedTimeZone(timeZone)) return ''

  // en-CA formats as YYYY-MM-DD, which is the order the value needs.
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).formatToParts(instant)
  const at = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? '00'

  // Midnight comes back as hour 24 in some ICU builds; the date part is already
  // the following day, so only the hour needs normalising.
  const hour = at('hour') === '24' ? '00' : at('hour')

  return `${at('year')}-${at('month')}-${at('day')}T${hour}:${at('minute')}`
}

/** An instant, written the way a reader in `timeZone` would see it. */
export function formatInZone(iso: string, timeZone: string, locale: string): string {
  return new Intl.DateTimeFormat(locale === 'fr' ? 'fr-FR' : 'en-GB', {
    dateStyle: 'medium', timeStyle: 'short', timeZone,
  }).format(new Date(iso))
}
