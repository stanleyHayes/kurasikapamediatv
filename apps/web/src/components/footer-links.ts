import type { FooterIconName } from './footer-icon'

interface FooterLink {
  readonly href: string
  readonly label: string
  readonly icon: FooterIconName
}

interface FooterGroup {
  readonly title: string
  readonly icon: FooterIconName
  readonly links: readonly FooterLink[]
}

export const FOOTER_GROUPS = [
  { title: 'Newsroom', icon: 'reporting', links: [{ href: '/news', label: 'Latest news', icon: 'newspaper' }, { href: '/ask', label: 'Ask Kurasikapa', icon: 'search' }, { href: '/sections/politics', label: 'Politics', icon: 'section' }, { href: '/sections/business', label: 'Business', icon: 'briefcase' }, { href: '/sections/education', label: 'Education', icon: 'building' }] },
  { title: 'Watch & listen', icon: 'broadcast', links: [{ href: '/live', label: 'Live TV', icon: 'studio' }, { href: '/podcasts', label: 'Podcasts', icon: 'broadcast' }, { href: '/galleries', label: 'Visual stories', icon: 'section' }, { href: '/events', label: 'Events', icon: 'people' }] },
  { title: 'About', icon: 'people', links: [{ href: '/about', label: 'Our story', icon: 'broadcast' }, { href: '/team', label: 'Newsroom team', icon: 'people' }, { href: '/contact', label: 'Contact us', icon: 'mail' }, { href: '/careers', label: 'Careers', icon: 'briefcase' }] },
  { title: 'Marketplace', icon: 'briefcase', links: [{ href: '/shop', label: 'Shop', icon: 'briefcase' }, { href: '/classifieds', label: 'Classifieds', icon: 'search' }, { href: '/partners', label: 'Partner picks', icon: 'people' }, { href: '/support', label: 'Support us', icon: 'people' }, { href: '/advertise', label: 'Advertise', icon: 'broadcast' }] },
  { title: 'Help & legal', icon: 'help', links: [{ href: '/help', label: 'Help centre', icon: 'help' }, { href: '/faq', label: 'FAQ', icon: 'help' }, { href: '/legal/privacy', label: 'Privacy', icon: 'privacy' }, { href: '/legal/terms', label: 'Terms', icon: 'scale' }, { href: '/legal/cookies', label: 'Cookies', icon: 'cookie' }] },
] as const satisfies readonly FooterGroup[]
