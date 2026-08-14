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
    <header className="flex min-h-32 shrink-0 items-center justify-between border-b-2 border-on-surface bg-surface-container-lowest px-5 pb-6 pt-9 md:min-h-36 md:px-8 md:pb-7 md:pt-10 lg:px-10">
      <div className="flex items-center gap-5"><span aria-hidden className="hidden h-10 w-2 bg-secondary sm:block" /><div><p className="broadcast-kicker mb-2 text-primary">Editorial desk</p><h1 className="font-display text-2xl font-semibold text-on-surface md:text-[length:var(--text-headline-md)]">{match?.title ?? 'Editorial Workflow'}</h1></div></div>
      <div className="hidden items-center gap-5 sm:flex"><span className="text-right text-[10px] font-bold leading-relaxed tracking-[.12em] text-on-surface-variant uppercase">Kurasikapa<br />Newsroom OS</span><span className="eyebrow inline-flex items-center gap-2 border border-primary px-4 py-3 text-primary"><span className="h-2 w-2 animate-pulse bg-primary" />Live</span></div>
    </header>
  )
}
