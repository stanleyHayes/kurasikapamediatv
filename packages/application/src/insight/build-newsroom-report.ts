import { type Actor, requirePermission } from '@kurasikapa/domain'
import type { ClockPort } from '../ports/ambient'
import type { InsightRepository, NewsroomReport } from '../ports/insight-repository'
import type { UseCase } from '../ports/use-case'

export interface BuildNewsroomReportInput { readonly actor: Actor; readonly days: 7 | 30 | 90 }

export class BuildNewsroomReport implements UseCase<BuildNewsroomReportInput, NewsroomReport> {
  constructor(private readonly deps: { insights: InsightRepository; clock: ClockPort }) {}

  async execute(input: BuildNewsroomReportInput): Promise<NewsroomReport> {
    requirePermission(input.actor, 'analytics:read')
    if (![7, 30, 90].includes(input.days)) throw new Error('Unsupported analytics period')
    return this.deps.insights.report(input.days, this.deps.clock.now())
  }
}
