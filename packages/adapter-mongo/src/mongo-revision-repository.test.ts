import { articleId, revisionId } from '@kurasikapa/domain'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { MongoRevisionRepository } from './mongo-revision-repository'
import { revision } from './testing/fixtures'
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
