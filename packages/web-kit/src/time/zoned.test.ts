import { describe, expect, it } from 'vitest'
import { countryForTimeZone, formatInZone, isoToZonedWallClock, isSupportedTimeZone, zonedWallClockToISO } from './zoned'

describe('zonedWallClockToISO', () => {
  /*
   * The bug this exists to kill: `${input}:00.000Z` string-appended a Z to a
   * datetime-local value, which declares the typed wall clock to BE UTC. Accra
   * is UTC+0 all year, so it was accidentally right there and wrong everywhere
   * else — a 19:00 Paris dinner was stored as 19:00Z and rendered as 21:00.
   */
  it('reads a Paris wall clock in summer as CEST, not UTC', () => {
    expect(zonedWallClockToISO('2026-09-12T19:00', 'Europe/Paris')).toBe('2026-09-12T17:00:00.000Z')
  })

  it('reads the same Paris wall clock in winter as CET', () => {
    // Same typed time, one hour different in UTC. A fixed offset cannot do this.
    expect(zonedWallClockToISO('2026-01-12T19:00', 'Europe/Paris')).toBe('2026-01-12T18:00:00.000Z')
  })

  it('leaves Accra unchanged, so existing Ghanaian events keep their times', () => {
    expect(zonedWallClockToISO('2026-09-12T19:00', 'Africa/Accra')).toBe('2026-09-12T19:00:00.000Z')
  })

  it('handles zones behind UTC', () => {
    expect(zonedWallClockToISO('2026-09-12T19:00', 'America/New_York')).toBe('2026-09-12T23:00:00.000Z')
  })

  it('accepts a value that already carries seconds', () => {
    expect(zonedWallClockToISO('2026-09-12T19:00:00', 'Europe/Paris')).toBe('2026-09-12T17:00:00.000Z')
  })

  it('round-trips: formatting the instant back in its zone returns the typed clock', () => {
    for (const zone of ['Europe/Paris', 'Africa/Accra', 'America/New_York', 'Asia/Kolkata']) {
      const iso = zonedWallClockToISO('2026-09-12T19:30', zone)
      const back = new Intl.DateTimeFormat('en-GB', {
        timeZone: zone, hour12: false, hour: '2-digit', minute: '2-digit',
      }).format(new Date(iso))
      expect(back, zone).toBe('19:30')
    }
  })

  it('survives a spring-forward gap rather than throwing', () => {
    // 02:30 on 29 March 2026 does not exist in Paris — the clock jumps 02:00 to
    // 03:00. A picker can still emit it, so this must resolve to a real instant.
    const iso = zonedWallClockToISO('2026-03-29T02:30', 'Europe/Paris')
    expect(Number.isNaN(Date.parse(iso))).toBe(false)
  })

  it('rejects a value that is not a wall clock', () => {
    expect(() => zonedWallClockToISO('', 'Europe/Paris')).toThrow()
    expect(() => zonedWallClockToISO('not-a-date', 'Europe/Paris')).toThrow()
  })

  it('rejects an unknown zone rather than silently falling back to UTC', () => {
    expect(() => zonedWallClockToISO('2026-09-12T19:00', 'Mars/Olympus')).toThrow()
  })
})

describe('isoToZonedWallClock', () => {
  /*
   * The inverse, and what an edit form needs: a stored instant has to come back
   * as the clock the organiser originally typed. Without it, editing a Paris
   * event would show 17:00 — the UTC value — and saving would shift the event
   * two hours earlier every time anyone touched it.
   */
  it('renders a stored instant as the local wall clock', () => {
    expect(isoToZonedWallClock('2026-09-12T17:00:00.000Z', 'Europe/Paris')).toBe('2026-09-12T19:00')
    expect(isoToZonedWallClock('2026-09-12T19:00:00.000Z', 'Africa/Accra')).toBe('2026-09-12T19:00')
  })

  it('round-trips with zonedWallClockToISO for every offered zone', () => {
    for (const zone of ['Europe/Paris', 'Africa/Accra', 'America/New_York', 'Europe/London']) {
      const typed = '2026-09-12T19:30'
      expect(isoToZonedWallClock(zonedWallClockToISO(typed, zone), zone), zone).toBe(typed)
    }
  })

  it('round-trips across a date boundary, where midnight can read as hour 24', () => {
    const typed = '2026-09-13T00:15'
    expect(isoToZonedWallClock(zonedWallClockToISO(typed, 'Europe/Paris'), 'Europe/Paris')).toBe(typed)
  })

  it('returns an empty string for an unusable input, so a form renders blank', () => {
    expect(isoToZonedWallClock('', 'Europe/Paris')).toBe('')
    expect(isoToZonedWallClock('not-a-date', 'Europe/Paris')).toBe('')
  })
})

describe('formatInZone', () => {
  it('writes the time as a reader in that zone sees it, in their own language', () => {
    const iso = '2026-09-12T17:00:00.000Z'
    expect(formatInZone(iso, 'Europe/Paris', 'fr')).toContain('19:00')
    expect(formatInZone(iso, 'Europe/Paris', 'en')).toContain('19:00')
    // Same instant, a different clock in Accra.
    expect(formatInZone(iso, 'Africa/Accra', 'en')).toContain('17:00')
  })
})

describe('isSupportedTimeZone', () => {
  it('accepts real IANA zones and refuses invented ones', () => {
    expect(isSupportedTimeZone('Europe/Paris')).toBe(true)
    expect(isSupportedTimeZone('Africa/Accra')).toBe(true)
    expect(isSupportedTimeZone('UTC')).toBe(true)
    expect(isSupportedTimeZone('Mars/Olympus')).toBe(false)
    expect(isSupportedTimeZone('')).toBe(false)
  })
})

describe('countryForTimeZone', () => {
  it('maps the zones the newsroom actually publishes in', () => {
    expect(countryForTimeZone('Europe/Paris')).toBe('FR')
    expect(countryForTimeZone('Africa/Accra')).toBe('GH')
  })

  /*
   * Returning undefined matters more than it looks. The events page stamped
   * addressCountry: 'GH' on every event; a Paris dinner then told Google it
   * was in Ghana. Omitting the field is weaker markup than a correct country
   * and far better than a confident wrong one.
   */
  it('returns undefined rather than guessing for an unmapped zone', () => {
    expect(countryForTimeZone('Asia/Kolkata')).toBeUndefined()
    expect(countryForTimeZone('UTC')).toBeUndefined()
  })
})
