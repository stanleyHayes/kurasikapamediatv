export interface ProviderCredentials {
  readonly clientId: string
  readonly clientSecret: string
}

export type SocialProviders = Partial<Record<'google' | 'facebook' | 'apple', ProviderCredentials>>

type Source = Readonly<Record<string, string | undefined>>

function pair(env: Source, prefix: string): ProviderCredentials | undefined {
  const clientId = env[`${prefix}_CLIENT_ID`]
  const clientSecret = env[`${prefix}_CLIENT_SECRET`]

  return clientId !== undefined && clientId !== '' && clientSecret !== undefined && clientSecret !== ''
    ? { clientId, clientSecret }
    : undefined
}

/**
 * Only providers with real credentials are configured.
 *
 * A provider registered with empty strings renders a sign-in button that fails
 * at the redirect — worse than not offering it. This also lets a developer run
 * the CMS locally with email sign-in alone, and keeps CI from needing four sets
 * of OAuth secrets to build.
 */
export function socialProviders(env: Source): SocialProviders {
  const configured: SocialProviders = {}

  const google = pair(env, 'GOOGLE')
  const facebook = pair(env, 'FACEBOOK')
  const apple = pair(env, 'APPLE')

  if (google) configured.google = google
  if (facebook) configured.facebook = facebook
  if (apple) configured.apple = apple

  return configured
}
