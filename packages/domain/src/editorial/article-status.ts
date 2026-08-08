/**
 * The editorial workflow, as a state machine.
 *
 *   Draft ──submit──▶ In Review ──approve──▶ Approved ──schedule──▶ Scheduled ──▶ Published
 *     ▲                   │                                                          │
 *     └──────reject───────┘                                              unpublish───┘
 *
 * Both the legal transitions and the permission each one demands live here,
 * so neither can be answered by reading a route handler.
 */
import type { Permission } from '../identity/role'

export const ARTICLE_STATUSES = [
  'draft',
  'in_review',
  'approved',
  'scheduled',
  'published',
  'unpublished',
] as const

export type ArticleStatus = (typeof ARTICLE_STATUSES)[number]

export const TRANSITIONS = [
  'submit',
  'approve',
  'reject',
  'schedule',
  'publish',
  'unpublish',
] as const

export type Transition = (typeof TRANSITIONS)[number]

export interface TransitionRule {
  readonly from: readonly ArticleStatus[]
  readonly to: ArticleStatus
  readonly permission: Permission
  /** Whether the actor must own the article (unless they may edit any). */
  readonly authorOnly: boolean
}

const RULES: Readonly<Record<Transition, TransitionRule>> = {
  submit: { from: ['draft'], to: 'in_review', permission: 'article:submit', authorOnly: true },
  approve: { from: ['in_review'], to: 'approved', permission: 'article:approve', authorOnly: false },
  reject: { from: ['in_review'], to: 'draft', permission: 'article:approve', authorOnly: false },
  schedule: { from: ['approved'], to: 'scheduled', permission: 'article:publish', authorOnly: false },
  publish: {
    from: ['approved', 'scheduled', 'unpublished'],
    to: 'published',
    permission: 'article:publish',
    authorOnly: false,
  },
  unpublish: { from: ['published'], to: 'unpublished', permission: 'article:unpublish', authorOnly: false },
}

export function ruleFor(transition: Transition): TransitionRule {
  return RULES[transition]
}

export function isAllowedFrom(transition: Transition, status: ArticleStatus): boolean {
  return RULES[transition].from.includes(status)
}

/** Only these statuses are visible to a reader. */
export function isPubliclyVisible(status: ArticleStatus): boolean {
  return status === 'published'
}
