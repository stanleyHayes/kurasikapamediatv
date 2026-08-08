'use client'

import { signIn } from '../../lib/auth-client'

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
  callbackURL,
}: {
  providers: readonly SocialProvider[]
  callbackURL: string
}): React.ReactElement | null {
  if (providers.length === 0) return null

  return (
    <div className="border-outline-variant flex flex-col gap-2 border-t pt-[var(--spacing-sm)]">
      {providers.map((provider) => (
        <button
          key={provider}
          type="button"
          onClick={() => void signIn.social({ provider, callbackURL })}
          className="border-outline-variant text-label-bold rounded border px-4 py-2 uppercase"
        >
          Continue with {LABEL[provider]}
        </button>
      ))}
    </div>
  )
}
