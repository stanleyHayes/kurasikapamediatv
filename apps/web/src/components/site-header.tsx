'use client'

import Image from 'next/image'
import { useLocale, useTranslations } from 'next-intl'
import { Link, usePathname } from '@kurasikapa/web-kit/i18n/navigation'
import { isNavItemActive, localizedHref } from './site-header-state'

const PRIMARY = [
  { paths: { en: '/news', fr: '/news' }, key: 'latest' },
  { paths: { en: '/sections/ghana', fr: '/sections/ghana' }, key: 'ghana' },
  { paths: { en: '/sections/africa', fr: '/sections/afrique' }, key: 'africa' },
  { paths: { en: '/sections/world', fr: '/sections/monde' }, key: 'world' },
  { paths: { en: '/sections/politics', fr: '/sections/politique' }, key: 'politics' },
  { paths: { en: '/sections/business', fr: '/sections/economie' }, key: 'business' },
  { paths: { en: '/sections/sports', fr: '/sections/sports' }, key: 'sports' },
] as const

const MORE = [
  { paths: { en: '/sections/education', fr: '/sections/education' }, key: 'education' },
  { paths: { en: '/sections/health', fr: '/sections/sante' }, key: 'health' },
  { paths: { en: '/sections/technology', fr: '/sections/technologie' }, key: 'technology' },
  { paths: { en: '/sections/culture', fr: '/sections/culture' }, key: 'culture' },
  { paths: { en: '/sections/entertainment', fr: '/sections/divertissement' }, key: 'entertainment' },
  { paths: { en: '/sections/lifestyle', fr: '/sections/art-de-vivre' }, key: 'lifestyle' },
  { paths: { en: '/sections/opinion', fr: '/sections/opinion' }, key: 'opinion' },
  { paths: { en: '/sections/editorial', fr: '/sections/editorial' }, key: 'editorial' },
] as const

type NavItem = (typeof PRIMARY)[number] | (typeof MORE)[number]

function Brand(): React.ReactElement {
  return (
    <Link href="/" aria-label="Kurasikapa Media TV home" className="group flex shrink-0 items-center gap-4">
      <Image src="/brand-logo-transparent.png" alt="Kurasikapa Media" width={1536} height={1024} priority className="h-12 w-auto object-contain object-left transition-transform duration-300 group-hover:-translate-y-0.5 md:h-14" />
      <span className="hidden border-l border-white/20 pl-4 text-[10px] font-semibold leading-[1.35] tracking-[0.18em] text-white/55 uppercase xl:block">Media TV<br />Accra · GH</span>
    </Link>
  )
}

function NavLink({ item, pathname, mobile = false }: { item: NavItem; pathname: string; mobile?: boolean }): React.ReactElement {
  const t = useTranslations('nav')
  const locale = useLocale()
  const href = localizedHref(item.paths, locale)
  const current = isNavItemActive(pathname, href)
  const classes = mobile
    ? current ? 'block border-l-4 border-secondary bg-primary px-4 py-3 font-bold text-white' : 'hover:bg-primary-container block border-l-4 border-transparent px-4 py-3 font-semibold'
    : current ? 'bg-secondary px-3 py-2 text-[13px] font-bold text-on-secondary' : 'editorial-link px-3 py-2 text-[13px] font-semibold text-white/72 transition-colors hover:text-white'

  return <Link href={href} aria-current={current ? 'page' : undefined} className={classes}>{t(item.key)}</Link>
}

function MoreMenu({ pathname }: { pathname: string }): React.ReactElement {
  const t = useTranslations('nav')
  const locale = useLocale()
  const current = MORE.some((item) => isNavItemActive(pathname, localizedHref(item.paths, locale)))

  return (
    <details className="relative">
      <summary aria-current={current ? 'page' : undefined} className={current ? 'bg-secondary list-none px-3 py-2 text-[13px] font-bold text-on-secondary' : 'list-none px-3 py-2 text-[13px] font-semibold text-white/72 hover:text-white'}>{t('more')} <span aria-hidden>⌄</span></summary>
      <ul className="broadcast-shadow border-outline-variant bg-surface-container-lowest absolute right-0 top-10 z-20 grid w-56 grid-cols-2 border p-2 text-on-surface">
        {MORE.map((item) => <li key={item.paths.en}><NavLink item={item} pathname={pathname} mobile /></li>)}
      </ul>
    </details>
  )
}

function NavLinks({ pathname }: { pathname: string }): React.ReactElement {
  return (
    <ul className="flex items-center gap-1">
      {PRIMARY.map((item) => <li key={item.paths.en}><NavLink item={item} pathname={pathname} /></li>)}
      <li className="ml-1"><MoreMenu pathname={pathname} /></li>
    </ul>
  )
}

function ReaderActions({ pathname }: { pathname: string }): React.ReactElement {
  const t = useTranslations('nav')
  const searchActive = isNavItemActive(pathname, '/search')
  const profileActive = isNavItemActive(pathname, '/profile')
  const signInActive = isNavItemActive(pathname, '/sign-in')

  return (
    <div className="flex items-center gap-2">
      <Link href="/search" aria-label={t('search')} aria-current={searchActive ? 'page' : undefined} className={searchActive ? 'grid h-10 w-10 place-items-center border border-secondary bg-secondary text-lg text-on-secondary' : 'grid h-10 w-10 place-items-center border border-white/20 text-lg text-white transition-colors hover:border-secondary hover:text-secondary'}>⌕</Link>
      <Link href="/profile" aria-current={profileActive ? 'page' : undefined} className={profileActive ? 'hidden border-b-2 border-secondary px-2 py-2 text-sm font-bold text-white sm:inline-block' : 'hidden px-2 py-2 text-sm font-medium text-white/70 transition-colors hover:text-white sm:inline-block'}>{t('saved')}</Link>
      <Link href="/sign-in" aria-current={signInActive ? 'page' : undefined} className={signInActive ? 'border-2 border-secondary bg-white px-4 py-2 text-sm font-bold text-primary' : 'bg-secondary px-4 py-2.5 text-sm font-bold text-on-secondary transition-colors hover:bg-white hover:text-primary'}>{t('signIn')} ↗</Link>
    </div>
  )
}

function MobileNav({ pathname }: { pathname: string }): React.ReactElement {
  const t = useTranslations('nav')

  return (
    <details className="relative lg:hidden">
      <summary className="grid h-10 w-10 list-none place-items-center border border-white/20 text-xl text-white">≡<span className="sr-only">{t('openMenu')}</span></summary>
      <div className="broadcast-shadow border-outline-variant bg-surface-container-lowest absolute right-0 top-14 max-h-[70dvh] w-72 overflow-y-auto border p-3">
        <p className="eyebrow border-outline-variant mb-2 border-b px-4 py-3 text-primary-ink">{t('sections')}</p>
        <ul className="grid gap-1">
          {[...PRIMARY, ...MORE].map((item) => <li key={item.paths.en}><NavLink item={item} pathname={pathname} mobile /></li>)}
        </ul>
      </div>
    </details>
  )
}

export function SiteHeader(): React.ReactElement {
  const pathname = usePathname()
  const t = useTranslations('nav')

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/15 bg-[#08150d]">
      <div className="flex h-7 items-center overflow-hidden border-b border-white/10 bg-primary text-white">
        <div className="ticker-track flex gap-12 whitespace-nowrap px-5 text-[10px] font-bold tracking-[0.17em] uppercase" aria-hidden>
          <span>Independent Ghanaian journalism</span><span>News · Context · Community</span><span>Accra newsroom online</span><span>Independent Ghanaian journalism</span><span>News · Context · Community</span><span>Accra newsroom online</span>
        </div>
      </div>
      <nav aria-label={t('primary')} className="mx-auto flex h-[5rem] max-w-[var(--container-page)] items-center justify-between gap-4 px-4 md:px-8">
        <Brand />
        <div className="hidden border-x border-white/10 px-3 lg:block"><NavLinks pathname={pathname} /></div>
        <div className="flex items-center gap-2"><ReaderActions pathname={pathname} /><MobileNav pathname={pathname} /></div>
      </nav>
    </header>
  )
}
