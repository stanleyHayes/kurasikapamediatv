import { Link } from '@kurasikapa/web-kit/i18n/navigation'

interface EmptyAction {
  readonly href: string
  readonly label: string
}

interface EmptyStateProps {
  readonly eyebrow: string
  readonly title: string
  readonly description: string
  readonly icon: string
  readonly action?: EmptyAction
  readonly secondaryAction?: EmptyAction
  readonly compact?: boolean
}

/** A newsroom-specific empty state: useful next steps, not decorative filler. */
export function StudioEmptyState({
  eyebrow,
  title,
  description,
  icon,
  action,
  secondaryAction,
  compact = false,
}: EmptyStateProps): React.ReactElement {
  return (
    <section
      role="status"
      className={`paper-noise relative isolate overflow-hidden border border-dashed border-outline bg-surface-container-lowest ${compact ? 'p-6' : 'px-7 py-12 md:px-12 md:py-16'}`}
    >
      <span aria-hidden className="absolute -bottom-10 -right-4 select-none text-[10rem] font-black leading-none text-primary/[.055] md:text-[14rem]">{icon}</span>
      <span aria-hidden className="absolute left-0 top-0 h-1.5 w-28 bg-secondary" />
      <div className="relative max-w-xl">
        <div className="mb-5 flex items-center gap-4">
          <span aria-hidden className="grid h-12 w-12 place-items-center border border-primary bg-primary-container text-xl font-bold text-primary motion-safe:animate-[empty-float_3s_var(--ease-out)_infinite]">{icon}</span>
          <p className="broadcast-kicker text-secondary">{eyebrow}</p>
        </div>
        <h3 className={`max-w-[16ch] font-display font-semibold leading-[.98] text-on-surface ${compact ? 'text-2xl' : 'text-3xl md:text-5xl'}`}>{title}</h3>
        <p className="mt-5 max-w-[58ch] leading-relaxed text-on-surface-variant">{description}</p>
        {(action !== undefined || secondaryAction !== undefined) && (
          <div className="mt-7 flex flex-wrap gap-3">
            {action !== undefined && <Link href={action.href} className="bg-primary px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-inverse-surface">{action.label} <span aria-hidden>↗</span></Link>}
            {secondaryAction !== undefined && <Link href={secondaryAction.href} className="border border-on-surface px-5 py-3 text-sm font-bold text-on-surface transition-colors hover:bg-on-surface hover:text-white">{secondaryAction.label}</Link>}
          </div>
        )}
      </div>
    </section>
  )
}
