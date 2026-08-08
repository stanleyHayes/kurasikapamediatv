import { Link } from '../i18n/navigation'

/**
 * The fixed top bar from the Stitch homepage.
 *
 * Sections are the site's real navigation and are hard-coded here rather than
 * read from the database on purpose: the header is part of the prerendered
 * shell, and a query would make every page wait on it. The section pages
 * themselves 404 honestly if a slug is not configured.
 */
const SECTIONS = [
  { href: '/sections/politics', label: 'Politics' },
  { href: '/sections/business', label: 'Business' },
  { href: '/sections/education', label: 'Education' },
] as const

function SectionNav({ liveLabel }: { liveLabel: string }): React.ReactElement {
  return (
    <ul className="hidden gap-6 md:flex">
      {SECTIONS.map((s) => (
        <li key={s.href}>
          <Link
            href={s.href}
            className="text-label-bold text-on-surface-variant hover:text-secondary uppercase transition-colors"
          >
            {s.label}
          </Link>
        </li>
      ))}
      <li>
        {/* Live TV lands in R3. The indicator is here because the design puts
            it here, and it does not pretend to link anywhere yet. */}
        <span className="text-label-bold text-secondary inline-flex items-center gap-2 uppercase">
          <span className="bg-secondary inline-block h-2 w-2 animate-pulse rounded-full" />
          {liveLabel}
        </span>
      </li>
    </ul>
  )
}

function ReaderActions(): React.ReactElement {
  return (
    <div className="flex items-center gap-4">
      <Link
        href="/search"
        className="border-outline-variant text-label-bold text-on-surface-variant hover:text-secondary hidden rounded-full border px-4 py-2 uppercase transition-colors lg:inline-block"
      >
        Search
      </Link>
      <Link
        href="/profile"
        className="text-label-bold text-on-surface-variant hover:text-secondary uppercase transition-colors"
      >
        Saved
      </Link>
      <Link
        href="/sign-in"
        className="bg-secondary-container text-on-secondary-container text-label-bold rounded px-4 py-2 uppercase"
      >
        Sign in
      </Link>
    </div>
  )
}

export function SiteHeader({ liveLabel }: { liveLabel: string }): React.ReactElement {
  return (
    <header className="border-outline-variant bg-surface/90 fixed top-0 z-50 w-full border-b backdrop-blur">
      <nav
        aria-label="Primary"
        className="mx-auto flex max-w-[var(--container-page)] items-center justify-between gap-8 px-6 py-4"
      >
        <div className="flex items-center gap-8">
          <Link
            href="/"
            className="font-display text-on-surface text-2xl font-bold tracking-tight md:text-[32px]"
          >
            Kurasikapa
          </Link>

          <SectionNav liveLabel={liveLabel} />
        </div>

        <ReaderActions />
      </nav>
    </header>
  )
}
