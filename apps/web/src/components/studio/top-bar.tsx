'use client'

import { usePathname } from '../../i18n/navigation'

/**
 * The contextual top bar from the Stitch editorial CMS.
 *
 * "Contextual" is the whole point — the design's bar names the section you are
 * in. A fixed title would read "Editorial Workflow" while you stood on the
 * roles screen, which is worse than no title.
 */
const TITLES: readonly { href: string; title: string }[] = [
  { href: '/studio/review', title: 'Review Queue' },
  { href: '/studio/social', title: 'Social Publishing' },
  { href: '/studio/rss', title: 'RSS Ingest' },
  { href: '/studio/comments', title: 'Comment Moderation' },
  { href: '/studio/people', title: 'Roles & Permissions' },
  { href: '/studio/audit', title: 'Audit Log' },
  { href: '/studio/articles', title: 'Editor' },
  { href: '/studio', title: 'Editorial Workflow' },
]

export function StudioTopBar(): React.ReactElement {
  const pathname = usePathname()
  const match = TITLES.find((t) => pathname === t.href || pathname.startsWith(`${t.href}/`))

  return (
    <header className="border-outline-variant bg-surface/60 flex h-20 shrink-0 items-center justify-between border-b px-6 backdrop-blur-md">
      <h1 className="font-display text-on-surface text-[length:var(--text-headline-md)] font-semibold">
        {match?.title ?? 'Editorial Workflow'}
      </h1>
    </header>
  )
}
