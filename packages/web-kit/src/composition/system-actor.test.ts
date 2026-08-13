import { describe, expect, it } from 'vitest'
import { SYSTEM_ACTOR_ID, systemActor } from './system-actor'

describe('systemActor', () => {
  it('may publish, because that is its whole job', () => {
    expect(systemActor().can('article:publish')).toBe(true)
  })

  it('may not assign roles', () => {
    // Least privilege. The cron publishes; it never grants anyone access, and
    // an identity nobody watches should hold the smallest set that works.
    expect(systemActor().can('role:assign')).toBe(false)
  })

  it('is identifiable in an audit trail', () => {
    // A publication attributed to a blank or borrowed id is a publication
    // nobody can trace. The scheduler gets its own name.
    expect(systemActor().id).toBe(SYSTEM_ACTOR_ID)
    expect(SYSTEM_ACTOR_ID).not.toBe('')
  })
})
