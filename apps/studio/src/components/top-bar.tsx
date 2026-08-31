'use client'

import { Link, usePathname } from '@kurasikapa/web-kit/i18n/navigation'
import { StudioIcon } from './studio-icon'

const TITLES = [
  { href: '/articles/new', title: 'Create story', description: 'Start original reporting for Kurasikapa.' },
  { href: '/live-control', title: 'Live control room', description: 'Provision, monitor and end broadcasts.' },
  { href: '/television', title: 'TV programming', description: 'Manage programmes, presenters and the public schedule.' },
  { href: '/media', title: 'Media library', description: 'Manage verified images, video, audio and accessibility files.' },
  { href: '/podcasts', title: 'Podcasts', description: 'Publish original audio series, episodes, chapters and transcripts.' },
  { href: '/galleries', title: 'Visual galleries', description: 'Curate photo stories and captioned video reports.' },
  { href: '/review', title: 'Review queue', description: 'Make confident publishing decisions.' }, { href: '/social', title: 'Social publishing', description: 'Plan and monitor story distribution.' },
  { href: '/rss', title: 'News sources', description: 'Turn trusted feeds into newsroom drafts.' }, { href: '/comments', title: 'Comment moderation', description: 'Keep reader conversations constructive.' },
  { href: '/pages', title: 'Public pages', description: 'Publish organisation and legal information.' },
  { href: '/people', title: 'People & access', description: 'Manage newsroom roles and responsibility.' }, { href: '/audit', title: 'Audit trail', description: 'Trace every material editorial action.' },
  { href: '/analytics', title: 'Newsroom analytics', description: 'Understand audience, acquisition and growth.' },
  { href: '/articles', title: 'Story editor', description: 'Shape, review and publish the report.' }, { href: '/', title: 'Editorial desk', description: 'Your live newsroom at a glance.' },
] as const

export function StudioTopBar({ locale, collapsed, onCollapse, onMenu }: { locale: string; collapsed: boolean; onCollapse: () => void; onMenu: () => void }): React.ReactElement {
  const pathname = usePathname()
  const match = TITLES.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`)) ?? { title: 'Editorial desk', description: 'Your live newsroom at a glance.' }
  const other = locale === 'fr' ? 'en' : 'fr'
  return <header className="sticky top-0 z-30 flex min-h-20 shrink-0 items-center justify-between gap-4 border-b border-outline-variant bg-surface-container-lowest/95 px-4 backdrop-blur md:px-7">
    <div className="flex min-w-0 items-center gap-3"><button type="button" onClick={onMenu} className="border border-outline-variant p-2.5 text-on-surface lg:hidden" aria-label="Open navigation"><StudioIcon name="menu" /></button><button type="button" onClick={onCollapse} className="hidden border border-outline-variant p-2.5 text-on-surface lg:block" aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}><StudioIcon name="collapse" className={`size-5 ${collapsed ? 'rotate-180' : ''}`} /></button><div className="min-w-0"><p className="broadcast-kicker text-primary">Editorial workspace</p><h1 className="truncate font-display text-xl font-semibold text-on-surface md:text-2xl">{match.title}</h1><p className="hidden text-xs text-on-surface-variant sm:block">{match.description}</p></div></div>
    <div className="flex shrink-0 items-center gap-2"><Link href={pathname} locale={other} className="flex items-center gap-2 border border-outline-variant px-3 py-2.5 text-xs font-bold uppercase text-on-surface hover:border-primary" title="Switch interface language"><StudioIcon name="language" className="size-4"/><span>{locale}</span><StudioIcon name="chevron" className="size-3"/></Link><a href={`/${locale}`} target="_blank" rel="noreferrer" className="hidden items-center gap-2 bg-primary px-4 py-3 text-xs font-bold uppercase text-on-primary sm:flex"><StudioIcon name="site" className="size-4"/>View site</a><Link href="/live-control" className="hidden items-center gap-2 border border-primary px-3 py-2.5 text-[10px] font-bold uppercase text-primary md:flex"><span className="size-2 bg-secondary"/>Go live</Link></div>
  </header>
}
