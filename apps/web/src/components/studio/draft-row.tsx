import { Link } from '../../i18n/navigation'
import type { DraftView } from '../../read-model/studio-view'
import { StatusBadge } from './status-badge'

export function DraftRow({ draft }: { draft: DraftView }): React.ReactElement {
  return (
    <li className="border-outline-variant hover:bg-surface-container-low border-b transition-colors">
      <Link href={`/studio/articles/${draft.id}`} className="flex items-baseline gap-4 px-2 py-4">
        <StatusBadge status={draft.status} />

        <span className="text-on-surface min-w-0 flex-1 truncate font-medium">{draft.title}</span>

        <span className="text-on-surface-variant text-label-bold shrink-0 uppercase">
          {draft.locale}
        </span>

        {draft.scheduledAt !== null && (
          <time dateTime={draft.scheduledAt} className="text-on-surface-variant shrink-0 text-sm">
            {formatWhen(draft.scheduledAt, draft.locale)}
          </time>
        )}
      </Link>
    </li>
  )
}

/** UTC fixed, so server and client agree on the day and React does not warn. */
function formatWhen(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  }).format(new Date(iso))
}
