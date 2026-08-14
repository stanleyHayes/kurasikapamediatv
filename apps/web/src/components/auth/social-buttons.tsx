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
    <div className="border-outline-variant flex flex-col gap-3 border-t pt-6">
      {providers.map((provider) => (
        <button
          key={provider}
          type="button"
          onClick={() => void signIn.social({ provider, callbackURL })}
          className="border-outline-variant hover:border-primary hover:text-primary h-12 w-full rounded-xl border px-4 text-sm font-semibold transition-colors"
        >
          Continue with {LABEL[provider]}
        </button>
      ))}
    </div>
  )
}
