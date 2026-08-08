/**
 * The eleven roles from the signed questionnaire (§ 8), and what each may do.
 *
 * This is the authorisation model. Auth.js establishes *who* someone is;
 * this file decides *what they may do*. A role check in a React component is
 * cosmetic and is never the control. See ADR-0004.
 */
export const ROLES = [
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
] as const

export type Role = (typeof ROLES)[number]

export const PERMISSIONS = [
  'article:draft',
  'article:edit_own',
  'article:edit_any',
  'article:submit',
  'article:approve',
  'article:publish',
  'article:unpublish',
  'asset:upload_image',
  'asset:upload_video',
  'stream:manage',
  'social:publish',
  'campaign:view_own',
  'role:assign',
  'audit:read',
] as const

export type Permission = (typeof PERMISSIONS)[number]

const EDITOR_PERMISSIONS: readonly Permission[] = [
  'article:draft',
  'article:edit_own',
  'article:edit_any',
  'article:submit',
  'article:approve',
  'article:publish',
  'article:unpublish',
  'asset:upload_image',
]

const ROLE_PERMISSIONS: Readonly<Record<Role, readonly Permission[]>> = {
  super_admin: PERMISSIONS,
  administrator: PERMISSIONS.filter((p) => p !== 'role:assign'),
  editor: EDITOR_PERMISSIONS,
  journalist: ['article:draft', 'article:edit_own', 'article:submit', 'asset:upload_image'],
  author: ['article:draft', 'article:edit_own', 'article:submit'],
  photographer: ['asset:upload_image'],
  video_editor: ['asset:upload_video', 'stream:manage'],
  social_media_manager: ['social:publish'],
  advertiser: ['campaign:view_own'],
  subscriber: [],
  guest: [],
}

export function permissionsOf(roles: readonly Role[]): ReadonlySet<Permission> {
  return new Set(roles.flatMap((role) => ROLE_PERMISSIONS[role]))
}
