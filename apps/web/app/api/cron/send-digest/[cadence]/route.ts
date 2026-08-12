import { CADENCES, type Cadence } from '@kurasikapa/domain'
import { DigestAlreadySent } from '@kurasikapa/application'
import { container } from '@/composition/container'
import { isAuthorisedCron } from '@/composition/cron-auth'
import { digestPeriodKey, digestWindowStart } from '@/composition/digest-period'
import { env } from '@/composition/env'
import { systemClock } from '@/composition/ambient'

const LOCALES = ['en', 'fr'] as const

/**
 * Daily and weekly digests. Fail-closed without Resend. A second tick for the
 * same period is skipped (already latched), not an error for the cron.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ cadence: string }> },
): Promise<Response> {
  const secret = env().CRON_SECRET
  if (!isAuthorisedCron(request, secret)) {
    return new Response('Not found', { status: 404 })
  }

  const cadence = cadenceOf((await context.params).cadence)
  if (cadence === null) return new Response('Not found', { status: 404 })

  const now = systemClock.now()
  const periodKey = digestPeriodKey(cadence, now)
  const since = digestWindowStart(cadence, now)
  const results = []
  for (const locale of LOCALES) {
    results.push(await sendOne(cadence, locale, periodKey, since))
  }

  return Response.json({ cadence, results })
}

export function GET(
  request: Request,
  context: { params: Promise<{ cadence: string }> },
): Promise<Response> {
  return POST(request, context)
}

async function sendOne(
  cadence: Cadence,
  locale: string,
  periodKey: string,
  since: Date,
): Promise<{ locale: string; sent: number; articles: number; skipped?: true }> {
  try {
    const result = await container().sendNewsletterDigest.execute({
      cadence,
      locale,
      periodKey,
      since,
    })
    return { locale, ...result }
  } catch (error) {
    if (error instanceof DigestAlreadySent) return { locale, sent: 0, articles: 0, skipped: true }
    throw error
  }
}

function cadenceOf(value: string): Cadence | null {
  return (CADENCES as readonly string[]).includes(value) ? (value as Cadence) : null
}
