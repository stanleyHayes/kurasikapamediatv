import {
  MissingApprovedRevision,
  NotPermitted,
  ScheduleInPast,
  articleId,
} from '@kurasikapa/domain'
import { anApprovedArticle, anArticle } from '@kurasikapa/domain/testing'
import { describe, expect, it } from 'vitest'
import { EARLIER, LATER, NOW, aJournalist, aRevision, anEditor, harness } from '../testing/harness'
import { ArticleNotFound } from './errors'
import { SchedulePublication } from './schedule-publication'

const target = articleId('art_1')

describe('SchedulePublication', () => {
  it('schedules an approved article', async () => {
    const h = harness({ articles: [anApprovedArticle()], revisions: [aRevision()] })
    const result = await new SchedulePublication(h).execute({
      actor: anEditor,
      articleId: target,
      at: LATER,
    })

    expect(result.status).toBe('scheduled')
    expect((await h.articles.findById(target))?.scheduledAt).toEqual(LATER)
  })

  it('announces the scheduled moment', async () => {
    const h = harness({ articles: [anApprovedArticle()], revisions: [aRevision()] })
    await new SchedulePublication(h).execute({ actor: anEditor, articleId: target, at: LATER })

    expect(h.events.last()).toMatchObject({ name: 'article.scheduled', scheduledAt: LATER })
  })

  it('appends a revision recording the scheduling', async () => {
    const h = harness({ articles: [anApprovedArticle()], revisions: [aRevision()] })
    await new SchedulePublication(h).execute({ actor: anEditor, articleId: target, at: LATER })

    const entry = (await h.revisions.listFor(target)).at(-1)!
    expect(entry.seq).toBe(2)
    expect(entry.trigger).toBe('schedule')
  })

  it('judges "past" against the injected clock', async () => {
    const h = harness({ now: NOW, articles: [anApprovedArticle()] })

    await expect(
      new SchedulePublication(h).execute({ actor: anEditor, articleId: target, at: EARLIER }),
    ).rejects.toThrow(ScheduleInPast)
  })

  it('accepts a moment that becomes future after the clock rewinds', async () => {
    const h = harness({ now: EARLIER, articles: [anApprovedArticle()], revisions: [aRevision()] })
    const result = await new SchedulePublication(h).execute({
      actor: anEditor,
      articleId: target,
      at: NOW,
    })

    expect(result.status).toBe('scheduled')
  })

  it('refuses to schedule an article with no approved revision', async () => {
    const h = harness({ articles: [anArticle({ status: 'approved' })] })

    await expect(
      new SchedulePublication(h).execute({ actor: anEditor, articleId: target, at: LATER }),
    ).rejects.toThrow(MissingApprovedRevision)
  })

  it('refuses a journalist', async () => {
    const h = harness({ articles: [anApprovedArticle()] })

    await expect(
      new SchedulePublication(h).execute({ actor: aJournalist, articleId: target, at: LATER }),
    ).rejects.toThrow(NotPermitted)
  })

  it('reports an unknown article', async () => {
    const h = harness()
    await expect(
      new SchedulePublication(h).execute({
        actor: anEditor,
        articleId: articleId('art_missing'),
        at: LATER,
      }),
    ).rejects.toThrow(ArticleNotFound)
  })
})
