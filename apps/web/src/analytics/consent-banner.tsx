'use client'

import { CONSENT_EVENT, writeConsent, type AnalyticsConsent } from './consent'

/**
 * GDPR: analytics is off until a named choice. Essential cookies (session)
 * are not gated here — they are not analytics.
 */
export function ConsentBanner({
  onChoose,
}: {
  onChoose: (value: AnalyticsConsent) => void
}): React.ReactElement {
  const choose = (value: AnalyticsConsent): void => {
    writeConsent(window.localStorage, value)
    window.dispatchEvent(new Event(CONSENT_EVENT))
    onChoose(value)
  }

  return (
    <div
      role="dialog"
      aria-label="Analytics cookies"
      className="border-outline-variant bg-surface-container-high fixed right-4 bottom-4 left-4 z-50 mx-auto max-w-lg rounded-xl border p-4 shadow-lg md:left-auto"
    >
      <p className="text-on-surface text-sm">
        We measure readership with privacy-safe first-party analytics and Google
        Analytics only if you agree. Essential sign-in cookies are always on.
        You can refuse — the site still works.
      </p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          className="bg-primary text-on-primary text-label-bold rounded px-3 py-2 uppercase"
          onClick={() => {
            choose('granted')
          }}
        >
          Accept analytics
        </button>
        <button
          type="button"
          className="border-outline-variant text-label-bold rounded border px-3 py-2 uppercase"
          onClick={() => {
            choose('denied')
          }}
        >
          Refuse
        </button>
      </div>
    </div>
  )
}
