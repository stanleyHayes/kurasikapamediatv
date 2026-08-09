import { Link } from '../../i18n/navigation'

/**
 * The "Account & Preferences" row from the Stitch profile design.
 *
 * Three cards: Profile Details, Notifications, Security. Only the first has
 * anywhere to go — notification preferences arrive with the newsletter work in
 * R2, and password and two-factor management are R1 security work that is not
 * built. Rather than three cards where two are dead links, the unbuilt two say
 * what they are waiting for.
 *
 * A settings card that opens nothing teaches a reader their account controls
 * are broken; one that says "coming with alerts" teaches them it is coming.
 */
const CARDS = [
  {
    title: 'Profile details',
    body: 'Your name and email, as they appear on anything you post.',
    icon: '◍',
    href: '/contact',
  },
  {
    title: 'Notifications',
    body: 'Breaking-news alerts and the daily briefing.',
    icon: '◔',
    waitingOn: 'Arrives with newsletters',
  },
  {
    title: 'Security',
    body: 'Password and two-factor authentication.',
    icon: '◈',
    waitingOn: 'Not yet available',
  },
] as const

export function AccountCards(): React.ReactElement {
  return (
    <section className="mt-[var(--spacing-lg)]">
      <h2 className="font-display text-on-surface border-outline-variant border-b pb-4 text-[length:var(--text-headline-md)] font-semibold">
        Account &amp; preferences
      </h2>

      <div className="mt-[var(--spacing-md)] grid grid-cols-1 gap-6 md:grid-cols-3">
        {CARDS.map((card) => (
          <div
            key={card.title}
            className="border-outline-variant bg-surface-container-lowest flex flex-col gap-6 rounded-xl border p-6"
          >
            <span
              aria-hidden
              className="bg-surface-container text-on-surface-variant flex h-12 w-12 items-center justify-center rounded-full text-xl"
            >
              {card.icon}
            </span>

            <div>
              <h3 className="font-display text-on-surface text-xl font-semibold">{card.title}</h3>
              <p className="text-on-surface-variant mt-2 text-sm">{card.body}</p>

              {'href' in card ? (
                <Link
                  href={card.href}
                  className="text-label-bold text-secondary mt-4 inline-block uppercase underline-offset-4 hover:underline"
                >
                  Manage
                </Link>
              ) : (
                <span className="text-label-bold text-on-surface-variant/60 border-outline-variant mt-4 inline-block rounded-full border px-2 py-1 text-[10px] uppercase">
                  {card.waitingOn}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
