import { setRequestLocale } from 'next-intl/server'
import { StudioSignInForm } from '@/components/studio-sign-in-form'
import { StudioAuthShell } from '@/components/studio-auth-shell'
import { env } from '@kurasikapa/web-kit/composition/env'
import { studioUrl } from '@kurasikapa/web-kit/composition/origins'

export default async function StudioSignInPage({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<React.ReactElement> {
  const { locale } = await params
  setRequestLocale(locale)
  const studio = studioUrl(env())

  return <StudioAuthShell eyebrow="Newsroom access" title="Welcome back." intro="Sign in to manage reporting, broadcasts and publication." asideTitle="The newsroom starts here." asideBody="Plan the day’s coverage, review every detail and take trusted reporting from draft to audience."><StudioSignInForm destination={`${studio}/${locale}`} forgotPasswordUrl={`${studio}/${locale}/forgot-password`} sessionEndpoint={`${studio}/api/session`} /></StudioAuthShell>
}
