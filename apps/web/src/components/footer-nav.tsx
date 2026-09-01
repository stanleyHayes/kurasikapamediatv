'use client'

import { Link, usePathname } from '@kurasikapa/web-kit/i18n/navigation'
import { FooterIcon } from './footer-icon'
import { FOOTER_GROUPS } from './footer-links'

export function FooterNav(): React.ReactElement {
  const pathname = usePathname()
  return <nav aria-label="Site information" className="grid grid-cols-2 gap-x-7 gap-y-11 md:grid-cols-3 xl:grid-cols-5">{FOOTER_GROUPS.map((group) => <div key={group.title}><p className="mb-4 flex items-center gap-2 border-b border-white/20 pb-3 text-xs font-bold uppercase tracking-[.12em] text-secondary"><FooterIcon name={group.icon} className="h-5 w-5" />{group.title}</p><ul className="space-y-1 text-sm">{group.links.map((link) => { const active = pathname === link.href || pathname.startsWith(`${link.href}/`); return <li key={link.href}><Link href={link.href} aria-current={active ? 'page' : undefined} className={`group/link flex items-center gap-2.5 border-l-2 px-3 py-2 transition-colors ${active ? 'border-secondary bg-white/10 text-white' : 'border-transparent text-white/68 hover:border-white/25 hover:text-white'}`}><FooterIcon name={link.icon} className={`h-4 w-4 shrink-0 ${active ? 'text-secondary' : 'text-white/48'}`} /><span className="editorial-link">{link.label}</span></Link></li> })}</ul></div>)}</nav>
}
