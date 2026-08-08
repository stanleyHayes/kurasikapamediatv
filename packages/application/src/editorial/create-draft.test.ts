import { NotPermitted, categoryId, familyId, tagId } from '@kurasikapa/domain'
import { describe, expect, it } from 'vitest'
import { NOW, aSubscriber, anAuthor, harness } from '../testing/harness.js'
import { CreateDraft } from './create-draft.js'
import { SlugTaken } from './errors.js'

const input = {
  actor: anAuthor,
  locale: 'en',
  title: 'Budget 2026 Explained',
  body: 'The finance minister presented…',
  categoryId: categoryId('cat_business'),
}

describe('CreateDraft', () => {
  it('stores a draft and its first revision', async () => {
    const h = harness()
    const result = await new CreateDraft(h).execute(input)

    const article = await h.articles.findById(result.articleId)
    const revision = await h.revisions.findById(result.revisionId)

    expect(article?.status).toBe('draft')
    expect(revision?.seq).toBe(1)
    expect(revision?.body).toBe('The finance minister presented…')
  })

  it('derives the slug from the title', async () => {
    const result = await new CreateDraft(harness()).execute(input)
    expect(result.slug).toBe('budget-2026-explained')
  })

  it('stamps the revision with the injected clock, not the wall clock', async () => {
    const h = harness()
    const result = await new CreateDraft(h).execute(input)
    const revision = await h.revisions.findById(result.revisionId)

    expect(revision?.createdAt).toEqual(NOW)
  })

  it('announces the draft', async () => {
    const h = harness()
    await new CreateDraft(h).execute(input)
    expect(h.events.names()).toEqual(['article.draft_created'])
  })

  it('mints a new family for an original article', async () => {
    const h = harness()
    const result = await new CreateDraft(h).execute(input)
    expect(result.familyId).toBeTruthy()
  })

  it('joins an existing family when creating a translation', async () => {
    const h = harness()
    const family = familyId('fam_existing')

    const fr = await new CreateDraft(h).execute({
      ...input,
      locale: 'fr',
      title: 'Le Budget 2026 Expliqué',
      familyId: family,
    })

    expect(fr.familyId).toBe(family)
    expect(fr.slug).toBe('le-budget-2026-expliqué')
  })

  it('allows the same slug in a different locale', async () => {
    const h = harness()
    const create = new CreateDraft(h)

    await create.execute(input)
    const fr = await create.execute({ ...input, locale: 'fr' })

    expect(fr.slug).toBe('budget-2026-explained')
  })

  it('refuses a slug already used in the same locale', async () => {
    const h = harness()
    const create = new CreateDraft(h)

    await create.execute(input)
    await expect(create.execute(input)).rejects.toThrow(SlugTaken)
  })

  it('writes nothing when the slug clashes', async () => {
    const h = harness()
    const create = new CreateDraft(h)
    await create.execute(input)

    await expect(create.execute(input)).rejects.toThrow(SlugTaken)
    expect(h.articles.count()).toBe(1)
    expect(h.events.published).toHaveLength(1)
  })

  it('refuses an actor who may not draft', async () => {
    const h = harness()
    await expect(new CreateDraft(h).execute({ ...input, actor: aSubscriber })).rejects.toThrow(
      NotPermitted,
    )
    expect(h.articles.count()).toBe(0)
  })

  it('keeps supplied tags', async () => {
    const h = harness()
    const result = await new CreateDraft(h).execute({ ...input, tagIds: [tagId('tag_budget')] })
    const article = await h.articles.findById(result.articleId)

    expect(article?.snapshot().tagIds).toEqual(['tag_budget'])
  })
})
