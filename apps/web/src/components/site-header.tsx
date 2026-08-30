'use client'

import Image from 'next/image'
import { useLocale, useTranslations } from 'next-intl'
import { useEffect, useRef } from 'react'
import { Link, usePathname } from '@kurasikapa/web-kit/i18n/navigation'
import { isNavItemActive, localizedHref } from './site-header-state'

const PRIMARY = [
  { paths: { en: '/live', fr: '/live' }, key: 'live' },
  { paths: { en: '/news', fr: '/news' }, key: 'latest' },
  { paths: { en: '/sections/ghana', fr: '/sections/ghana' }, key: 'ghana' },
  { paths: { en: '/sections/africa', fr: '/sections/afrique' }, key: 'africa' },
  { paths: { en: '/sections/world', fr: '/sections/monde' }, key: 'world' },
  { paths: { en: '/sections/politics', fr: '/sections/politique' }, key: 'politics' },
  { paths: { en: '/sections/business', fr: '/sections/economie' }, key: 'business' },
  { paths: { en: '/sections/sports', fr: '/sections/sports' }, key: 'sports' },
] as const

const MORE = [
  { paths: { en: '/sections/education', fr: '/sections/education' }, key: 'education', icon: 'book' },
  { paths: { en: '/sections/health', fr: '/sections/sante' }, key: 'health', icon: 'health' },
  { paths: { en: '/sections/technology', fr: '/sections/technologie' }, key: 'technology', icon: 'chip' },
  { paths: { en: '/sections/culture', fr: '/sections/culture' }, key: 'culture', icon: 'culture' },
  { paths: { en: '/sections/entertainment', fr: '/sections/divertissement' }, key: 'entertainment', icon: 'play' },
  { paths: { en: '/sections/lifestyle', fr: '/sections/art-de-vivre' }, key: 'lifestyle', icon: 'sun' },
  { paths: { en: '/sections/opinion', fr: '/sections/opinion' }, key: 'opinion', icon: 'quote' },
  { paths: { en: '/sections/editorial', fr: '/sections/editorial' }, key: 'editorial', icon: 'pen' },
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
  const live = item.key === 'live'
  const classes = mobile
    ? current ? 'block border-l-4 border-secondary bg-primary px-4 py-3 font-bold text-white' : 'hover:bg-primary-container block border-l-4 border-transparent px-4 py-3 font-semibold'
    : current ? 'bg-secondary px-3 py-2 text-[13px] font-bold text-on-secondary' : `${live ? 'text-secondary' : 'text-white/72'} editorial-link px-3 py-2 text-[13px] font-semibold transition-colors hover:text-white`

  return <Link href={href} aria-current={current ? 'page' : undefined} className={classes}>{live && <span aria-hidden className="mr-1.5 inline-block h-2 w-2 bg-secondary" />}{t(item.key)}</Link>
}

function useDismissableDetails(): React.RefObject<HTMLDetailsElement | null> {
  const detailsRef = useRef<HTMLDetailsElement>(null)

  useEffect(() => {
    function dismiss(event: PointerEvent | KeyboardEvent): void {
      const details = detailsRef.current
      if (!details?.open) return
      if (event instanceof KeyboardEvent && event.key !== 'Escape') return
      if (event instanceof PointerEvent && details.contains(event.target as Node)) return
      details.removeAttribute('open')
    }

    document.addEventListener('pointerdown', dismiss)
    document.addEventListener('keydown', dismiss)
    return () => {
      document.removeEventListener('pointerdown', dismiss)
      document.removeEventListener('keydown', dismiss)
    }
  }, [])

  return detailsRef
}

function MoreMenu({ pathname }: { pathname: string }): React.ReactElement {
  const t = useTranslations('nav')
  const locale = useLocale()
  const detailsRef = useDismissableDetails()
  const current = MORE.some((item) => isNavItemActive(pathname, localizedHref(item.paths, locale)))

  return (
    <details ref={detailsRef} className="group relative">
      <summary aria-current={current ? 'page' : undefined} className={`${current ? 'bg-secondary font-bold text-on-secondary' : 'font-semibold text-white/72 hover:text-white'} inline-flex cursor-pointer list-none items-center gap-1.5 px-3 py-2 text-[13px] transition-colors [&::-webkit-details-marker]:hidden`}>
        {t('more')}
        <svg aria-hidden viewBox="0 0 20 20" fill="none" className="h-4 w-4 transition-transform duration-200 group-open:rotate-180">
          <path d="m5 7.5 5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" strokeLinejoin="miter" />
        </svg>
      </summary>
      <ul className="broadcast-shadow border-outline-variant bg-surface-container-lowest absolute right-0 top-12 z-20 grid w-[38rem] max-w-[calc(100vw-2rem)] grid-cols-2 border p-3 text-on-surface">
        {MORE.map((item) => <MoreMenuItem key={item.paths.en} item={item} pathname={pathname} onSelect={() => detailsRef.current?.removeAttribute('open')} />)}
      </ul>
    </details>
  )
}

function MoreMenuItem({ item, pathname, onSelect }: { item: (typeof MORE)[number]; pathname: string; onSelect: () => void }): React.ReactElement {
  const t = useTranslations('nav')
  const locale = useLocale()
  const href = localizedHref(item.paths, locale)
  const active = isNavItemActive(pathname, href)

  return (
    <li>
      <Link href={href} onClick={onSelect} aria-current={active ? 'page' : undefined} className={`${active ? 'border-secondary bg-primary-container' : 'border-transparent hover:border-outline-variant hover:bg-surface-container-low'} grid min-h-24 grid-cols-[2.75rem_1fr] gap-3 border-l-4 p-4 transition-colors`}>
        <span className={`${active ? 'bg-secondary text-on-secondary' : 'border-outline-variant text-primary border'} grid h-11 w-11 place-items-center`}><DeskIcon name={item.icon} /></span>
        <span className="min-w-0">
          <span className="block text-base font-bold leading-tight">{t(item.key)}</span>
          <span className="mt-1.5 block text-xs leading-relaxed text-on-surface-variant">{t(`${item.key}Description`)}</span>
        </span>
      </Link>
    </li>
  )
}

function DeskIcon({ name }: { name: (typeof MORE)[number]['icon'] }): React.ReactElement {
  const paths = {
    book: <><path d="M4 5.5h4.5A2.5 2.5 0 0 1 11 8v10a2.5 2.5 0 0 0-2.5-2.5H4z" /><path d="M18 5.5h-4.5A2.5 2.5 0 0 0 11 8v10a2.5 2.5 0 0 1 2.5-2.5H18z" /></>,
    health: <><path d="M11 4v14M4 11h14" /><path d="M5 3h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" /></>,
    chip: <><rect x="5" y="5" width="12" height="12" /><path d="M8 1v4m6-4v4M8 17v4m6-4v4M1 8h4m-4 6h4m12-6h4m-4 6h4M9 9h4v4H9z" /></>,
    culture: <><path d="M3 8h16M5 8v9m4-9v9m4-9v9m4-9v9M2 20h18M11 2l9 4H2z" /></>,
    play: <><rect x="3" y="4" width="16" height="14" /><path d="m9 8 5 3-5 3zM3 7l3-3m13 3-3-3" /></>,
    sun: <><circle cx="11" cy="11" r="4" /><path d="M11 1v3m0 14v3M1 11h3m14 0h3M4 4l2 2m10 10 2 2M18 4l-2 2M6 16l-2 2" /></>,
    quote: <><path d="M4 6h6v6H6v4H3V9a3 3 0 0 1 1-3Zm10 0h6v6h-4v4h-3V9a3 3 0 0 1 1-3Z" /></>,
    pen: <><path d="m4 18 1-5L15 3l4 4L9 17zM13 5l4 4M3 21h18" /></>,
  }
  return <svg aria-hidden viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" strokeLinejoin="miter" className="h-5 w-5">{paths[name]}</svg>
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
