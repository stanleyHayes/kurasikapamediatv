import { describe, expect, it } from 'vitest'
import { Actor, NotPermitted, requirePermission } from './actor'
import { ROLES, permissionsOf } from './role'
import { userId } from '../shared/ids'

const someone = userId('usr_1')

describe('role permissions', () => {
  it('covers all eleven roles from the questionnaire', () => {
    expect(ROLES).toHaveLength(11)
  })

  it('lets a super admin assign roles', () => {
    expect(permissionsOf(['super_admin']).has('role:assign')).toBe(true)
  })

  it('does not let an administrator assign roles', () => {
    // The one thing that separates the two. Otherwise an admin could self-promote.
    expect(permissionsOf(['administrator']).has('role:assign')).toBe(false)
  })

  it('never lets an author publish', () => {
    expect(permissionsOf(['author']).has('article:publish')).toBe(false)
  })

  it('never lets an editor assign roles', () => {
    expect(permissionsOf(['editor']).has('role:assign')).toBe(false)
  })

  it('lets an editor publish', () => {
    expect(permissionsOf(['editor']).has('article:publish')).toBe(true)
  })

  it('gives a guest nothing', () => {
    expect(permissionsOf(['guest']).size).toBe(0)
  })

  it('unions permissions across multiple roles', () => {
    const combined = permissionsOf(['photographer', 'social_media_manager'])
    expect(combined.has('asset:upload_image')).toBe(true)
    expect(combined.has('social:publish')).toBe(true)
    expect(combined.has('article:publish')).toBe(false)
  })
})

describe('Actor', () => {
  it('recognises itself', () => {
    expect(new Actor(someone, ['author']).is(someone)).toBe(true)
  })

  it('does not recognise another user', () => {
    expect(new Actor(someone, ['author']).is(userId('usr_2'))).toBe(false)
  })

  it('requirePermission passes when permitted', () => {
    expect(() => { requirePermission(new Actor(someone, ['editor']), 'article:publish') }).not.toThrow()
  })

  it('requirePermission throws when not', () => {
    expect(() => { requirePermission(new Actor(someone, ['author']), 'article:publish') }).toThrow(NotPermitted)
  })
})
