export const CONSENT_KEY = 'kurasikapa-analytics-consent'

export type AnalyticsConsent = 'granted' | 'denied'

export function readConsent(storage: Pick<Storage, 'getItem'>): AnalyticsConsent | null {
  const value = storage.getItem(CONSENT_KEY)
  if (value === 'granted' || value === 'denied') return value
  return null
}

export function writeConsent(
  storage: Pick<Storage, 'setItem'>,
  value: AnalyticsConsent,
): void {
  storage.setItem(CONSENT_KEY, value)
}
