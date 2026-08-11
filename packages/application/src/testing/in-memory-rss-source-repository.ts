import type { RssSource } from '@kurasikapa/domain'
import type { RssSourceRepository } from '../ports/rss-source-repository'

export class InMemoryRssSourceRepository implements RssSourceRepository {
  private readonly rows = new Map<string, RssSource>()

  save(source: RssSource): Promise<void> {
    this.rows.set(source.id, source)
    return Promise.resolve()
  }

  list(): Promise<readonly RssSource[]> {
    return Promise.resolve([...this.rows.values()])
  }
}
