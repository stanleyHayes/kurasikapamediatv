import { Revision, articleId, revisionId, userId } from '@kurasikapa/domain'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { REVISIONS, type RevisionDocument } from './documents'
import { MongoRevisionRepository } from './mongo-revision-repository'
import { NOW, revision } from './testing/fixtures'
import { type MongoHarness, startMongo } from './testing/mongo-harness'

let mongo: MongoHarness
let repo: MongoRevisionRepository

beforeAll(async () => {
  mongo = await startMongo()
  repo = new MongoRevisionRepository(mongo.db)
})

afterEach(async () => {
  await mongo.reset()
})

afterAll(async () => {
  await mongo.stop()
})

const ARTICLE = articleId('art_1')

describe('append and read back', () => {
  it('round trips a revision', async () => {
    const original = revision('rev_1', 'art_1', 1, 'the first draft')
    await repo.append(original)

    expect((await repo.findById(revisionId('rev_1')))?.snapshot()).toEqual(original.snapshot())
  })

  it('returns null for an unknown id', async () => {
    expect(await repo.findById(revisionId('rev_missing'))).toBeNull()
  })
})

describe('trigger', () => {
  it('round trips the transition that caused the revision', async () => {
    const original = Revision.append(
      {
        id: revisionId('rev_1'),
        articleId: ARTICLE,
        title: 'Budget 2026',
        body: 'body',
        authorId: userId('usr_author'),
        createdAt: NOW,
        trigger: 'publish',
      },
      null,
    )
    await repo.append(original)

    expect((await repo.findById(revisionId('rev_1')))?.trigger).toBe('publish')
  })

  it('reads a pre-trigger document as having no trigger rather than inventing one', async () => {
    await mongo.db.collection<RevisionDocument>(REVISIONS).insertOne({
      _id: 'rev_legacy',
      articleId: 'art_1',
      seq: 1,
      title: 'Budget 2026',
      body: 'body',
      authorId: 'usr_author',
      createdAt: NOW,
    })

    expect((await repo.findById(revisionId('rev_legacy')))?.trigger).toBeUndefined()
  })
})

describe('findLatest', () => {
  it('returns the highest sequence', async () => {
    await repo.append(revision('rev_1', 'art_1', 1))
    await repo.append(revision('rev_3', 'art_1', 3))
    await repo.append(revision('rev_2', 'art_1', 2))

    expect((await repo.findLatest(ARTICLE))?.seq).toBe(3)
  })

  it('does not look at another article', async () => {
    await repo.append(revision('rev_other', 'art_other', 9))
    expect(await repo.findLatest(ARTICLE)).toBeNull()
  })

  it('returns null when the article has no history', async () => {
    expect(await repo.findLatest(ARTICLE)).toBeNull()
  })
})

describe('listFor', () => {
  it('returns the article history oldest first', async () => {
    await repo.append(revision('rev_2', 'art_1', 2))
    await repo.append(revision('rev_1', 'art_1', 1))
    await repo.append(revision('rev_3', 'art_1', 3))
    await repo.append(revision('rev_x', 'art_other', 1))

    expect((await repo.listFor(ARTICLE)).map((r) => r.seq)).toEqual([1, 2, 3])
  })
})

describe('findManyByIds', () => {
  it('skips the round trip when asked for nothing', async () => {
    await expect(repo.findManyByIds([])).resolves.toEqual([])
  })

  it('returns the requested revisions and no others', async () => {
    await repo.append(revision('rev_1', 'art_1', 1))
    await repo.append(revision('rev_2', 'art_1', 2))
    await repo.append(revision('rev_x', 'art_other', 1))

    const found = await repo.findManyByIds([revisionId('rev_1'), revisionId('rev_x')])

    expect(found.map((r) => r.snapshot().id)).toEqual(
      expect.arrayContaining(['rev_1', 'rev_x']),
    )
    expect(found).toHaveLength(2)
  })
})

describe('findLatestForArticles', () => {
  it('skips the round trip when asked for nothing', async () => {
    await expect(repo.findLatestForArticles([])).resolves.toEqual([])
  })

  it('returns only the latest revision of each article', async () => {
    await repo.append(revision('rev_1', 'art_1', 1))
    await repo.append(revision('rev_2', 'art_1', 2))
    await repo.append(revision('rev_a', 'art_2', 1))
    await repo.append(revision('rev_b', 'art_2', 3))
    await repo.append(revision('rev_c', 'art_2', 2))

    const latest = await repo.findLatestForArticles([ARTICLE, articleId('art_2')])

    const seqByArticle = new Map(latest.map((r) => [r.snapshot().articleId, r.seq]))
    expect(seqByArticle).toEqual(new Map([['art_1', 2], ['art_2', 3]]))
  })
})

describe('append-only guarantees', () => {
  it('refuses two revisions with the same sequence for one article', async () => {
    // A concurrent double-append must fail loudly, not silently lose a draft.
    await repo.append(revision('rev_1', 'art_1', 1))

    await expect(repo.append(revision('rev_2', 'art_1', 1))).rejects.toThrow(/duplicate key/iu)
  })

  it('allows the same sequence on different articles', async () => {
    await repo.append(revision('rev_1', 'art_1', 1))
    await repo.append(revision('rev_2', 'art_2', 1))

    expect(await mongo.db.collection('article_revisions').countDocuments()).toBe(2)
  })

  it('refuses to overwrite an existing revision id', async () => {
    await repo.append(revision('rev_1', 'art_1', 1, 'original'))

    await expect(repo.append(revision('rev_1', 'art_1', 2, 'tampered'))).rejects.toThrow(
      /duplicate key/iu,
    )
    expect((await repo.findById(revisionId('rev_1')))?.body).toBe('original')
  })
})
