'use client'

import Image from 'next/image'
import { useEffect, useRef } from 'react'
import { Link, usePathname } from '@kurasikapa/web-kit/i18n/navigation'
import { SignOutButton } from './sign-out-button'
import { StudioIcon, type StudioIconName } from './studio-icon'

interface NavItem { readonly href: string; readonly label: string; readonly description: string; readonly icon: StudioIconName }
const GROUPS: readonly { heading: string; items: readonly NavItem[] }[] = [
  { heading: 'Newsroom', items: [
    { href: '/articles/new', label: 'Create story', description: 'Start original reporting', icon: 'desk' },
    { href: '/', label: 'Editorial desk', description: 'Drafts and live pipeline', icon: 'desk' },
    { href: '/review', label: 'Review queue', description: 'Approve newsroom copy', icon: 'review' },
    { href: '/comments', label: 'Comments', description: 'Moderate conversations', icon: 'comments' },
  ] },
  { heading: 'Publishing', items: [
    { href: '/live-control', label: 'Go live', description: 'Broadcast control room', icon: 'live' },
    { href: '/television', label: 'TV programming', description: 'Shows, presenters and schedule', icon: 'live' },
    { href: '/media', label: 'Media library', description: 'Images, video, audio and captions', icon: 'desk' },
    { href: '/podcasts', label: 'Podcasts', description: 'Series, episodes and transcripts', icon: 'social' },
    { href: '/galleries', label: 'Visual galleries', description: 'Photo stories and captioned video', icon: 'desk' },
    { href: '/social', label: 'Social publishing', description: 'Schedule distribution', icon: 'social' },
    { href: '/rss', label: 'News sources', description: 'Manage inbound feeds', icon: 'rss' },
    { href: '/pages', label: 'Public pages', description: 'About, legal and information', icon: 'desk' },
  ] },
  { heading: 'Administration', items: [
    { href: '/analytics', label: 'Analytics', description: 'Audience and growth intelligence', icon: 'audit' },
    { href: '/people', label: 'People & access', description: 'Roles and permissions', icon: 'people' },
    { href: '/audit', label: 'Audit trail', description: 'Immutable activity log', icon: 'audit' },
  ] },
]
const ITEMS = GROUPS.flatMap((group) => group.items)

export function StudioSideNav({ collapsed, mobileOpen, onClose }: { collapsed: boolean; mobileOpen: boolean; onClose: () => void }): React.ReactElement {
  const pathname = usePathname()
  const navigation = useRef<HTMLElement>(null)
  const active = [...ITEMS].sort((a, b) => b.href.length - a.href.length).find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))?.href ?? '/'
  const compact = collapsed && !mobileOpen
  useEffect(() => {
    const saved = window.sessionStorage.getItem('studio-navigation-scroll')
    if (navigation.current !== null && saved !== null) navigation.current.scrollTop = Number(saved)
  }, [pathname])
  const close = (): void => {
    if (navigation.current !== null) window.sessionStorage.setItem('studio-navigation-scroll', String(navigation.current.scrollTop))
    onClose()
  }
  return <aside aria-label="Studio navigation" className={`fixed inset-y-0 left-0 z-50 flex h-dvh flex-col overflow-hidden border-r-4 border-secondary bg-inverse-surface text-white transition-[width,transform] lg:relative lg:translate-x-0 ${compact ? 'lg:w-[76px]' : 'lg:w-[280px]'} ${mobileOpen ? 'w-[280px] translate-x-0' : 'w-[280px] -translate-x-full'}`}>
    <div className="flex h-20 shrink-0 items-center justify-between border-b border-white/15 px-4"><Link href="/" onClick={close} className="flex min-w-0 items-center gap-3"><Image src="/studio/brand-logo-transparent.png" alt="Kurasikapa Media" width={100} height={64} className="h-12 w-12 object-contain" />{!compact && <span><strong className="block font-display text-lg">Kurasikapa</strong><small className="block text-[9px] font-bold tracking-[.16em] text-secondary uppercase">Newsroom studio</small></span>}</Link>{mobileOpen && <button type="button" onClick={onClose} aria-label="Close navigation" className="p-2 text-white/70 lg:hidden"><StudioIcon name="close" /></button>}</div>
    <nav ref={navigation} className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-5">{GROUPS.map((group) => <section key={group.heading} className="mb-5">{!compact && <p className="mb-2 px-3 text-[9px] font-bold tracking-[.18em] text-white/65 uppercase">{group.heading}</p>}<ul className="space-y-1">{group.items.map((item) => <NavLink key={item.href} item={item} active={active === item.href} compact={compact} onClose={close} />)}</ul></section>)}</nav>
    <div className="shrink-0 border-t border-white/15 p-3">{!compact && <p className="mb-3 px-3 text-[10px] leading-4 text-white/65">Production workspace<br/><span className="text-secondary">Systems operational</span></p>}<SignOutButton /></div>
  </aside>
}

function NavLink({ item, active, compact, onClose }: { item: NavItem; active: boolean; compact: boolean; onClose: () => void }): React.ReactElement {
  return <li><Link href={item.href} prefetch={false} onClick={onClose} title={compact ? item.label : undefined} aria-current={active ? 'page' : undefined} className={`group flex min-h-14 items-center gap-3 border-l-4 px-3 py-2 transition-[background-color,color,border-color,transform] active:translate-x-0.5 ${active ? 'border-secondary bg-white/12 text-white' : 'border-transparent text-white/75 hover:bg-white/7 hover:text-white'}`}><StudioIcon name={item.icon} className={`size-5 shrink-0 ${active ? 'text-secondary' : ''}`} />{!compact && <span className="min-w-0"><strong className="block text-sm font-semibold">{item.label}</strong><small className="block truncate text-[10px] text-white/65 group-hover:text-white/80">{item.description}</small></span>}</Link></li>
}
