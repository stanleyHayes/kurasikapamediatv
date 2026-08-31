import { EmptyState } from '@kurasikapa/ui/empty-state'
import { Link } from '@kurasikapa/web-kit/i18n/navigation'
import { StudioIcon, type StudioIconName } from './studio-icon'

interface EmptyAction {
  readonly href: string
  readonly label: string
}

interface EmptyStateProps {
  readonly eyebrow: string
  readonly title: string
  readonly description: string
  readonly icon: StudioIconName
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
  const actions = action !== undefined || secondaryAction !== undefined ? <>
    {action !== undefined && <Link href={action.href} className="bg-primary px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-inverse-surface">{action.label} <span aria-hidden>↗</span></Link>}
    {secondaryAction !== undefined && <Link href={secondaryAction.href} className="border border-on-surface px-5 py-3 text-sm font-bold text-on-surface transition-colors hover:bg-on-surface hover:text-white">{secondaryAction.label}</Link>}
  </> : undefined

  return <EmptyState eyebrow={eyebrow} title={title} description={description} visual={<StudioIcon name={icon} className="size-6" />} actions={actions} compact={compact} />
}
