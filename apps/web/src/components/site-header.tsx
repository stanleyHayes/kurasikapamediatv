import Image from 'next/image'
import { Link } from '@kurasikapa/web-kit/i18n/navigation'

const SECTIONS = [
  { href: '/news', label: 'News' },
  { href: '/sections/politics', label: 'Politics' },
  { href: '/sections/business', label: 'Business' },
  { href: '/sections/education', label: 'Education' },
] as const

function Brand(): React.ReactElement {
  return (
    <Link href="/" aria-label="Kurasikapa Media TV home" className="group flex shrink-0 items-center gap-4">
      <Image
        src="/brand-logo-transparent.png"
        alt="Kurasikapa Media"
        width={1536}
        height={1024}
        priority
        className="h-12 w-auto object-contain object-left transition-transform duration-300 group-hover:-translate-y-0.5 md:h-14"
      />
      <span className="hidden border-l border-white/20 pl-4 text-[10px] font-semibold leading-[1.35] tracking-[0.18em] text-white/55 uppercase xl:block">Media TV<br />Accra · GH</span>
    </Link>
  )
}

function NavLinks({ liveLabel }: { liveLabel: string }): React.ReactElement {
  return (
    <ul className="flex items-center gap-1">
      {SECTIONS.map((item) => (
        <li key={item.href}>
          <Link href={item.href} className="editorial-link px-3 py-2 text-[13px] font-semibold text-white/72 transition-colors hover:text-white">
            {item.label}
          </Link>
        </li>
      ))}
      <li className="ml-2">
        <span className="border-secondary text-secondary eyebrow inline-flex items-center gap-2 border px-3 py-2">
          <span className="bg-secondary h-2 w-2" />
          {liveLabel}
        </span>
      </li>
    </ul>
  )
}

function ReaderActions(): React.ReactElement {
  return (
    <div className="flex items-center gap-2">
      <Link href="/search" aria-label="Search" className="grid h-10 w-10 place-items-center border border-white/20 text-lg text-white transition-colors hover:border-secondary hover:text-secondary">⌕</Link>
      <Link href="/profile" className="hidden px-2 py-2 text-sm font-medium text-white/70 transition-colors hover:text-white sm:inline-block">Saved</Link>
      <Link href="/sign-in" className="bg-secondary text-on-secondary px-4 py-2.5 text-sm font-bold transition-colors hover:bg-white hover:text-primary">Sign in ↗</Link>
    </div>
  )
}

function MobileNav({ liveLabel }: { liveLabel: string }): React.ReactElement {
  return (
    <details className="relative lg:hidden">
      <summary className="grid h-10 w-10 list-none place-items-center border border-white/20 text-xl text-white">≡<span className="sr-only">Open menu</span></summary>
      <div className="broadcast-shadow bg-surface-container-lowest border-outline-variant absolute right-0 top-14 w-64 border p-3">
        <ul className="grid gap-1">
          {SECTIONS.map((item) => <li key={item.href}><Link href={item.href} className="hover:bg-primary-container block px-4 py-3 font-semibold">{item.label}</Link></li>)}
          <li className="text-secondary eyebrow px-4 py-3">● {liveLabel}</li>
        </ul>
      </div>
    </details>
  )
}

export function SiteHeader({ liveLabel }: { liveLabel: string }): React.ReactElement {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/15 bg-[#08150d]">
      <div className="flex h-7 items-center overflow-hidden border-b border-white/10 bg-primary text-white">
        <div className="ticker-track flex gap-12 whitespace-nowrap px-5 text-[10px] font-bold tracking-[0.17em] uppercase" aria-hidden>
          <span>Independent Ghanaian journalism</span><span>News · Context · Community</span><span>Accra newsroom online</span><span>Independent Ghanaian journalism</span><span>News · Context · Community</span><span>Accra newsroom online</span>
        </div>
      </div>
      <nav aria-label="Primary" className="mx-auto flex h-[5rem] max-w-[var(--container-page)] items-center justify-between gap-5 px-4 md:px-8">
        <Brand />
        <div className="hidden border-x border-white/10 px-5 lg:block"><NavLinks liveLabel={liveLabel} /></div>
        <div className="flex items-center gap-2"><ReaderActions /><MobileNav liveLabel={liveLabel} /></div>
      </nav>
    </header>
  )
}
