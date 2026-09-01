'use client'

import { useEffect, useState } from 'react'
import { ConsentBanner } from './consent-banner'
import { readConsent, type AnalyticsConsent } from './consent'
import { GoogleAnalytics } from './ga'
import { isGaMeasurementId } from './measurement-id'

/**
 * Public + studio: GDPR does not stop at the paywall of the CMS.
 * First-party measurement and its consent choice do not depend on GA being
 * configured. An unset measurement id suppresses only Google's script.
 */
export function AnalyticsRoot({ measurementId }: { measurementId: string }): React.ReactElement | null {
  const [consent, setConsent] = useState<AnalyticsConsent | null | 'pending'>('pending')

  useEffect(() => {
    setConsent(readConsent(window.localStorage))
  }, [])

  if (consent === 'pending') return null

  return (
    <>
      {consent === 'granted' && isGaMeasurementId(measurementId) ? <GoogleAnalytics measurementId={measurementId} /> : null}
      {consent === null ? <ConsentBanner onChoose={setConsent} /> : null}
    </>
  )
}
