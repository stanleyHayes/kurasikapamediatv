'use client'

import { useEffect } from 'react'
import { CONSENT_EVENT, CONSENT_KEY } from './consent'

const VISITOR_KEY = 'kurasikapa-analytics-visitor'

function acquisition(referrer: string): string {
  if (referrer === '') return 'direct'
  const host = new URL(referrer).hostname
  if (/google|bing|duckduckgo|yahoo/u.test(host)) return 'search'
  if (/facebook|instagram|x\.com|twitter|linkedin|tiktok/u.test(host)) return 'social'
  if (/mail|newsletter/u.test(host)) return 'newsletter'
  return host === window.location.hostname ? 'direct' : 'referral'
}

export function ArticleViewBeacon({ articleId, locale }: { articleId: string; locale: string }): null {
  useEffect(() => {
    const record = (): void => {
      if (window.localStorage.getItem(CONSENT_KEY) !== 'granted') return
      const sessionKey = `kurasikapa-view:${articleId}`
      if (window.sessionStorage.getItem(sessionKey) === 'sent') return
      const visitorId = window.localStorage.getItem(VISITOR_KEY) ?? window.crypto.randomUUID()
      window.localStorage.setItem(VISITOR_KEY, visitorId)
      window.sessionStorage.setItem(sessionKey, 'sent')
      void fetch('/api/analytics/page-view', {
        method: 'POST', headers: { 'content-type': 'application/json' }, keepalive: true,
        body: JSON.stringify({ articleId, locale, visitorId, channel: acquisition(document.referrer) }),
      })
    }
    record()
    window.addEventListener(CONSENT_EVENT, record)
    return () => { window.removeEventListener(CONSENT_EVENT, record) }
  }, [articleId, locale])
  return null
}
