import { Link } from '@kurasikapa/web-kit/i18n/navigation'
import { TwoFactorSettings } from '../auth/two-factor-settings'

/**
 * The "Account & Preferences" row from the Stitch profile design.
 *
 * Profile details still point at contact until a dedicated editor exists.
 * Notifications wait on R2. Security now hosts 2FA enablement.
 */
export function AccountCards(): React.ReactElement {
  return (
    <section className="mt-[var(--spacing-lg)]">
      <h2 className="font-display text-on-surface border-outline-variant border-b pb-4 text-[length:var(--text-headline-md)] font-semibold">
        Account &amp; preferences
      </h2>

      <div className="mt-[var(--spacing-md)] grid grid-cols-1 gap-6 md:grid-cols-3">
        <Card title="Profile details" body="Your name and email, as they appear on anything you post." icon="◍">
          <Link
            href="/contact"
            className="text-label-bold text-secondary mt-4 inline-block uppercase underline-offset-4 hover:underline"
          >
            Manage
          </Link>
        </Card>

        <Card title="Notifications" body="Breaking-news alerts and the daily briefing." icon="◔">
          <span className="text-label-bold text-on-surface-variant/60 border-outline-variant mt-4 inline-block rounded-full border px-2 py-1 text-[10px] uppercase">
            Arrives with newsletters
          </span>
        </Card>

        <Card title="Security" body="Password and two-factor authentication." icon="◈">
          <div className="mt-4">
            <TwoFactorSettings />
          </div>
        </Card>
      </div>
    </section>
  )
}

function Card({
  title,
  body,
  icon,
  children,
}: {
  title: string
  body: string
  icon: string
  children: React.ReactNode
}): React.ReactElement {
  return (
    <div className="border-outline-variant bg-surface-container-lowest flex flex-col gap-6 rounded-xl border p-6">
      <span
        aria-hidden
        className="bg-surface-container text-on-surface-variant flex h-12 w-12 items-center justify-center rounded-full text-xl"
      >
        {icon}
      </span>
      <div>
        <h3 className="font-display text-on-surface text-xl font-semibold">{title}</h3>
        <p className="text-on-surface-variant mt-2 text-sm">{body}</p>
        {children}
      </div>
    </div>
  )
}
