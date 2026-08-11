import { BreakingAlert, articleId, userId } from '@kurasikapa/domain'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { MongoBreakingAlertRepository } from './mongo-breaking-alert-repository'
import { type MongoHarness, startMongo } from './testing/mongo-harness'

let mongo: MongoHarness
let repo: MongoBreakingAlertRepository

beforeAll(async () => {
  mongo = await startMongo()
  repo = new MongoBreakingAlertRepository(mongo.db)
})

afterEach(async () => {
  await mongo.reset()
})

afterAll(async () => {
  await mongo.stop()
})

const alert = (): BreakingAlert =>
  BreakingAlert.reconstitute({
    articleId: articleId('art_1'),
    locale: 'en',
    actorId: userId('usr_editor'),
    sentAt: new Date('2026-08-11T12:00:00Z'),
  })

describe('MongoBreakingAlertRepository', () => {
  it('round trips one blast per article', async () => {
    await repo.save(alert())

    expect((await repo.findByArticleId(articleId('art_1')))?.articleId).toBe('art_1')
    expect(await repo.findByArticleId(articleId('art_missing'))).toBeNull()
  })
})
