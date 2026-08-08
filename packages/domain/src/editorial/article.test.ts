import { describe, expect, it } from 'vitest'
import { NotPermitted } from '../identity/actor.js'
import { articleId, categoryId, familyId, tagId } from '../shared/ids.js'
import { Slug } from '../shared/slug.js'
import { Article } from './article.js'
import { AUTHOR, OTHER, REVISION, actorWith, anApprovedArticle, anArticle } from '../testing/builders.js'
import { IllegalTransition, MissingApprovedRevision, NotOwnArticle, ScheduleInPast } from './errors.js'

const NOW = new Date('2026-08-08T10:00:00Z')
const LATER = new Date('2026-08-08T18:00:00Z')
const EARLIER = new Date('2026-08-08T09:00:00Z')

const author = actorWith(['author'])
const journalist = actorWith(['journalist'])
const editor = actorWith(['editor'], OTHER)
const subscriber = actorWith(['subscriber'], OTHER)

describe('create', () => {
  const input = {
    id: articleId('art_new'),
    familyId: familyId('fam_new'),
    locale: 'en',
    slug: Slug.of('new-piece'),
    title: 'New Piece',
    categoryId: categoryId('cat_news'),
  }

  it('starts life as a draft', () => {
    expect(Article.create(author, input).status).toBe('draft')
  })

  it('attributes authorship to whoever created it, not to a passed-in id', () => {
    expect(Article.create(author, input).authorId).toBe(AUTHOR)
  })

  it('starts with no approval, no schedule and no publication', () => {
    const created = Article.create(author, input).snapshot()
    expect(created.approvedRevisionId).toBeNull()
    expect(created.scheduledAt).toBeNull()
    expect(created.publishedAt).toBeNull()
  })

  it('defaults to no tags', () => {
    expect(Article.create(author, input).snapshot().tagIds).toEqual([])
  })

  it('keeps tags when supplied', () => {
    const tagged = Article.create(author, { ...input, tagIds: [tagId('tag_budget')] })
    expect(tagged.snapshot().tagIds).toEqual(['tag_budget'])
  })

  it('refuses an actor who may not draft', () => {
    expect(() => Article.create(subscriber, input)).toThrow(NotPermitted)
  })
})

describe('submitForReview', () => {
  it('moves a draft into review', () => {
    expect(anArticle().submitForReview(author).status).toBe('in_review')
  })

  it('refuses an actor without the submit permission', () => {
    expect(() => anArticle().submitForReview(subscriber)).toThrow(NotPermitted)
  })

  it("refuses another author's draft", () => {
    const foreign = actorWith(['author'], OTHER)
    expect(() => anArticle().submitForReview(foreign)).toThrow(NotOwnArticle)
  })

  it('reports missing permission before ownership, so it leaks no authorship', () => {
    // A subscriber is both unpermitted and not the author. They must be told
    // the former — "belongs to another author" would reveal who wrote an
    // unpublished draft to someone with no editorial access at all.
    expect(() => anArticle().submitForReview(subscriber)).toThrow(NotPermitted)
  })

  it('allows an editor to submit any draft, because they may edit any', () => {
    expect(anArticle({ authorId: AUTHOR }).submitForReview(editor).status).toBe('in_review')
  })

  it('refuses to submit an article that is already published', () => {
    const published = anArticle({ status: 'published' })
    expect(() => published.submitForReview(author)).toThrow(IllegalTransition)
  })
})

describe('approve and reject', () => {
  it('approve records the revision that was approved', () => {
    const approved = anArticle({ status: 'in_review' }).approve(editor, REVISION)
    expect(approved.status).toBe('approved')
    expect(approved.snapshot().approvedRevisionId).toBe(REVISION)
  })

  it('reject returns the article to draft and clears the approval', () => {
    const rejected = anArticle({ status: 'in_review', approvedRevisionId: REVISION }).reject(editor)
    expect(rejected.status).toBe('draft')
    expect(rejected.snapshot().approvedRevisionId).toBeNull()
  })

  it('a journalist may not approve their own work', () => {
    expect(() => anArticle({ status: 'in_review' }).approve(journalist, REVISION)).toThrow(NotPermitted)
  })
})

describe('publish', () => {
  it('publishes an approved article and stamps the time', () => {
    const published = anApprovedArticle().publish(editor, NOW)
    expect(published.status).toBe('published')
    expect(published.publishedAt).toEqual(NOW)
  })

  it('refuses to publish without an approved revision', () => {
    const noRevision = anArticle({ status: 'approved' })
    expect(() => noRevision.publish(editor, NOW)).toThrow(MissingApprovedRevision)
  })

  it('refuses to publish straight from draft', () => {
    expect(() => anArticle({ approvedRevisionId: REVISION }).publish(editor, NOW)).toThrow(IllegalTransition)
  })

  it('refuses an author, whatever the state', () => {
    expect(() => anApprovedArticle().publish(author, NOW)).toThrow(NotPermitted)
  })

  it('clears the schedule once published', () => {
    const scheduled = anApprovedArticle({ status: 'scheduled', scheduledAt: LATER })
    expect(scheduled.publish(editor, NOW).scheduledAt).toBeNull()
  })

  it('can republish something previously unpublished', () => {
    const pulled = anApprovedArticle({ status: 'unpublished' })
    expect(pulled.publish(editor, NOW).status).toBe('published')
  })
})

describe('schedule', () => {
  it('schedules an approved article for a future moment', () => {
    const scheduled = anApprovedArticle().schedule(editor, LATER, NOW)
    expect(scheduled.status).toBe('scheduled')
    expect(scheduled.scheduledAt).toEqual(LATER)
  })

  it('refuses a moment in the past', () => {
    expect(() => anApprovedArticle().schedule(editor, EARLIER, NOW)).toThrow(ScheduleInPast)
  })

  it('refuses the present moment, which would race the cron', () => {
    expect(() => anApprovedArticle().schedule(editor, NOW, NOW)).toThrow(ScheduleInPast)
  })

  it('refuses to schedule without an approved revision', () => {
    expect(() => anArticle({ status: 'approved' }).schedule(editor, LATER, NOW)).toThrow(MissingApprovedRevision)
  })
})

describe('unpublish', () => {
  it('pulls a published article', () => {
    const published = anApprovedArticle({ status: 'published', publishedAt: NOW })
    expect(published.unpublish(editor).status).toBe('unpublished')
  })

  it('refuses to unpublish a draft', () => {
    expect(() => anArticle().unpublish(editor)).toThrow(IllegalTransition)
  })
})

describe('isDueForPublication', () => {
  it('is due once the scheduled moment has passed', () => {
    const scheduled = anApprovedArticle({ status: 'scheduled', scheduledAt: EARLIER })
    expect(scheduled.isDueForPublication(NOW)).toBe(true)
  })

  it('is due exactly at the scheduled moment', () => {
    const scheduled = anApprovedArticle({ status: 'scheduled', scheduledAt: NOW })
    expect(scheduled.isDueForPublication(NOW)).toBe(true)
  })

  it('is not due before its moment', () => {
    const scheduled = anApprovedArticle({ status: 'scheduled', scheduledAt: LATER })
    expect(scheduled.isDueForPublication(NOW)).toBe(false)
  })

  it('is never due if it is not scheduled', () => {
    expect(anApprovedArticle().isDueForPublication(LATER)).toBe(false)
  })
})

describe('identity', () => {
  it('exposes the locale-scoped identity a reader URL is built from', () => {
    const article = anArticle()
    expect(article.id).toBe('art_1')
    expect(article.familyId).toBe('fam_1')
    expect(article.locale).toBe('en')
    expect(article.slug.value).toBe('budget-2026')
    expect(article.authorId).toBe(AUTHOR)
  })

  it('keeps the family shared across locales while slug and state diverge', () => {
    const en = anArticle()
    const fr = anArticle({ locale: 'fr', slug: Slug.of('budget-2026-fr'), status: 'in_review' })
    expect(fr.familyId).toBe(en.familyId)
    expect(fr.slug.equals(en.slug)).toBe(false)
    expect(fr.status).not.toBe(en.status)
  })
})

describe('immutability', () => {
  it('leaves the original article untouched', () => {
    const draft = anArticle()
    draft.submitForReview(author)
    expect(draft.status).toBe('draft')
  })
})
