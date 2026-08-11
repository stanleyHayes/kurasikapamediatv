/**
 * What a service worker may keep for offline reading.
 *
 * Published journalism, not the newsroom: studio, auth, profile and RSC
 * payloads stay on the network. Caching a signed-in shell would show one
 * reader's likes as another reader's, and caching `/_next/data` would serve
 * a stale flight after a publish.
 */
export function isOfflineReadable(pathname: string, search = ''): boolean {
  if (new URLSearchParams(search.startsWith('?') ? search.slice(1) : search).has('_rsc')) {
    return false
  }
  if (pathname.startsWith('/api/')) return false
  if (pathname.includes('/studio')) return false
  if (isPrivateReaderPath(pathname)) return false
  if (pathname.startsWith('/_next/') && !pathname.startsWith('/_next/static/')) {
    return false
  }

  return isPublishedSurface(pathname) || isAppShell(pathname)
}

export function shouldRegisterServiceWorker(nodeEnv: string): boolean {
  return nodeEnv === 'production'
}

function isPrivateReaderPath(pathname: string): boolean {
  return (
    pathname.includes('/sign-in') ||
    pathname.includes('/two-factor') ||
    pathname.includes('/profile') ||
    pathname.includes('/newsletter')
  )
}

function isPublishedSurface(pathname: string): boolean {
  return (
    /^\/[a-z]{2}\/?$/u.test(pathname) ||
    /^\/[a-z]{2}\/articles\//u.test(pathname) ||
    /^\/[a-z]{2}\/sections\//u.test(pathname)
  )
}

function isAppShell(pathname: string): boolean {
  return (
    pathname.startsWith('/_next/static/') ||
    pathname === '/offline.html' ||
    pathname === '/sw.js' ||
    pathname === '/manifest.webmanifest' ||
    pathname === '/icon.svg'
  )
}
