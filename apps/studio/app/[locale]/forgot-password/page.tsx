import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { StudioAuthShell } from '@/components/studio-auth-shell'
import { StudioPasswordHelpForm } from '@/components/studio-password-help-form'
import { env } from '@kurasikapa/web-kit/composition/env'
import { studioUrl } from '@kurasikapa/web-kit/composition/origins'

export const metadata: Metadata = {
  title: 'Recover Studio access',
  robots: { index: false, follow: false },
}

export default async function StudioForgotPasswordPage({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<React.ReactElement> {
  const { locale } = await params
  setRequestLocale(locale)

  return <StudioAuthShell eyebrow="Account recovery" title="Let’s get you back in." intro="Tell the account team which email you use for Studio. They will verify ownership before restoring access." asideTitle="Access should be recoverable. Trust should not be bypassed." asideBody="Recovery stays human-reviewed so an inbox alone can never silently take control of the newsroom."><StudioPasswordHelpForm signInUrl={`${studioUrl(env())}/${locale}/sign-in`} /></StudioAuthShell>
}
