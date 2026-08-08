import type { DomainEvent } from '@kurasikapa/application'
import { describe, expect, it } from 'vitest'
import { type CacheTags, invalidateFor } from './cache-invalidation'

const recorder = (): CacheTags & { updated: string[]; revalidated: string[] } => {
  const updated: string[] = []
  const revalidated: string[] = []

  return {
    updated,
    revalidated,
    update: (tag) => updated.push(tag),
    revalidate: (tag) => revalidated.push(tag),
  }
}

const event = (name: string, extra: Record<string, unknown> = {}): DomainEvent =>
  ({
    name,
    occurredAt: new Date('2026-08-08T10:00:00Z'),
    articleId: 'art_1',
    actorId: 'usr_editor',
    ...extra,
  }) as DomainEvent

describe('publishing', () => {
  it('updates the article tag inside the request, not in the background', () => {
    // The questionnaire asks for breaking news. "Live within a minute" is a
    // different promise from "live when the editor hits publish".
    const tags = recorder()

    invalidateFor(tags, event('article.published', { slug: 'budget-2026', locale: 'en' }))

    expect(tags.updated).toEqual(['article-art_1'])
  })

  it('revalidates the locale listing in the background', () => {
    // A homepage 30 seconds stale is fine; blocking the publish on rebuilding
    // every rail is not.
    const tags = recorder()

    invalidateFor(tags, event('article.published', { slug: 'budget-2026', locale: 'en' }))

    expect(tags.revalidated).toEqual(['articles-en'])
  })

  it('scopes the listing refresh to the published locale', () => {
    const tags = recorder()

    invalidateFor(tags, event('article.published', { slug: 'le-budget', locale: 'fr' }))

    expect(tags.revalidated).toEqual(['articles-fr'])
  })
})

describe('unpublishing', () => {
  it('drops the article from its locale listing', () => {
    // A pulled article lingering on the homepage is the visible half of the
    // mistake that caused it to be pulled.
    const tags = recorder()

    invalidateFor(tags, event('article.unpublished', { reason: 'disputed', locale: 'en' }))

    expect(tags.updated).toEqual(['article-art_1'])
    expect(tags.revalidated).toEqual(['articles-en'])
  })
})

describe('events a reader cannot see', () => {
  it.each([
    'article.draft_created',
    'article.submitted',
    'article.approved',
    'article.rejected',
    'article.scheduled',
  ])('invalidates nothing for %s', (name) => {
    // Approving something changes nothing on the public site. Invalidating
    // here would throw away a warm cache for every editorial keystroke.
    const tags = recorder()

    invalidateFor(tags, event(name))

    expect(tags.updated).toEqual([])
    expect(tags.revalidated).toEqual([])
  })

  it('ignores an event that carries no article at all', () => {
    const tags = recorder()

    invalidateFor(tags, { name: 'identity.roles_assigned', occurredAt: new Date(0) })

    expect(tags.updated).toEqual([])
  })
})
