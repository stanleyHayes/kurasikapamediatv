import { setRequestLocale } from 'next-intl/server'
import { StudioSignInForm } from '@/components/studio-sign-in-form'
import { StudioAuthShell } from '@/components/studio-auth-shell'
import { studioPath } from '@kurasikapa/web-kit/composition/origins'

/**
 * Every URL here is root-relative, NOT `studioUrl(env())`.
 *
 * This page is served BY the studio, and the studio answers at two origins:
 * its own host, and the public domain, which rewrites `/studio/:path*` onto
 * it. An absolute URL built from STUDIO_URL is therefore cross-origin for
 * whichever of the two the reader did not use — the sign-in POST is blocked by
 * `connect-src 'self'`, the fetch rejects, and the form reports that Studio is
 * unavailable. Relative paths stay on the origin that is about to be handed
 * the session cookie. See ADR-0011 § Deployment shapes.
 */
export default async function StudioSignInPage({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<React.ReactElement> {
  const { locale } = await params
  setRequestLocale(locale)

  return <StudioAuthShell eyebrow="Newsroom access" title="Welcome back." intro="Sign in to manage reporting, broadcasts and publication." asideTitle="The newsroom starts here." asideBody="Plan the day’s coverage, review every detail and take trusted reporting from draft to audience."><StudioSignInForm destination={studioPath(`/${locale}`)} forgotPasswordUrl={studioPath(`/${locale}/forgot-password`)} sessionEndpoint={studioPath('/api/session')} /></StudioAuthShell>
}
