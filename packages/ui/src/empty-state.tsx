import type { ReactNode } from 'react'

interface EmptyStateProps {
  readonly eyebrow: string
  readonly title: string
  readonly description: string
  readonly visual: ReactNode
  readonly actions?: ReactNode
  readonly compact?: boolean
  readonly className?: string
}

/** Shared empty-state frame. Apps provide their own visual and navigation. */
export function EmptyState({ eyebrow, title, description, visual, actions, compact = false, className = '' }: EmptyStateProps): React.ReactElement {
  return (
    <section role="status" className={`paper-noise signal-grid relative isolate overflow-hidden border border-dashed border-outline bg-surface-container-lowest ${compact ? 'px-5 py-7' : 'px-7 py-12 md:px-12 md:py-16'} ${className}`}>
      <span aria-hidden className="absolute left-0 top-0 h-1.5 w-28 bg-secondary" />
      <div className="relative max-w-2xl">
        <div className="mb-5 flex items-center gap-4">
          <span aria-hidden className="empty-state-mark grid size-12 shrink-0 place-items-center border border-primary bg-primary-container text-primary">{visual}</span>
          <p className="broadcast-kicker text-secondary-ink">{eyebrow}</p>
        </div>
        <h3 className={`max-w-[18ch] font-display font-semibold leading-[.98] text-on-surface ${compact ? 'text-2xl' : 'text-3xl md:text-5xl'}`}>{title}</h3>
        <p className="mt-4 max-w-[58ch] leading-relaxed text-on-surface-variant">{description}</p>
        {actions !== undefined && <div className="mt-7 flex flex-wrap gap-3">{actions}</div>}
      </div>
    </section>
  )
}
