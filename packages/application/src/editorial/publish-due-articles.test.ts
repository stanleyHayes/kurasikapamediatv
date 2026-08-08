import { articleId, familyId } from '@kurasikapa/domain'
import { anApprovedArticle, anArticle } from '@kurasikapa/domain/testing'
import { Slug } from '@kurasikapa/domain'
import { describe, expect, it } from 'vitest'
import { EARLIER, LATER, NOW, harness, theSystem } from '../testing/harness.js'
import { PublishDueArticles } from './publish-due-articles.js'

const due = (id: string, at = EARLIER): ReturnType<typeof anApprovedArticle> =>
  anApprovedArticle({
    id: articleId(id),
    familyId: familyId(`fam_${id}`),
    slug: Slug.of(id.replace('_', '-')),
    status: 'scheduled',
    scheduledAt: at,
  })

describe('PublishDueArticles', () => {
  it('publishes everything whose moment has arrived', async () => {
    const h = harness({ now: NOW, articles: [due('art_1'), due('art_2')] })
    const result = await new PublishDueArticles(h).execute({ actor: theSystem })

    expect(result.published).toHaveLength(2)
    expect(result.failed).toHaveLength(0)
    expect((await h.articles.findById(articleId('art_1')))?.status).toBe('published')
  })

  it('leaves articles scheduled for later alone', async () => {
    const h = harness({ now: NOW, articles: [due('art_1', LATER)] })
    const result = await new PublishDueArticles(h).execute({ actor: theSystem })

    expect(result.published).toHaveLength(0)
    expect((await h.articles.findById(articleId('art_1')))?.status).toBe('scheduled')
  })

  it('ignores drafts and approved-but-unscheduled articles', async () => {
    const h = harness({ now: NOW, articles: [anArticle(), anApprovedArticle()] })
    const result = await new PublishDueArticles(h).execute({ actor: theSystem })

    expect(result.published).toHaveLength(0)
  })

  it('publishes an empty batch without complaint', async () => {
    const h = harness({ now: NOW })
    const result = await new PublishDueArticles(h).execute({ actor: theSystem })

    expect(result).toEqual({ published: [], failed: [] })
  })

  it('emits one event per published article', async () => {
    const h = harness({ now: NOW, articles: [due('art_1'), due('art_2')] })
    await new PublishDueArticles(h).execute({ actor: theSystem })

    expect(h.events.names()).toEqual(['article.published', 'article.published'])
  })
})

describe('PublishDueArticles — one bad article must not strand the batch', () => {
  /**
   * A scheduled article that lost its approval is the realistic failure: an
   * editor rejected it after scheduling. It must not stop the rest of the
   * newsroom's queue from going out.
   */
  const brokenlyScheduled = anArticle({
    id: articleId('art_broken'),
    familyId: familyId('fam_broken'),
    slug: Slug.of('broken'),
    status: 'scheduled',
    scheduledAt: EARLIER,
    approvedRevisionId: null,
  })

  it('publishes the healthy ones and reports the failure', async () => {
    const h = harness({ now: NOW, articles: [brokenlyScheduled, due('art_ok')] })
    const result = await new PublishDueArticles(h).execute({ actor: theSystem })

    expect(result.published).toEqual([articleId('art_ok')])
    expect(result.failed).toEqual([
      { articleId: articleId('art_broken'), reason: expect.stringContaining('MissingApprovedRevision') as string },
    ])
  })

  it('survives a failure that is not an Error', async () => {
    // Drivers and SDKs do reject with plain values. If the batch reporter
    // assumed `error.message`, the whole cron run would die on one bad write.
    const h = harness({ now: NOW, articles: [due('art_1')] })
    // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- deliberately non-Error
    h.articles.save = (): Promise<void> => Promise.reject('driver returned a string')

    const result = await new PublishDueArticles(h).execute({ actor: theSystem })

    expect(result.published).toHaveLength(0)
    expect(result.failed).toEqual([
      { articleId: articleId('art_1'), reason: 'driver returned a string' },
    ])
  })

  it('does not swallow the failure silently', async () => {
    // A scheduled article that quietly never publishes is the worst outcome
    // for a newsroom, so the caller must be able to alert on this.
    const h = harness({ now: NOW, articles: [brokenlyScheduled] })
    const result = await new PublishDueArticles(h).execute({ actor: theSystem })

    expect(result.failed).toHaveLength(1)
    expect((await h.articles.findById(articleId('art_broken')))?.status).toBe('scheduled')
  })
})
