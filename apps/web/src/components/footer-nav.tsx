'use client'

import { Link, usePathname } from '@kurasikapa/web-kit/i18n/navigation'
import { FooterIcon } from './footer-icon'

const GROUPS = [
  { title: 'Reporting', icon: 'reporting', links: [{ href: '/news', label: 'Latest news', icon: 'newspaper' }, { href: '/podcasts', label: 'Podcasts', icon: 'broadcast' }, { href: '/sections/politics', label: 'Politics', icon: 'section' }, { href: '/sections/business', label: 'Business', icon: 'briefcase' }, { href: '/sections/education', label: 'Education', icon: 'building' }] },
  { title: 'Kurasikapa', icon: 'studio', links: [{ href: '/about', label: 'About us', icon: 'broadcast' }, { href: '/team', label: 'Our team', icon: 'people' }, { href: '/contact', label: 'Contact', icon: 'mail' }, { href: '/careers', label: 'Careers', icon: 'briefcase' }] },
  { title: 'Information', icon: 'help', links: [{ href: '/advertise', label: 'Advertise', icon: 'broadcast' }, { href: '/help', label: 'Help centre', icon: 'help' }, { href: '/faq', label: 'FAQ', icon: 'help' }, { href: '/legal/privacy', label: 'Privacy', icon: 'privacy' }, { href: '/legal/terms', label: 'Terms', icon: 'scale' }, { href: '/legal/cookies', label: 'Cookies', icon: 'cookie' }] },
] as const

export function FooterNav(): React.ReactElement {
  const pathname = usePathname()
  return <nav aria-label="Site information" className="grid grid-cols-2 gap-10 sm:grid-cols-3">{GROUPS.map((group) => <div key={group.title}><p className="mb-5 flex items-center gap-2 border-b border-white/20 pb-3 text-sm font-semibold text-secondary"><FooterIcon name={group.icon} className="h-5 w-5" />{group.title}</p><ul className="space-y-2 text-sm">{group.links.map((link) => { const active = pathname === link.href || pathname.startsWith(`${link.href}/`); return <li key={link.href}><Link href={link.href} aria-current={active ? 'page' : undefined} className={`group/link flex items-center gap-2.5 border-l-2 px-3 py-2 transition-colors ${active ? 'border-secondary bg-white/10 text-white' : 'border-transparent text-white/68 hover:border-white/25 hover:text-white'}`}><FooterIcon name={link.icon} className={`h-4 w-4 shrink-0 ${active ? 'text-secondary' : 'text-white/48'}`} /><span className="editorial-link">{link.label}</span></Link></li> })}</ul></div>)}</nav>
}
