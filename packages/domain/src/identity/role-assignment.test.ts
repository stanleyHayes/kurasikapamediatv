import { describe, expect, it } from 'vitest'
import { userId } from '../shared/ids'
import { Actor, NotPermitted } from './actor'
import { CannotAssignOwnRoles, UnknownRole, assertMayAssignRoles } from './role-assignment'

const ADMIN = userId('usr_admin')
const TARGET = userId('usr_target')

const superAdmin = new Actor(ADMIN, ['super_admin'])
const administrator = new Actor(ADMIN, ['administrator'])
const editor = new Actor(ADMIN, ['editor'])

describe('assertMayAssignRoles', () => {
  it('lets a super admin assign roles to someone else', () => {
    expect(() => {
      assertMayAssignRoles(superAdmin, TARGET, ['journalist'])
    }).not.toThrow()
  })

  it('refuses an administrator, who does not hold role:assign', () => {
    expect(() => {
      assertMayAssignRoles(administrator, TARGET, ['journalist'])
    }).toThrow(NotPermitted)
  })

  it('refuses an editor outright', () => {
    expect(() => {
      assertMayAssignRoles(editor, TARGET, ['editor'])
    }).toThrow(NotPermitted)
  })

  it('refuses self-assignment even for a super admin', () => {
    // Otherwise `role:assign` is not one permission, it is a route to all of
    // them — and the audit log shows one person granting themselves whatever
    // they needed. Promotion takes two people.
    expect(() => {
      assertMayAssignRoles(superAdmin, ADMIN, ['super_admin'])
    }).toThrow(CannotAssignOwnRoles)
  })

  it('checks permission before self-assignment, leaking nothing to an outsider', () => {
    expect(() => {
      assertMayAssignRoles(editor, ADMIN, ['super_admin'])
    }).toThrow(NotPermitted)
  })

  it('refuses a role the platform does not define', () => {
    // Roles arrive from an HTTP form. Storing an unknown one would leave a
    // user with a role that silently resolves to no permissions.
    expect(() => {
      assertMayAssignRoles(superAdmin, TARGET, ['journalist', 'chief_wizard'])
    }).toThrow(UnknownRole)
  })

  it('names the offending role', () => {
    expect(() => {
      assertMayAssignRoles(superAdmin, TARGET, ['chief_wizard'])
    }).toThrow(/chief_wizard/u)
  })

  it('accepts an empty list, which is how access is revoked', () => {
    expect(() => {
      assertMayAssignRoles(superAdmin, TARGET, [])
    }).not.toThrow()
  })

  it('accepts every role the platform defines', () => {
    const all = [
      'super_admin',
      'administrator',
      'editor',
      'journalist',
      'author',
      'photographer',
      'video_editor',
      'social_media_manager',
      'advertiser',
      'subscriber',
      'guest',
    ]

    expect(() => {
      assertMayAssignRoles(superAdmin, TARGET, all)
    }).not.toThrow()
  })
})
