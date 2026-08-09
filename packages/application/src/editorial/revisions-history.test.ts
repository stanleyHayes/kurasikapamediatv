import { type ArticleId, NotOwnArticle, NotPermitted, articleId, revisionId } from '@kurasikapa/domain'
import { anApprovedArticle, anArticle } from '@kurasikapa/domain/testing'
import { describe, expect, it } from 'vitest'
import { NOW, aStranger, aSubscriber, anAuthor, anEditor, harness } from '../testing/harness'
import { ArticleNotFound, RevisionNotFound } from './errors'
import { CreateDraft } from './create-draft'
import { ListRevisions, RestoreRevision } from './revisions-history'
import { UpdateDraft } from './update-draft'

const target = articleId('art_1')

/** Builds a real three-revision history through the use cases, not by hand. */
async function withHistory(): Promise<{ h: ReturnType<typeof harness>; id: ArticleId }> {
  const h = harness({ articles: [] })

  const created = await new CreateDraft(h).execute({
    actor: anAuthor,
    locale: 'en',
    title: 'Budget 2026',
    body: 'first',
    categoryId: 'cat_business' as never,
  })

  const update = new UpdateDraft(h)
  const edit = { actor: anAuthor, articleId: created.articleId, title: 'Budget 2026' }
  await update.execute({ ...edit, body: 'second' })
  await update.execute({ ...edit, body: 'third' })

  return { h, id: created.articleId }
}

describe('ListRevisions', () => {
  it('returns the whole history, newest first', async () => {
    // An editor opening history is looking for what changed recently, not for
    // the article's first draft.
    const { h, id } = await withHistory()

    const history = await new ListRevisions(h).execute({
      actor: anAuthor,
      articleId: id,
    })

    expect(history).toHaveLength(3)
    expect(history.map((r) => r.body)).toEqual(['third', 'second', 'first'])
  })

  it('refuses a reader with no editorial permission', async () => {
    // The history of an unpublished article says what the newsroom considered
    // and discarded. That is more sensitive than the current text, not less.
    const h = harness({ articles: [anArticle()] })

    await expect(
      new ListRevisions(h).execute({ actor: aSubscriber, articleId: target }),
    ).rejects.toBeInstanceOf(NotPermitted)
  })

  it("refuses another author's draft", async () => {
    const h = harness({ articles: [anArticle()] })

    await expect(
      new ListRevisions(h).execute({ actor: aStranger, articleId: target }),
    ).rejects.toBeInstanceOf(NotOwnArticle)
  })

  it('reports a missing article rather than an empty history', async () => {
    const h = harness({ articles: [] })

    await expect(
      new ListRevisions(h).execute({ actor: anEditor, articleId: target }),
    ).rejects.toBeInstanceOf(ArticleNotFound)
  })
})

describe('RestoreRevision', () => {
  it('writes the old text forward as a NEW revision', async () => {
    // Not a rewind. The history keeps every step, including the mistake and
    // the restoration — a newsroom must be able to answer "what did we
    // publish, and when", and deleting the intervening versions destroys the
    // evidence that a correction ever happened.
    const { h, id } = await withHistory()
    const history = await new ListRevisions(h).execute({ actor: anAuthor, articleId: id })
    const first = history.at(-1)!

    const restored = await new RestoreRevision(h).execute({
      actor: anAuthor,
      articleId: id,
      revisionId: first.id,
    })

    expect(restored.body).toBe('first')
    expect(restored.seq).toBe(4)

    const after = await new ListRevisions(h).execute({ actor: anAuthor, articleId: id })
    expect(after).toHaveLength(4)
    // Every earlier version survives.
    expect(after.map((r) => r.body)).toEqual(['first', 'third', 'second', 'first'])
  })

  it('attributes the restoration to whoever restored it', async () => {
    // They made the call. Attributing it to the original author would misstate
    // who decided to bring the text back.
    const { h, id } = await withHistory()
    const history = await new ListRevisions(h).execute({ actor: anAuthor, articleId: id })

    const restored = await new RestoreRevision(h).execute({
      actor: anEditor,
      articleId: id,
      revisionId: history.at(-1)!.id,
    })

    expect(restored.authorId).toBe(anEditor.id)
    expect(restored.createdAt).toEqual(NOW)
  })

  it('refuses to restore into an article that is in review', async () => {
    // It must not move under the reviewer reading it.
    const h = harness({ articles: [anApprovedArticle({ status: 'in_review' })] })

    await expect(
      new RestoreRevision(h).execute({
        actor: anEditor,
        articleId: target,
        revisionId: revisionId('rev_1'),
      }),
    ).rejects.toThrow()
  })

  it('refuses a reader outright', async () => {
    const h = harness({ articles: [anArticle()] })

    await expect(
      new RestoreRevision(h).execute({
        actor: aSubscriber,
        articleId: target,
        revisionId: revisionId('rev_1'),
      }),
    ).rejects.toBeInstanceOf(NotPermitted)
  })

  it('reports a revision belonging to another article as missing', async () => {
    // "Belongs to another article" would confirm it exists. Missing does not.
    const { h, id } = await withHistory()

    await expect(
      new RestoreRevision(h).execute({
        actor: anAuthor,
        articleId: id,
        revisionId: revisionId('rev_from_elsewhere'),
      }),
    ).rejects.toBeInstanceOf(RevisionNotFound)
  })
})

describe('RestoreRevision — the paths that should be unreachable', () => {
  it('reports a missing article rather than restoring into nothing', async () => {
    const h = harness({ articles: [] })

    await expect(
      new RestoreRevision(h).execute({
        actor: anEditor,
        articleId: target,
        revisionId: revisionId('rev_1'),
      }),
    ).rejects.toBeInstanceOf(ArticleNotFound)
  })

  it('refuses an article that somehow has no history at all', async () => {
    // Should not happen — CreateDraft writes the first revision before the
    // article, precisely so this cannot arise. If it ever does, the right
    // answer is to refuse rather than to invent a seq and corrupt the order.
    const h = harness({ articles: [anArticle()] })

    await expect(
      new RestoreRevision(h).execute({
        actor: anEditor,
        articleId: target,
        revisionId: revisionId('rev_1'),
      }),
    ).rejects.toBeInstanceOf(RevisionNotFound)
  })
})
