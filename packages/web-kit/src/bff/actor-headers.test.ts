import { afterEach, describe, expect, it, vi } from 'vitest'
import { resetEnv } from '../composition/env'
import { actorHeaders } from './actor-headers'

describe('actorHeaders', () => {
  afterEach(() => { vi.unstubAllEnvs(); resetEnv() })

  it('proves the calling service without exposing a browser credential', () => {
    vi.stubEnv('MONGODB_URI', 'mongodb://test')
    vi.stubEnv('BETTER_AUTH_SECRET', 'x'.repeat(32))
    vi.stubEnv('CRON_SECRET', 's'.repeat(32))
    resetEnv()

    expect(actorHeaders('usr_editor', { 'Content-Type': 'application/json' })).toEqual({
      Authorization: `Bearer ${'s'.repeat(32)}`,
      'Content-Type': 'application/json',
      'X-Kurasikapa-User': 'usr_editor',
    })
  })
})
