'use client'

import { useEffect, useState } from 'react'
import { ConsentBanner } from './consent-banner'
import { readConsent, type AnalyticsConsent } from './consent'
import { GoogleAnalytics } from './ga'
import { isGaMeasurementId } from './measurement-id'

/**
 * Public + studio: GDPR does not stop at the paywall of the CMS.
 * When the measurement id is unset, neither the banner nor gtag render.
 */
export function AnalyticsRoot({ measurementId }: { measurementId: string }): React.ReactElement | null {
  const [consent, setConsent] = useState<AnalyticsConsent | null | 'pending'>('pending')

  useEffect(() => {
    setConsent(readConsent(window.localStorage))
  }, [])

  if (!isGaMeasurementId(measurementId) || consent === 'pending') return null

  return (
    <>
      {consent === 'granted' ? <GoogleAnalytics measurementId={measurementId} /> : null}
      {consent === null ? <ConsentBanner onChoose={setConsent} /> : null}
    </>
  )
}
