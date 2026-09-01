'use client'

import Image from 'next/image'
import { useLocale, useTranslations } from 'next-intl'
import { useEffect, useRef } from 'react'
import { Link, usePathname } from '@kurasikapa/web-kit/i18n/navigation'
import { isNavItemActive, localizedHref } from './site-header-state'
import { SITE_NAV_GROUPS, SITE_NAV_ITEMS, type SiteNavGroup, type SiteNavItem } from './site-navigation'
import { SiteNavigationIcon } from './site-navigation-icon'

function Brand(): React.ReactElement {
  return (
    <Link href="/" aria-label="Kurasikapa Media TV home" className="group flex shrink-0 items-center gap-4">
      <Image src="/brand-logo-transparent.png" alt="Kurasikapa Media" width={1536} height={1024} priority className="h-12 w-auto object-contain object-left transition-transform duration-300 group-hover:-translate-y-0.5 md:h-14" />
      <span className="hidden border-l border-white/20 pl-4 text-[10px] font-semibold leading-[1.35] tracking-[0.18em] text-white/55 uppercase xl:block">Media TV<br />Accra · GH</span>
    </Link>
  )
}

function NavLink({ item, pathname, mobile = false, onSelect }: { item: SiteNavItem; pathname: string; mobile?: boolean; onSelect?: () => void }): React.ReactElement {
  const t = useTranslations('nav')
  const locale = useLocale()
  const href = localizedHref(item.paths, locale)
  const current = isNavItemActive(pathname, href)
  const live = item.key === 'live'
  const classes = mobile
    ? current ? 'block border-l-4 border-secondary bg-primary px-4 py-3 font-bold text-white' : 'hover:bg-primary-container block border-l-4 border-transparent px-4 py-3 font-semibold'
    : current ? 'bg-secondary px-3 py-2 text-[13px] font-bold text-on-secondary' : `${live ? 'text-secondary' : 'text-white/72'} editorial-link px-3 py-2 text-[13px] font-semibold transition-colors hover:text-white`

  return <Link href={href} onClick={onSelect} aria-current={current ? 'page' : undefined} className={classes}>{live && <span aria-hidden className="mr-1.5 inline-block h-2 w-2 bg-secondary" />}{t(item.key)}</Link>
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

function DeskMenu({ group, pathname }: { group: SiteNavGroup; pathname: string }): React.ReactElement {
  const t = useTranslations('nav')
  const locale = useLocale()
  const detailsRef = useDismissableDetails()
  const current = group.items.some((item) => isNavItemActive(pathname, localizedHref(item.paths, locale)))

  return (
    <details ref={detailsRef} className="group relative">
      <summary aria-current={current ? 'page' : undefined} className={`${current ? 'bg-secondary font-bold text-on-secondary' : 'font-semibold text-white/75 hover:text-white'} inline-flex cursor-pointer list-none items-center gap-1.5 px-2 py-2 text-xs transition-colors xl:px-3 xl:text-[13px] [&::-webkit-details-marker]:hidden`}>
        {t(group.key)}
        <svg aria-hidden viewBox="0 0 20 20" fill="none" className="h-4 w-4 transition-transform duration-200 group-open:rotate-180">
          <path d="m5 7.5 5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" strokeLinejoin="miter" />
        </svg>
      </summary>
      <ul className="broadcast-shadow border-outline-variant bg-surface-container-lowest absolute left-0 top-12 z-20 grid w-80 border p-2 text-on-surface">
        {group.items.map((item) => <DropdownItem key={item.paths.en} item={item} pathname={pathname} onSelect={() => detailsRef.current?.removeAttribute('open')} />)}
      </ul>
    </details>
  )
}

function DropdownItem({ item, pathname, onSelect }: { item: SiteNavItem; pathname: string; onSelect: () => void }): React.ReactElement {
  const t = useTranslations('nav')
  const locale = useLocale()
  const href = localizedHref(item.paths, locale)
  const active = isNavItemActive(pathname, href)

  return (
    <li>
      <Link href={href} onClick={onSelect} aria-current={active ? 'page' : undefined} className={`${active ? 'border-secondary bg-primary-container' : 'border-transparent hover:border-outline-variant hover:bg-surface-container-low'} group/item grid grid-cols-[2.75rem_1fr] gap-3 border-l-4 p-3 transition-colors`}>
        <span className={`${active ? 'bg-secondary text-on-secondary' : 'border-outline-variant bg-surface-container-lowest text-primary group-hover/item:border-primary border'} grid h-11 w-11 place-items-center transition-colors`}><SiteNavigationIcon name={item.icon} /></span>
        <span className="min-w-0">
          <span className="block text-sm font-bold leading-tight">{t(item.key)}</span>
          <span className="mt-1 block text-xs leading-5 text-on-surface-variant">{t(`${item.key}Description`)}</span>
        </span>
      </Link>
    </li>
  )
}

function NavLinks({ pathname }: { pathname: string }): React.ReactElement {
  return (
    <ul className="flex items-center gap-1">
      {SITE_NAV_GROUPS.map((group) => <li key={group.key}><DeskMenu group={group} pathname={pathname} /></li>)}
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
      <Link href="/profile" aria-current={profileActive ? 'page' : undefined} className={profileActive ? 'hidden border-b-2 border-secondary px-2 py-2 text-sm font-bold text-white 2xl:inline-block' : 'hidden px-2 py-2 text-sm font-medium text-white/70 transition-colors hover:text-white 2xl:inline-block'}>{t('saved')}</Link>
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
          {SITE_NAV_ITEMS.map((item) => <li key={item.paths.en}><NavLink item={item} pathname={pathname} mobile /></li>)}
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
        <div className="hidden border-x border-white/10 px-1 lg:block xl:px-3"><NavLinks pathname={pathname} /></div>
        <div className="flex items-center gap-2"><ReaderActions pathname={pathname} /><MobileNav pathname={pathname} /></div>
      </nav>
    </header>
  )
}
