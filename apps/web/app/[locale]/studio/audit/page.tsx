import { type AuditEntry, NotPermitted } from '@kurasikapa/domain'
import { setRequestLocale } from 'next-intl/server'
import { redirect } from 'next/navigation'
import { requireActor } from '@/composition/actor'
import { container } from '@/composition/container'

/**
 * The record of what the newsroom did.
 *
 * Never cached, deliberately. Every other studio screen could tolerate a few
 * seconds of staleness; an audit log read during an investigation cannot, and
 * an investigator who cannot tell whether they are looking at the present has
 * no reason to trust anything else on the page.
 */
export default async function AuditPage({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<React.ReactElement> {
  const { locale } = await params
  setRequestLocale(locale)

  const actor = await requireActor()

  const page = await container()
    .readAuditLog.execute({ actor })
    .catch((error: unknown) => {
      // The domain already refused. This stops the UI shouting about it.
      if (error instanceof NotPermitted) redirect(`/${locale}/studio`)
      throw error
    })

  return (
    <div className="space-y-6 pb-20">
      <p className="text-on-surface-variant text-sm">
        Append-only. Entries are written from domain events, so a scheduled publication is recorded
        exactly like an editor&rsquo;s click. Nothing here can be edited or removed.
      </p>

      {page.items.length === 0 ? (
        <p className="text-on-surface-variant">Nothing recorded yet.</p>
      ) : (
        <ul className="border-outline-variant/50 bg-surface-container-low divide-outline-variant/40 divide-y overflow-hidden rounded-xl border">
          {page.items.map((entry) => (
            <AuditRow key={entry.id} entry={entry} locale={locale} />
          ))}
        </ul>
      )}
    </div>
  )
}

function AuditRow({ entry, locale }: { entry: AuditEntry; locale: string }): React.ReactElement {
  const detail = Object.entries(entry.detail)

  return (
    <li className="px-6 py-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-label-bold text-on-surface uppercase">{entry.action}</span>
        <time dateTime={entry.occurredAt.toISOString()} className="text-on-surface-variant text-sm">
          {new Intl.DateTimeFormat(locale, {
            dateStyle: 'medium',
            timeStyle: 'short',
            timeZone: 'UTC',
          }).format(entry.occurredAt)}
        </time>
      </div>

      <p className="text-on-surface-variant mt-1 text-sm">
        by <span className="text-on-surface">{entry.actorId}</span>
        {entry.subjectId !== '' && <> · {entry.subjectId}</>}
      </p>

      {detail.length > 0 && (
        <dl className="text-on-surface-variant mt-2 flex flex-wrap gap-x-4 text-sm">
          {detail.map(([key, value]) => (
            <div key={key} className="flex gap-1">
              <dt className="text-label-bold uppercase">{key}</dt>
              <dd className="text-on-surface">{value}</dd>
            </div>
          ))}
        </dl>
      )}
    </li>
  )
}
