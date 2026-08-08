import { Actor, CannotAssignOwnRoles, NotPermitted, UnknownRole, userId } from '@kurasikapa/domain'
import { describe, expect, it } from 'vitest'
import type { Role } from '@kurasikapa/domain'
import { FakeClock, RecordingEventBus } from '../testing/fakes'
import { InMemoryRoleRepository } from '../testing/in-memory-role-repository'
import { AssignRoles } from './assign-roles'
import { ResolveActor } from './resolve-actor'

const NOW = new Date('2026-08-08T10:00:00Z')
const ADMIN = userId('usr_admin')
const TARGET = userId('usr_target')

const superAdmin = new Actor(ADMIN, ['super_admin'])
const editor = new Actor(ADMIN, ['editor'])

interface Deps {
  readonly roles: InMemoryRoleRepository
  readonly clock: FakeClock
  readonly events: RecordingEventBus
}

const deps = (seed: Readonly<Record<string, readonly Role[]>> = {}): Deps => ({
  roles: new InMemoryRoleRepository(seed),
  clock: new FakeClock(NOW),
  events: new RecordingEventBus(),
})

describe('ResolveActor', () => {
  it('builds an Actor carrying the stored roles', async () => {
    const d = deps({ [TARGET]: ['editor'] })

    const actor = await new ResolveActor(d).execute({ userId: TARGET })

    expect(actor?.can('article:publish')).toBe(true)
  })

  it('returns null when signed out', async () => {
    expect(await new ResolveActor(deps()).execute({ userId: null })).toBeNull()
  })

  it('gives a signed-in reader with no grants an Actor that can do nothing', async () => {
    const actor = await new ResolveActor(deps()).execute({ userId: TARGET })

    expect(actor).not.toBeNull()
    expect(actor?.can('article:draft')).toBe(false)
  })

  it('reads roles on every resolution, so a revocation takes effect next request', async () => {
    // Carrying roles in the session token instead would leave a revoked editor
    // publishing until their token happened to expire.
    const d = deps({ [TARGET]: ['editor'] })
    const resolve = new ResolveActor(d)

    expect((await resolve.execute({ userId: TARGET }))?.can('article:publish')).toBe(true)

    await d.roles.replace(TARGET, [])

    expect((await resolve.execute({ userId: TARGET }))?.can('article:publish')).toBe(false)
  })
})

describe('AssignRoles', () => {
  it('replaces the target roles', async () => {
    const d = deps()

    const result = await new AssignRoles(d).execute({
      actor: superAdmin,
      targetUserId: TARGET,
      roles: ['editor'],
    })

    expect(result.roles).toEqual(['editor'])
    expect(await d.roles.rolesFor(TARGET)).toEqual(['editor'])
  })

  it('replaces rather than adds, so the admin screen shows the whole truth', async () => {
    const d = deps({ [TARGET]: ['editor'] })

    await new AssignRoles(d).execute({
      actor: superAdmin,
      targetUserId: TARGET,
      roles: ['journalist'],
    })

    expect(await d.roles.rolesFor(TARGET)).toEqual(['journalist'])
  })

  it('revokes everything when given an empty list', async () => {
    const d = deps({ [TARGET]: ['editor'] })

    await new AssignRoles(d).execute({ actor: superAdmin, targetUserId: TARGET, roles: [] })

    expect(await d.roles.rolesFor(TARGET)).toEqual([])
  })

  it('records who changed whose roles, for the audit log', async () => {
    const d = deps()

    await new AssignRoles(d).execute({
      actor: superAdmin,
      targetUserId: TARGET,
      roles: ['editor'],
    })

    expect(d.events.last()).toMatchObject({
      name: 'identity.roles_assigned',
      actorId: ADMIN,
      targetUserId: TARGET,
      roles: ['editor'],
    })
  })
})

describe('AssignRoles — refusals write nothing', () => {
  it('refuses an actor without role:assign', async () => {
    const d = deps()

    await expect(
      new AssignRoles(d).execute({ actor: editor, targetUserId: TARGET, roles: ['editor'] }),
    ).rejects.toThrow(NotPermitted)

    expect(await d.roles.rolesFor(TARGET)).toEqual([])
    expect(d.events.published).toHaveLength(0)
  })

  it('refuses self-promotion', async () => {
    const d = deps()

    await expect(
      new AssignRoles(d).execute({
        actor: superAdmin,
        targetUserId: ADMIN,
        roles: ['super_admin'],
      }),
    ).rejects.toThrow(CannotAssignOwnRoles)

    expect(await d.roles.rolesFor(ADMIN)).toEqual([])
  })

  it('refuses an unknown role and stores none of the batch', async () => {
    const d = deps()

    await expect(
      new AssignRoles(d).execute({
        actor: superAdmin,
        targetUserId: TARGET,
        roles: ['editor', 'chief_wizard'],
      }),
    ).rejects.toThrow(UnknownRole)

    expect(await d.roles.rolesFor(TARGET)).toEqual([])
  })
})
