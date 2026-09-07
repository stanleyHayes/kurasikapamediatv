import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { StudioPasswordForm } from '@/components/studio-password-form'
import { requireActor } from '@kurasikapa/web-kit/composition/actor'
import { authGraph } from '@kurasikapa/web-kit/composition/auth-graph'

export const metadata: Metadata = {
  title: 'Your account',
  robots: { index: false, follow: false },
}

/**
 * An editor's own credential, inside the newsroom.
 *
 * Reads happen at the top level, as on every other (shell) page: the shell's
 * layout already wraps its children in the Suspense boundary the session read
 * needs, so a second one here would buy nothing.
 *
 * `requireActor(locale)` rather than a bare `requireActor()` — with the locale
 * it redirects an expired session to sign-in instead of throwing, which is the
 * difference between "sign in again" and a 500.
 */
export default async function StudioAccountPage({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<React.ReactElement> {
  const { locale } = await params
  setRequestLocale(locale)

  // The directory already carries the sign-in email, so this is one read
  // rather than a second trip to the credential store for the same string.
  const actor = await requireActor(locale)
  const user = await authGraph().users.findById(actor.id)

  return (
    <div className="space-y-8 pb-20">
      <header className="border-outline bg-inverse-surface border-b-4 border-b-primary p-7 text-white md:p-9">
        <p className="broadcast-kicker text-secondary">Your account</p>
        <h1 className="mt-3 font-display text-4xl font-semibold md:text-5xl">Security &amp; sign-in</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/65">Rotate the password that opens the newsroom. Changing it signs out every other session immediately.</p>
      </header>

      <section className="border-outline-variant bg-surface-container-lowest grid gap-6 border p-6 sm:grid-cols-3 md:p-8">
        <Fact label="Signed in as" value={user?.name ?? '—'} />
        <Fact label="Sign-in email" value={user?.email ?? '—'} />
        <Fact label="Roles" value={actor.roles.length === 0 ? 'No role assigned' : actor.roles.join(', ')} />
      </section>

      <section className="border-outline-variant bg-surface-container-lowest border p-6 md:p-8">
        <h2 className="font-display text-2xl font-semibold">Change password</h2>
        <p className="text-on-surface-variant mt-2 mb-6 max-w-2xl text-sm leading-relaxed">You need your current password to set a new one. If you cannot remember it, the account team can verify ownership and restore access.</p>
        <StudioPasswordForm />
      </section>
    </div>
  )
}

function Fact({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <div>
      <p className="text-on-surface-variant text-xs font-bold tracking-[.14em] uppercase">{label}</p>
      <p className="mt-2 break-words text-sm font-semibold">{value}</p>
    </div>
  )
}
