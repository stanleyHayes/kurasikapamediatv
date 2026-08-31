import { describe, expect, it } from 'vitest'
import { Actor, userId } from '@kurasikapa/domain'
import { InMemoryInsightRepository } from '../testing/in-memory-insight-repository'
import { BuildNewsroomReport } from './build-newsroom-report'

describe('BuildNewsroomReport', () => {
  it('builds a bounded report for an authorised editor', async () => {
    const insights = new InMemoryInsightRepository()
    insights.reportValue = { ...insights.reportValue, views: 42 }
    const report = await new BuildNewsroomReport({ insights, clock: { now: () => new Date('2026-08-31T12:00:00Z') } }).execute({ actor: new Actor(userId('editor'), ['editor']), days: 30 })
    expect(report.views).toBe(42)
  })

  it('refuses unauthorised readers and unsupported periods', async () => {
    const useCase = new BuildNewsroomReport({ insights: new InMemoryInsightRepository(), clock: { now: () => new Date() } })
    await expect(useCase.execute({ actor: new Actor(userId('reader'), ['subscriber']), days: 30 })).rejects.toThrow()
    await expect(useCase.execute({ actor: new Actor(userId('admin'), ['administrator']), days: 31 as 30 })).rejects.toThrow('period')
  })
})
