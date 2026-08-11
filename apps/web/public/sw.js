/* Keep path rules in sync with src/pwa/offline-policy.ts */
const CACHE = 'kurasikapa-offline-v1'

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(['/offline.html'])))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))),
    ),
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return
  const url = new URL(event.request.url)
  if (url.origin !== self.location.origin) return
  if (!isOfflineReadable(url.pathname, url.search)) return

  event.respondWith(networkFirst(event.request))
})

function isOfflineReadable(pathname, search) {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  if (params.has('_rsc')) return false
  if (pathname.startsWith('/api/')) return false
  if (pathname.includes('/studio')) return false
  if (pathname.includes('/sign-in') || pathname.includes('/two-factor')) return false
  if (pathname.includes('/profile') || pathname.includes('/newsletter')) return false
  if (pathname.startsWith('/_next/') && !pathname.startsWith('/_next/static/')) return false
  if (/^\/[a-z]{2}\/?$/u.test(pathname)) return true
  if (/^\/[a-z]{2}\/articles\//u.test(pathname)) return true
  if (/^\/[a-z]{2}\/sections\//u.test(pathname)) return true
  if (pathname.startsWith('/_next/static/')) return true
  return (
    pathname === '/offline.html' ||
    pathname === '/sw.js' ||
    pathname === '/manifest.webmanifest' ||
    pathname === '/icon.svg'
  )
}

self.addEventListener('push', (event) => {
  const fallback = { title: 'Kurasikapa', body: 'Breaking news', url: '/' }
  const data = event.data === null ? fallback : { ...fallback, ...event.data.json() }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      data: { url: data.url },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url ?? '/'
  event.waitUntil(self.clients.openWindow(url))
})

async function networkFirst(request) {
  try {
    const response = await fetch(request)
    if (response.ok) {
      const copy = response.clone()
      const cache = await caches.open(CACHE)
      await cache.put(request, copy)
    }
    return response
  } catch {
    const cached = await caches.match(request)
    if (cached !== undefined) return cached
    if (request.mode === 'navigate') {
      const fallback = await caches.match('/offline.html')
      if (fallback !== undefined) return fallback
    }
    return Response.error()
  }
}
