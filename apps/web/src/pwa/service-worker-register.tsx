'use client'

import { useEffect } from 'react'
import { shouldRegisterServiceWorker } from './offline-policy'

/**
 * Production only. A service worker in `next dev` caches Turbopack's
 * hashed chunks and the next edit looks like "the site is stuck".
 */
export function ServiceWorkerRegister(): null {
  useEffect(() => {
    if (!shouldRegisterServiceWorker(process.env.NODE_ENV)) return
    if (!('serviceWorker' in navigator)) return
    void navigator.serviceWorker.register('/sw.js')
  }, [])

  return null
}
