import { setRequestLocale } from 'next-intl/server'
import { StudioSignInForm } from '@/components/studio-sign-in-form'
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

  return (
    <main className="bg-surface-container-low flex min-h-screen items-center justify-center p-6">
      <section className="bg-surface-container-lowest border-outline-variant w-full max-w-md border p-8 shadow-xl">
        <p className="text-primary mb-3 text-xs font-bold uppercase tracking-[0.2em]">Newsroom access</p>
        <h1 className="text-on-surface text-3xl font-extrabold">Kurasikapa Studio</h1>
        <p className="text-on-surface-variant mb-8 mt-3 text-sm">Sign in to manage reporting, broadcasts and publication.</p>
        <StudioSignInForm destination={`${studio}/${locale}`} sessionEndpoint={`${studio}/api/session`} />
      </section>
    </main>
  )
}
