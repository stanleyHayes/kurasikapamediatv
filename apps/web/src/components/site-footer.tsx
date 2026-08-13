import { cacheLife } from 'next/cache'
import { Link } from '@kurasikapa/web-kit/i18n/navigation'

/**
 * Every standing page is reachable from here.
 *
 * A page nobody can navigate to is not built, whatever the route table says —
 * and the legal three in particular must be one click from anywhere, which is
 * what makes a footer the right home for them.
 */
const LINKS = [
  { href: '/about', label: 'About' },
  { href: '/team', label: 'Our team' },
  { href: '/contact', label: 'Contact' },
  { href: '/faq', label: 'FAQ' },
  { href: '/advertise', label: 'Advertise' },
  { href: '/careers', label: 'Careers' },
  { href: '/legal/privacy', label: 'Privacy' },
  { href: '/legal/terms', label: 'Terms' },
  { href: '/legal/cookies', label: 'Cookies' },
] as const

/**
 * NOT cached as a whole.
 *
 * next-intl's Link resolves the locale through `headers()`, and dynamic data
 * inside a `use cache` scope is refused outright. Only the year needs caching,
 * so only the year is cached — which is the right decomposition anyway: cache
 * the thing that changes with time, not the markup around it.
 */
export function SiteFooter(): React.ReactElement {
  return (
    <footer className="border-outline-variant bg-surface-container-lowest mt-[var(--spacing-xl)] border-t">
      <div className="mx-auto flex max-w-[var(--container-page)] flex-col items-center gap-6 px-6 py-12 text-center">
        <p className="font-display text-secondary text-[length:var(--text-headline-md)]">Kurasikapa Media TV</p>

        <nav aria-label="Site information">
          <ul className="text-on-surface-variant flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm">
            {LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="hover:text-primary transition-colors">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <p className="text-on-surface-variant text-sm">
          © <CopyrightYear /> Kurasikapa Media TV
        </p>
      </div>
    </footer>
  )
}

/**
 * The year is *data*, not markup. A prerendered page has no "now", so reading
 * the clock in a Server Component is a prerender error; `use cache` with a
 * daily lifetime gives it a defined freshness instead of freezing it at build.
 */
// eslint-disable-next-line @typescript-eslint/require-await -- `use cache` requires async; nothing to await.
async function CopyrightYear(): Promise<React.ReactElement> {
  'use cache'
  cacheLife('days')

  return <>{new Date().getUTCFullYear()}</>
}
