import { describe, expect, it } from 'vitest'
import { socialProviders } from './auth-providers'

const google = { GOOGLE_CLIENT_ID: 'gid', GOOGLE_CLIENT_SECRET: 'gsecret' }

describe('socialProviders', () => {
  it('configures a provider whose credentials are both present', () => {
    expect(socialProviders(google)).toEqual({
      google: { clientId: 'gid', clientSecret: 'gsecret' },
    })
  })

  it('configures nothing when the environment is empty', () => {
    // CI builds the app without four sets of OAuth secrets.
    expect(socialProviders({})).toEqual({})
  })

  it('skips a provider missing its secret', () => {
    // Half-configured renders a sign-in button that fails at the redirect,
    // which is worse than not offering the button at all.
    expect(socialProviders({ GOOGLE_CLIENT_ID: 'gid' })).toEqual({})
  })

  it('skips a provider missing its id', () => {
    expect(socialProviders({ GOOGLE_CLIENT_SECRET: 'gsecret' })).toEqual({})
  })

  it('treats an empty string as unset, because that is how CI supplies it', () => {
    expect(socialProviders({ GOOGLE_CLIENT_ID: '', GOOGLE_CLIENT_SECRET: '' })).toEqual({})
  })

  it('configures each provider independently', () => {
    const configured = socialProviders({
      ...google,
      FACEBOOK_CLIENT_ID: 'fid',
      FACEBOOK_CLIENT_SECRET: 'fsecret',
      APPLE_CLIENT_ID: 'aid',
    })

    expect(Object.keys(configured).sort()).toEqual(['facebook', 'google'])
  })

  it('supports all three the questionnaire asked for', () => {
    const configured = socialProviders({
      ...google,
      FACEBOOK_CLIENT_ID: 'fid',
      FACEBOOK_CLIENT_SECRET: 'fsecret',
      APPLE_CLIENT_ID: 'aid',
      APPLE_CLIENT_SECRET: 'asecret',
    })

    expect(Object.keys(configured).sort()).toEqual(['apple', 'facebook', 'google'])
  })
})
