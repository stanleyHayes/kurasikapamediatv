import { type Actor, RssSource, type CategoryId, requirePermission } from '@kurasikapa/domain'
import type { IdPort } from '../ports/ambient'
import type { RssSourceRepository } from '../ports/rss-source-repository'
import type { UseCase } from '../ports/use-case'

export interface RegisterRssSourceInput {
  readonly actor: Actor
  readonly url: string
  readonly locale: string
  readonly categoryId: CategoryId
}

export class RegisterRssSource implements UseCase<RegisterRssSourceInput, { id: string }> {
  constructor(
    private readonly sources: RssSourceRepository,
    private readonly ids: IdPort,
  ) {}

  async execute(input: RegisterRssSourceInput): Promise<{ id: string }> {
    requirePermission(input.actor, 'article:publish')
    const source = RssSource.register({
      id: this.ids.next(),
      url: input.url,
      locale: input.locale,
      categoryId: input.categoryId,
    })
    await this.sources.save(source)
    return { id: source.id }
  }
}
