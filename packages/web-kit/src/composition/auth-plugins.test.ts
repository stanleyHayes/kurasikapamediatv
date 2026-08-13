import { describe, expect, it } from 'vitest'
import { authPlugins, hasTurnstile } from './auth-plugins'

describe('authPlugins', () => {
  it('always includes two-factor and ends with nextCookies', () => {
    const plugins = authPlugins({})

    expect(plugins[0]?.id).toBe('two-factor')
    expect(plugins.at(-1)?.id).toBe('next-cookies')
    expect(plugins.some((plugin) => plugin.id === 'captcha')).toBe(false)
  })

  it('adds Turnstile only when the secret is set', () => {
    const plugins = authPlugins({ TURNSTILE_SECRET_KEY: 'secret' })

    expect(plugins.some((plugin) => plugin.id === 'captcha')).toBe(true)
    expect(plugins.at(-1)?.id).toBe('next-cookies')
  })
})

describe('hasTurnstile', () => {
  it('requires both the secret and the public site key', () => {
    expect(hasTurnstile({})).toBe(false)
    expect(hasTurnstile({ TURNSTILE_SECRET_KEY: 's' })).toBe(false)
    expect(hasTurnstile({ TURNSTILE_SECRET_KEY: 's', NEXT_PUBLIC_TURNSTILE_SITE_KEY: 'site' })).toBe(
      true,
    )
  })
})
