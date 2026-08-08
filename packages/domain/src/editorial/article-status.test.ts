import { describe, expect, it } from 'vitest'
import {
  ARTICLE_STATUSES,
  TRANSITIONS,
  isAllowedFrom,
  isPubliclyVisible,
  ruleFor,
} from './article-status.js'

describe('isPubliclyVisible', () => {
  it('shows published articles', () => {
    expect(isPubliclyVisible('published')).toBe(true)
  })

  it.each(ARTICLE_STATUSES.filter((s) => s !== 'published'))('hides %s', (status) => {
    expect(isPubliclyVisible(status)).toBe(false)
  })
})

describe('ruleFor', () => {
  it.each(TRANSITIONS)('%s declares a permission and a target state', (transition) => {
    const rule = ruleFor(transition)
    expect(rule.permission).toBeTruthy()
    expect(ARTICLE_STATUSES).toContain(rule.to)
    expect(rule.from.length).toBeGreaterThan(0)
  })

  it('only submit is restricted to the author', () => {
    const authorOnly = TRANSITIONS.filter((t) => ruleFor(t).authorOnly)
    expect(authorOnly).toEqual(['submit'])
  })

  it('publish is reachable from approved, scheduled and unpublished', () => {
    expect(ruleFor('publish').from).toEqual(['approved', 'scheduled', 'unpublished'])
  })
})

describe('isAllowedFrom', () => {
  it('allows submit from draft', () => {
    expect(isAllowedFrom('submit', 'draft')).toBe(true)
  })

  it('forbids submit from published', () => {
    expect(isAllowedFrom('submit', 'published')).toBe(false)
  })

  it('forbids publishing straight from draft', () => {
    expect(isAllowedFrom('publish', 'draft')).toBe(false)
  })

  it('forbids unpublishing anything that is not published', () => {
    const others = ARTICLE_STATUSES.filter((s) => s !== 'published')
    expect(others.every((s) => !isAllowedFrom('unpublish', s))).toBe(true)
  })
})
