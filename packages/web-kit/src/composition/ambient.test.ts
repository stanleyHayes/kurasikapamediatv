import type { DomainEvent } from '@kurasikapa/application'
import { describe, expect, it } from 'vitest'
import { InProcessEventBus, cryptoIds, systemClock } from './ambient'

const event: DomainEvent = { name: 'article.published', occurredAt: new Date(0) }

describe('systemClock', () => {
  it('reads the wall clock — the one place that is allowed to', () => {
    expect(systemClock.now()).toBeInstanceOf(Date)
  })
})

describe('cryptoIds', () => {
  it('mints distinct ids', () => {
    expect(cryptoIds.next()).not.toBe(cryptoIds.next())
  })
})

describe('InProcessEventBus', () => {
  it('delivers to every subscriber', async () => {
    const bus = new InProcessEventBus()
    const seen: string[] = []
    bus.on((e) => {
      seen.push(`a:${e.name}`)
      return Promise.resolve()
    })
    bus.on((e) => {
      seen.push(`b:${e.name}`)
      return Promise.resolve()
    })

    await bus.publish(event)

    expect(seen).toEqual(['a:article.published', 'b:article.published'])
  })

  it('publishes to nobody without complaint', async () => {
    await expect(new InProcessEventBus().publish(event)).resolves.toBeUndefined()
  })

  it('still reaches later subscribers when an earlier one throws', async () => {
    // A failing cache invalidation must not stop a newsletter subscriber. The
    // publication already happened; it cannot be un-happened by a subscriber.
    const bus = new InProcessEventBus()
    const reached: string[] = []
    bus.on(() => Promise.reject(new Error('cache invalidation failed')))
    bus.on(() => {
      reached.push('second')
      return Promise.resolve()
    })

    await expect(bus.publish(event)).rejects.toThrow(AggregateError)
    expect(reached).toEqual(['second'])
  })

  it('reports every failure, not just the first', async () => {
    const bus = new InProcessEventBus()
    bus.on(() => Promise.reject(new Error('one')))
    bus.on(() => Promise.reject(new Error('two')))

    await expect(bus.publish(event)).rejects.toThrow(/2 subscriber\(s\) failed/u)
  })
})
