'use client'

import { useEffect } from 'react'
import { CONSENT_EVENT, CONSENT_KEY } from './consent'

const DEPTHS = [25, 50, 75, 100] as const
const VISITOR_KEY = 'kurasikapa-analytics-visitor'

export function ArticleEngagementBeacon({ articleId, locale }: { articleId: string; locale: string }): null {
  useEffect(() => {
    let cleanup: (() => void) | undefined
    const start = (): void => {
      if (cleanup !== undefined || window.localStorage.getItem(CONSENT_KEY) !== 'granted') return
      cleanup = observeEngagement(articleId, locale)
    }
    start()
    window.addEventListener(CONSENT_EVENT, start)
    return () => { window.removeEventListener(CONSENT_EVENT, start); cleanup?.() }
  }, [articleId, locale])
  return null
}

function observeEngagement(articleId: string, locale: string): () => void {
  const sent = new Set<number>()
  let activeSeconds = 0
  let deepest = 0
  const visitorId = window.localStorage.getItem(VISITOR_KEY) ?? window.crypto.randomUUID()
  window.localStorage.setItem(VISITOR_KEY, visitorId)
  const timer = window.setInterval(() => {
    if (document.visibilityState === 'visible') activeSeconds = Math.min(3_600, activeSeconds + 1)
  }, 1_000)
  const measure = (): void => {
    const body = document.getElementById('article-transcript')
    if (body === null || body.offsetHeight === 0) return
    const consumed = Math.max(0, Math.min(100, (window.innerHeight - body.getBoundingClientRect().top) / body.offsetHeight * 100))
    for (const depth of DEPTHS) {
      if (consumed >= depth && !sent.has(depth)) {
        sent.add(depth); deepest = depth
        send({ articleId, locale, visitorId, scrollDepth: depth, activeSeconds })
      }
    }
  }
  const flush = (): void => {
    if (deepest > 0) send({ articleId, locale, visitorId, scrollDepth: deepest, activeSeconds, beacon: true })
  }
  window.addEventListener('scroll', measure, { passive: true })
  window.addEventListener('pagehide', flush)
  document.addEventListener('visibilitychange', flush)
  measure()
  return () => {
    window.clearInterval(timer); window.removeEventListener('scroll', measure)
    window.removeEventListener('pagehide', flush); document.removeEventListener('visibilitychange', flush); flush()
  }
}

interface EngagementPayload {
  articleId: string
  locale: string
  visitorId: string
  scrollDepth: number
  activeSeconds: number
  beacon?: boolean
}

function send(payload: EngagementPayload): void {
  const { beacon = false, ...event } = payload
  const body = JSON.stringify(event)
  if (beacon && navigator.sendBeacon('/api/analytics/engagement', new Blob([body], { type: 'application/json' }))) return
  void fetch('/api/analytics/engagement', { method: 'POST', headers: { 'content-type': 'application/json' }, body, keepalive: true })
}
