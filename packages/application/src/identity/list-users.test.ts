import { NotPermitted, userId } from '@kurasikapa/domain'
import { describe, expect, it } from 'vitest'
import { InMemoryUserDirectory } from '../testing/in-memory-user-directory'
import { aStranger, anEditor, harness } from '../testing/harness'
import { ListUsers } from './list-users'
import { Actor } from '@kurasikapa/domain'

const superAdmin = new Actor(userId('usr_admin'), ['super_admin'])

const directory = (): InMemoryUserDirectory =>
  new InMemoryUserDirectory([
    { id: userId('usr_1'), email: 'editor@kurasikapa.tv', name: 'An Editor', roles: ['editor'] },
    { id: userId('usr_2'), email: 'reader@example.com', name: 'A Reader', roles: [] },
  ])

describe('ListUsers', () => {
  it('returns everyone, with their roles', async () => {
    const page = await new ListUsers({ users: directory() }).execute({ actor: superAdmin })

    expect(page.items.map((u) => u.email)).toEqual(['editor@kurasikapa.tv', 'reader@example.com'])
    expect(page.items[0]?.roles).toEqual(['editor'])
  })

  it('refuses an editor — the list is every registered email on the platform', async () => {
    // A disclosure in its own right, quite apart from what you can do with it.
    await expect(
      new ListUsers({ users: directory() }).execute({ actor: anEditor }),
    ).rejects.toThrow(NotPermitted)
  })

  it('refuses before reading anything', async () => {
    const users = directory()

    await expect(new ListUsers({ users }).execute({ actor: aStranger })).rejects.toThrow(
      NotPermitted,
    )
    expect(users.calls).toHaveLength(0)
  })

  it.each([
    ['an absent', undefined, 50],
    ['a zero', 0, 50],
    ['an absurd', 100_000, 200],
  ])('maps %s limit to %i', async (_label, requested, expected) => {
    const users = directory()

    await new ListUsers({ users }).execute({ actor: superAdmin, limit: requested })

    expect(users.calls[0]?.limit).toBe(expected)
  })
})

describe('harness sanity', () => {
  it('shares the actors the other identity tests use', () => {
    expect(harness().clock.now()).toBeInstanceOf(Date)
  })
})
