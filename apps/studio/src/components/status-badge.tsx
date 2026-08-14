import type { ArticleStatus } from '@kurasikapa/domain'

/**
 * Regal Precision chips: `label-sm`, rounded-lg, a light tint of the palette.
 *
 * Colour is never the only signal — each badge carries its own text, so the
 * state is legible to a colourblind editor and to a screen reader without any
 * extra markup. WCAG 2.2 AA, and also just how a newsroom scans a list.
 */
const TONE: Readonly<Record<ArticleStatus, string>> = {
  draft: 'bg-surface-container-high text-on-surface-variant',
  in_review: 'bg-secondary-container text-on-secondary-container',
  approved: 'bg-secondary-container text-on-secondary-container',
  scheduled: 'bg-surface-container-high text-on-surface',
  published: 'bg-primary text-on-primary',
  unpublished: 'bg-error-container text-on-error-container',
}

const LABEL: Readonly<Record<ArticleStatus, string>> = {
  draft: 'Draft',
  in_review: 'In review',
  approved: 'Approved',
  scheduled: 'Scheduled',
  published: 'Published',
  unpublished: 'Pulled',
}

export function StatusBadge({ status }: { status: ArticleStatus }): React.ReactElement {
  return (
    <span
      className={`text-label-bold inline-block border-l-2 border-current px-2 py-1 text-[10px] uppercase ${TONE[status]}`}
    >
      {LABEL[status]}
    </span>
  )
}
