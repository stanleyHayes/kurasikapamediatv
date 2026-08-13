'use client'

import { SignOutButton } from './sign-out-button'
import { Link, usePathname } from '@kurasikapa/web-kit/i18n/navigation'

/**
 * The docked studio navigation, per the Stitch editorial CMS: a 256px rail
 * carrying the admin identity, the section links, and the primary action.
 *
 * Only the destinations that exist are rendered as links. The design also
 * draws Analytics (R5), Media (R3) and Settings — showing them as dead items
 * would teach an editor that the newsroom's own tools are broken, so they are
 * listed as forthcoming instead, which is true and keeps the rail's shape.
 *
 * The hrefs are prefix-free because `/studio` is a basePath now — Next
 * prepends it at render time, so writing it here would produce
 * `/studio/studio/review`. See ADR-0011.
 */
const LIVE = [
  { href: '/', label: 'Editorial', icon: '✎' },
  { href: '/review', label: 'Review', icon: '☑' },
  { href: '/social', label: 'Social', icon: '◈' },
  { href: '/rss', label: 'RSS', icon: '◎' },
  { href: '/comments', label: 'Comments', icon: '¶' },
  { href: '/people', label: 'Users', icon: '☰' },
  { href: '/audit', label: 'Audit', icon: '◫' },
] as const

const FORTHCOMING = [
  { label: 'Analytics', icon: '◔', release: 'R5' },
  { label: 'Media', icon: '▣', release: 'R3' },
  { label: 'Settings', icon: '⚙', release: 'R5' },
] as const

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
      className="border-outline-variant bg-surface-container-low hidden h-full w-64 shrink-0 flex-col border-r p-4 md:flex"
    >
      <Identity />

      <ul className="flex flex-grow flex-col gap-2">
        {LIVE.map((item) => (
          <NavLink key={item.href} item={item} active={active === item.href} />
        ))}
        {FORTHCOMING.map((item) => (
          <Forthcoming key={item.label} item={item} />
        ))}
      </ul>

      <div className="border-outline-variant mt-auto border-t pt-6">
        <SignOutButton />
      </div>
    </nav>
  )
}

function Identity(): React.ReactElement {
  return (
    <div className="mt-4 mb-8 flex items-center gap-4 px-2">
      <span
        aria-hidden
        className="border-outline-variant bg-surface-container-high flex h-10 w-10 items-center justify-center rounded-full border"
      >
        K
      </span>
      <div>
        <p className="font-display text-primary text-[20px] leading-tight font-semibold">
          Kurasikapa Admin
        </p>
        <p className="text-label-bold text-on-surface-variant mt-1 text-[10px] uppercase">
          Editorial Control
        </p>
      </div>
    </div>
  )
}

function NavLink({
  item,
  active,
}: {
  item: (typeof LIVE)[number]
  active: boolean
}): React.ReactElement {
  return (
    <li>
      <Link
        href={item.href}
        aria-current={active ? 'page' : undefined}
        className={
          active
            ? 'bg-secondary-container text-on-secondary-container flex items-center gap-3 rounded-lg px-3 py-2 font-bold'
            : 'text-on-surface-variant hover:bg-surface-container-high flex items-center gap-3 rounded-lg px-3 py-2 transition-colors'
        }
      >
        <span aria-hidden className="text-[20px] leading-none">
          {item.icon}
        </span>
        <span>{item.label}</span>
      </Link>
    </li>
  )
}

/**
 * A destination that does not exist yet, shown rather than hidden.
 *
 * The design draws six sections. Rendering the three unbuilt ones as dead
 * links would teach an editor the newsroom's own tools are broken; omitting
 * them hides the roadmap. Naming the release is true and keeps the rail's shape.
 */
function Forthcoming({ item }: { item: (typeof FORTHCOMING)[number] }): React.ReactElement {
  return (
    <li>
      <span className="text-on-surface-variant/40 flex items-center gap-3 rounded-lg px-3 py-2">
        <span aria-hidden className="text-[20px] leading-none">
          {item.icon}
        </span>
        <span>{item.label}</span>
        <span className="text-label-bold border-outline-variant ml-auto rounded-full border px-1.5 text-[9px]">
          {item.release}
        </span>
      </span>
    </li>
  )
}
