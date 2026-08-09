import { Link } from '../../i18n/navigation'
import type { DraftView } from '../../read-model/studio-view'
import { RelativeTime } from '../section/relative-time'
import { StatusBadge } from './status-badge'

/** The workflow instant this row can honestly report, if it has one. */
const stamp = (draft: DraftView): string | null => draft.publishedAt ?? draft.scheduledAt

/**
 * One row of the Active Pipeline, per the Stitch editorial CMS: thumbnail,
 * status pill and context line, truncated headline and standfirst, and the
 * row action.
 *
 * Published rows carry the design's left accent bar — the one visual cue that
 * separates "live on the site" from "still ours to change" at a glance.
 */
export function PipelineItem({
  draft,
  now,
}: {
  draft: DraftView
  now: string
}): React.ReactElement {
  const live = draft.status === 'published'

  return (
    <li
      className={`border-outline-variant/50 bg-surface-container-low hover:border-outline-variant relative flex items-center gap-4 rounded-lg border p-4 transition-colors ${
        live ? 'border-secondary/20' : ''
      }`}
    >
      {live && <span aria-hidden className="bg-secondary/50 absolute top-0 bottom-0 left-0 w-1" />}

      {/* Thumbnail slot — tonal until the R3 media library gives articles an image. */}
      <span aria-hidden className="bg-surface-container h-16 w-16 shrink-0 rounded" />

      <Link href={`/studio/articles/${draft.id}`} className="min-w-0 flex-1">
        <span className="mb-1 flex items-center gap-2">
          <StatusBadge status={draft.status} />
          <span className="text-label-bold text-on-surface-variant text-[10px] uppercase">
            {draft.categoryId.replace(/^cat_/u, '')}
            {/*
              The design writes "Updated 2h ago". `updatedAt` is deliberately
              persistence metadata and not a domain concept — see
              ArticleDocument — so rather than push it into the domain to
              satisfy a layout, the row states the workflow time it does own.
              A draft simply has no publication time to report.
            */}
            {stamp(draft) !== null && (
              <>
                {' · '}
                <RelativeTime iso={stamp(draft)} locale={draft.locale} now={now} />
              </>
            )}
          </span>
        </span>

        <span className="text-on-surface block truncate font-semibold">{draft.title}</span>

        {draft.excerpt !== null && (
          <span className="text-on-surface-variant block truncate text-sm">{draft.excerpt}</span>
        )}
      </Link>

      <span className="text-label-bold text-on-surface-variant shrink-0 uppercase">
        {draft.status === 'published' ? 'Live' : 'Open'}
      </span>
    </li>
  )
}
