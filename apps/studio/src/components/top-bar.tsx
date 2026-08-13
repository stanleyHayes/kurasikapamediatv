'use client'

import { usePathname } from '@kurasikapa/web-kit/i18n/navigation'

/**
 * The contextual top bar from the Stitch editorial CMS.
 *
 * "Contextual" is the whole point — the design's bar names the section you are
 * in. A fixed title would read "Editorial Workflow" while you stood on the
 * roles screen, which is worse than no title.
 *
 * Prefix-free, like the rail: `/studio` is a basePath, and `usePathname`
 * reports the path with both the basePath and the locale already stripped.
 */
const TITLES: readonly { href: string; title: string }[] = [
  { href: '/review', title: 'Review Queue' },
  { href: '/social', title: 'Social Publishing' },
  { href: '/rss', title: 'RSS Ingest' },
  { href: '/comments', title: 'Comment Moderation' },
  { href: '/people', title: 'Roles & Permissions' },
  { href: '/audit', title: 'Audit Log' },
  { href: '/articles', title: 'Editor' },
  { href: '/', title: 'Editorial Workflow' },
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
