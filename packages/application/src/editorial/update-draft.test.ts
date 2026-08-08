import { NotEditable, NotOwnArticle, Slug, articleId, familyId } from '@kurasikapa/domain'
import { anApprovedArticle, anArticle } from '@kurasikapa/domain/testing'
import { describe, expect, it } from 'vitest'
import { NOW, aStranger, anAuthor, anEditor, harness } from '../testing/harness'
import { ArticleNotFound, SlugTaken } from './errors'
import { UpdateDraft } from './update-draft'

const target = articleId('art_1')

const save = (h: ReturnType<typeof harness>): UpdateDraft => new UpdateDraft(h)

describe('UpdateDraft', () => {
  it('appends a revision rather than overwriting one', async () => {
    // History is a product feature, and a row per save costs nothing next to
    // an editor losing an afternoon's work.
    const h = harness({ articles: [anArticle()] })

    const first = await save(h).execute({
      actor: anAuthor,
      articleId: target,
      title: 'Budget 2026',
      body: 'first pass',
    })
    const second = await save(h).execute({
      actor: anAuthor,
      articleId: target,
      title: 'Budget 2026',
      body: 'second pass',
    })

    expect(first.seq).toBe(1)
    expect(second.seq).toBe(2)
    expect(await h.revisions.listFor(target)).toHaveLength(2)
  })

  it('stamps the revision with the injected clock', async () => {
    const h = harness({ articles: [anArticle()] })

    const { revisionId } = await save(h).execute({
      actor: anAuthor,
      articleId: target,
      title: 'T',
      body: 'B',
    })

    expect((await h.revisions.findById(revisionId))?.createdAt).toEqual(NOW)
  })

  it('re-derives the slug from a new title while the article is unpublished', async () => {
    const h = harness({ articles: [anArticle()] })

    const result = await save(h).execute({
      actor: anAuthor,
      articleId: target,
      title: 'Budget 2026 Revised',
      body: 'body',
    })

    expect(result.slug).toBe('budget-2026-revised')
    expect((await h.articles.findById(target))?.slug.value).toBe('budget-2026-revised')
  })

  it('publishes no event — a draft save changes nothing a reader can see', async () => {
    const h = harness({ articles: [anArticle()] })

    await save(h).execute({ actor: anAuthor, articleId: target, title: 'T', body: 'B' })

    expect(h.events.published).toHaveLength(0)
  })

  it('reports an unknown article', async () => {
    const h = harness()

    await expect(
      save(h).execute({ actor: anAuthor, articleId: target, title: 'T', body: 'B' }),
    ).rejects.toThrow(ArticleNotFound)
  })
})

describe('UpdateDraft — the slug after publication', () => {
  const pulled = (): ReturnType<typeof anApprovedArticle> =>
    anApprovedArticle({ status: 'unpublished', publishedAt: NOW })

  it('keeps the published slug even when the title changes', async () => {
    // A correction must be able to fix the headline without breaking every
    // link, share and index entry pointing at the old URL.
    const h = harness({ articles: [pulled()] })

    const result = await save(h).execute({
      actor: anEditor,
      articleId: target,
      title: 'Budget 2026 — Corrected',
      body: 'corrected body',
    })

    expect(result.slug).toBe('budget-2026')
    expect((await h.articles.findById(target))?.snapshot().title).toBe('Budget 2026 — Corrected')
  })

  it('does not attempt the slug change, so SlugIsFrozen never fires here', async () => {
    // The rule lives in the entity; this use case simply does not ask.
    const h = harness({ articles: [pulled()] })

    await expect(
      save(h).execute({ actor: anEditor, articleId: target, title: 'Anything', body: 'b' }),
    ).resolves.toBeDefined()
  })
})

describe('UpdateDraft — refusals', () => {
  it("refuses another author's draft and writes nothing", async () => {
    const h = harness({ articles: [anArticle()] })

    await expect(
      save(h).execute({ actor: aStranger, articleId: target, title: 'Hijack', body: 'b' }),
    ).rejects.toThrow(NotOwnArticle)

    expect(await h.revisions.listFor(target)).toHaveLength(0)
    expect((await h.articles.findById(target))?.snapshot().title).toBe('Budget 2026')
  })

  it('refuses to edit an article that is under review', async () => {
    const h = harness({ articles: [anArticle({ status: 'in_review' })] })

    await expect(
      save(h).execute({ actor: anEditor, articleId: target, title: 'Sneaky', body: 'b' }),
    ).rejects.toThrow(NotEditable)
  })

  it('refuses a slug already taken in the same locale', async () => {
    const other = anArticle({
      id: articleId('art_2'),
      familyId: familyId('fam_2'),
      slug: Slug.of('art-2'),
    })
    const h = harness({ articles: [anArticle(), other] })

    await expect(
      save(h).execute({ actor: anEditor, articleId: target, title: 'art 2', body: 'b' }),
    ).rejects.toThrow(SlugTaken)
  })

  it('does not treat the article keeping its own slug as a clash', async () => {
    const h = harness({ articles: [anArticle()] })

    await expect(
      save(h).execute({ actor: anAuthor, articleId: target, title: 'Budget 2026', body: 'b' }),
    ).resolves.toBeDefined()
  })
})
