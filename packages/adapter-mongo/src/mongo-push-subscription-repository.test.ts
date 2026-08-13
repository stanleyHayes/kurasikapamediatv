import { DeviceSubscription } from '@kurasikapa/domain'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { MongoPushSubscriptionRepository } from './mongo-push-subscription-repository'
import { type MongoHarness, startMongo } from './testing/mongo-harness'

let mongo: MongoHarness
let repo: MongoPushSubscriptionRepository

beforeAll(async () => {
  mongo = await startMongo()
  repo = new MongoPushSubscriptionRepository(mongo.db)
})

afterEach(async () => {
  await mongo.reset()
})

afterAll(async () => {
  await mongo.stop()
})

const subscription = (
  endpoint = 'https://push.example.com/abc',
): DeviceSubscription =>
  DeviceSubscription.subscribe({
    endpoint,
    p256dh: 'p256dh_key',
    auth: 'auth_secret',
    locale: 'en',
    now: new Date('2026-08-12T10:00:00Z'),
  })

describe('MongoPushSubscriptionRepository', () => {
  it('round trips by locale', async () => {
    await repo.save(subscription())

    const rows = await repo.listByLocale('en')
    expect(rows).toHaveLength(1)
    expect(rows[0]?.endpoint).toBe('https://push.example.com/abc')
    expect(await repo.listByLocale('fr')).toHaveLength(0)
  })

  it('removes by endpoint', async () => {
    await repo.save(subscription())
    await repo.remove('https://push.example.com/abc')

    expect(await repo.listByLocale('en')).toHaveLength(0)
  })

  it('upserts on the same endpoint', async () => {
    await repo.save(subscription())
    await repo.save(subscription())

    expect(await repo.listByLocale('en')).toHaveLength(1)
  })
})
