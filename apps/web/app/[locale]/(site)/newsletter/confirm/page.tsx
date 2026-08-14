import { InvalidConfirmation } from '@kurasikapa/domain'
import { setRequestLocale } from 'next-intl/server'
import { Suspense } from 'react'
import { container } from '@kurasikapa/web-kit/composition/container'
import { Link } from '@kurasikapa/web-kit/i18n/navigation'
import { callerKey, limit } from '@kurasikapa/web-kit/security/rate-limit'

interface Props {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ token?: string }>
}

export default function ConfirmPage(props: Props): React.ReactElement {
  return (
    <Suspense fallback={<p className="text-on-surface-variant">Confirming…</p>}>
      <Body params={props.params} searchParams={props.searchParams} />
    </Suspense>
  )
}

async function Body({
  params,
  searchParams,
}: {
  params: Props['params']
  searchParams: Props['searchParams']
}): Promise<React.ReactElement> {
  const { locale } = await params
  setRequestLocale(locale)
  const { token } = await searchParams

  return (
    <section className="mx-auto max-w-[var(--container-page)] px-6 py-[var(--space-lg)]">
      <ConfirmResult token={token ?? ''} />
      <p className="mt-8">
        <Link href="/newsletter" className="text-secondary underline">
          Back to the briefing
        </Link>
      </p>
    </section>
  )
}

async function ConfirmResult({ token }: { token: string }): Promise<React.ReactElement> {
  const graph = container()
  const verdict = await limit(graph.rateLimiter, await callerKey(null), 'newsletter', 'closed')
  if (!verdict.allowed) {
    return (
      <p className="text-on-surface-variant">
        Too many attempts. Try again in {String(verdict.retryAfterSeconds)} seconds.
      </p>
    )
  }

  try {
    await graph.confirmNewsletter.execute({ token })
    return (
      <p className="text-on-surface text-[length:var(--text-body-lg)]">
        You are on the list. The next briefing will include this address.
      </p>
    )
  } catch (error) {
    if (error instanceof InvalidConfirmation) {
      return <p className="text-error">This confirmation link is not valid.</p>
    }
    throw error
  }
}
