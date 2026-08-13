import type { Cadence } from '@kurasikapa/domain'

/** UTC calendar day — the daily cron's latch key. */
export function dailyPeriodKey(now: Date): string {
  return now.toISOString().slice(0, 10)
}

/** ISO week `YYYY-Www` — the weekly cron's latch key. */
export function weeklyPeriodKey(now: Date): string {
  const utc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const day = utc.getUTCDay() || 7
  utc.setUTCDate(utc.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((utc.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7)
  return `${String(utc.getUTCFullYear())}-W${String(week).padStart(2, '0')}`
}

export function digestPeriodKey(cadence: Cadence, now: Date): string {
  return cadence === 'daily' ? dailyPeriodKey(now) : weeklyPeriodKey(now)
}

export function digestWindowStart(cadence: Cadence, now: Date): Date {
  const hours = cadence === 'daily' ? 24 : 24 * 7
  return new Date(now.getTime() - hours * 3_600_000)
}
