import { describe, expect, it } from 'vitest'
import { isOfflineReadable, shouldRegisterServiceWorker } from './offline-policy'

describe('isOfflineReadable', () => {
  it('keeps a visited article for when the radio drops', () => {
    expect(isOfflineReadable('/en/articles/budget-2026')).toBe(true)
    expect(isOfflineReadable('/fr/articles/budget-2026')).toBe(true)
  })

  it('keeps the section listing and the homepage', () => {
    expect(isOfflineReadable('/en')).toBe(true)
    expect(isOfflineReadable('/en/')).toBe(true)
    expect(isOfflineReadable('/en/sections/politics')).toBe(true)
  })

  it('does not keep the newsroom or a signed-in surface', () => {
    // `/studio/en`, not `/en/studio`: the studio is its own deployment with a
    // basePath, so the prefix now comes before the locale (ADR-0011). Only
    // reachable on this origin at all in the same-origin shape, where the
    // studio is rewritten onto this domain — which is exactly when a service
    // worker could cache it by mistake.
    expect(isOfflineReadable('/studio/en')).toBe(false)
    expect(isOfflineReadable('/studio/en/articles/abc')).toBe(false)
    expect(isOfflineReadable('/en/sign-in')).toBe(false)
    expect(isOfflineReadable('/en/two-factor')).toBe(false)
    expect(isOfflineReadable('/en/profile')).toBe(false)
    expect(isOfflineReadable('/en/newsletter')).toBe(false)
    expect(isOfflineReadable('/api/cron/publish-due')).toBe(false)
  })

  it('does not keep an RSC flight, which would go stale after a publish', () => {
    expect(isOfflineReadable('/en/articles/budget-2026', '?_rsc=1abc')).toBe(false)
  })

  it('keeps hashed static assets and the offline fallback', () => {
    expect(isOfflineReadable('/_next/static/chunks/main.js')).toBe(true)
    expect(isOfflineReadable('/_next/data/build/en.json')).toBe(false)
    expect(isOfflineReadable('/offline.html')).toBe(true)
  })
})

describe('shouldRegisterServiceWorker', () => {
  it('stays off in development so Turbopack is not fighting a cache', () => {
    expect(shouldRegisterServiceWorker('development')).toBe(false)
    expect(shouldRegisterServiceWorker('production')).toBe(true)
  })
})
