export type SocialProvider = 'google' | 'facebook' | 'apple'

const LABEL: Readonly<Record<SocialProvider, string>> = {
  google: 'Google',
  facebook: 'Facebook',
  apple: 'Apple',
}

/**
 * Renders nothing when no provider is configured, rather than an empty
 * divider — a sign-in page with a rule and blank space under it looks broken.
 */
export function SocialButtons({
  providers,
}: {
  providers: readonly SocialProvider[]
  /** Accepted and unused: the callback URL is fixed server-side now. */
  callbackURL?: string
}): React.ReactElement | null {
  if (providers.length === 0) return null

  return (
    <div className="border-outline-variant flex flex-col gap-3 border-t pt-6">
      {/*
        Plain links, not fetches. The provider round trip is a navigation: the
        route sets the state, nonce and PKCE cookies and 302s onward, and an
        XHR would follow that redirect without ever leaving the page.
      */}
      {providers.map((provider) => (
        <a
          key={provider}
          href={`/api/oauth/${provider}`}
          className="border-outline-variant hover:border-primary hover:text-primary flex h-12 w-full items-center justify-center rounded-xl border px-4 text-sm font-semibold transition-colors"
        >
          Continue with {LABEL[provider]}
        </a>
      ))}
    </div>
  )
}
