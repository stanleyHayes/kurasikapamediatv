'use client'

import { SignOutButton } from './sign-out-button'
import Image from 'next/image'
import { Link, usePathname } from '@kurasikapa/web-kit/i18n/navigation'

/**
 * The docked studio navigation, per the Stitch editorial CMS: a 256px rail
 * carrying the admin identity, the section links, and the primary action.
 *
 * Only destinations backed by a real route and workflow are rendered. Roadmap
 * labels do not belong in live navigation: a disabled item looks broken and a
 * fake link teaches editors not to trust the shell.
 *
 * The hrefs are prefix-free because `/studio` is a basePath now — Next
 * prepends it at render time, so writing it here would produce
 * `/studio/studio/review`. See ADR-0011.
 */
interface StudioNavItem { readonly href: string; readonly label: string; readonly icon: string }
interface StudioNavGroup { readonly heading: string; readonly items: readonly StudioNavItem[] }

const GROUPS: readonly StudioNavGroup[] = [
  { heading: 'Editorial', items: [
    { href: '/', label: 'Desk', icon: '✎' },
    { href: '/review', label: 'Review', icon: '☑' },
  ] },
  { heading: 'Distribution', items: [
    { href: '/social', label: 'Social', icon: '◈' },
    { href: '/rss', label: 'Sources', icon: '◎' },
    { href: '/comments', label: 'Comments', icon: '¶' },
  ] },
  { heading: 'Governance', items: [
    { href: '/people', label: 'People', icon: '☰' },
    { href: '/audit', label: 'Audit', icon: '◫' },
  ] },
] as const

const LIVE = GROUPS.flatMap((group) => group.items)

/**
 * A client component solely so it can read the pathname.
 *
 * A server layout cannot know which child route rendered, so the active
 * section was hardcoded and Review and Users never highlighted — the rail
 * silently lied about where you were. usePathname is the smallest fix that
 * makes it tell the truth.
 */
export function StudioSideNav(): React.ReactElement {
  const pathname = usePathname()

  // Longest match wins: '/' is a prefix of every studio route, so a plain
  // startsWith would light up Editorial on every page.
  const active =
    [...LIVE]
      .sort((a, b) => b.href.length - a.href.length)
      .find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))?.href ?? '/'

  return (
    <nav
      aria-label="Studio"
      className="bg-inverse-surface text-inverse-on-surface flex w-full shrink-0 flex-col border-b-4 border-secondary px-4 py-3 lg:w-64 lg:border-b-0 lg:border-r-4 lg:px-5 lg:py-6"
    >
      <Identity />

      <div className="flex flex-grow gap-2 overflow-x-auto lg:flex-col lg:gap-3">
        {GROUPS.map((group) => <NavGroup key={group.heading} group={group} active={active} />)}
      </div>

      <div className="border-outline-variant ml-auto border-l pl-3 lg:ml-0 lg:mt-auto lg:border-l-0 lg:border-t lg:pl-0 lg:pt-6">
        <SignOutButton />
      </div>
    </nav>
  )
}

function NavGroup({ group, active }: { group: StudioNavGroup; active: string }): React.ReactElement {
  return (
    <section className="shrink-0 lg:block">
      <p className="mb-1 hidden px-3 text-[9px] font-bold tracking-[.18em] text-white/35 uppercase lg:block">{group.heading}</p>
      <ul className="flex gap-1 lg:flex-col">
        {group.items.map((item) => <NavLink key={item.href} item={item} active={active === item.href} />)}
      </ul>
    </section>
  )
}

function Identity(): React.ReactElement {
  return (
    <div className="mr-4 flex shrink-0 items-center px-1 lg:mb-9 lg:mr-0 lg:mt-2 lg:block">
      <Image src="/studio/brand-logo-transparent.png" alt="Kurasikapa Media" width={1536} height={1024} priority className="h-12 w-20 object-contain object-left lg:h-24 lg:w-full" />
      <div className="mt-3 hidden lg:block">
        <p className="eyebrow text-secondary">Newsroom studio</p>
      </div>
    </div>
  )
}

function NavLink({
  item,
  active,
}: {
  item: StudioNavItem
  active: boolean
}): React.ReactElement {
  return (
    <li>
      <Link
        href={item.href}
        aria-current={active ? 'page' : undefined}
        className={
          active
            ? 'bg-primary text-on-primary flex shrink-0 items-center gap-3 px-3 py-3 font-bold'
            : 'text-white/65 hover:bg-white/10 hover:text-white flex shrink-0 items-center gap-3 px-3 py-3 transition-colors'
        }
      >
        <span aria-hidden className="text-[20px] leading-none">
          {item.icon}
        </span>
        <span className="hidden sm:inline">{item.label}</span>
      </Link>
    </li>
  )
}
