import type { Actor, RssSource } from '@kurasikapa/domain'
import type { CreateDraft } from '../editorial/create-draft'
import { SlugTaken } from '../editorial/errors'
import type { ClockPort } from '../ports/ambient'
import type { RssEntry, RssFeedPort } from '../ports/rss-feed'
import type { RssSourceRepository } from '../ports/rss-source-repository'
import type { UseCase } from '../ports/use-case'

export interface IngestRssFeedsDeps {
  readonly sources: RssSourceRepository
  readonly feed: RssFeedPort
  readonly drafts: CreateDraft
  readonly clock: ClockPort
}

export class IngestRssFeeds implements UseCase<{ actor: Actor }, { drafted: number }> {
  constructor(private readonly deps: IngestRssFeedsDeps) {}

  async execute(input: { actor: Actor }): Promise<{ drafted: number }> {
    const sources = await this.deps.sources.list()
    let drafted = 0
    for (const source of sources) {
      drafted += await this.ingestOne(input.actor, source)
    }
    return { drafted }
  }

  private async ingestOne(actor: Actor, source: RssSource): Promise<number> {
    try {
      const pulled = await this.deps.feed.pull(source)
      let current = source
      let drafted = 0
      for (const entry of pulled.entries) {
        const next = await this.importEntry(actor, current, entry)
        current = next.source
        drafted += next.drafted
      }
      await this.deps.sources.save(current.fetched(pulled.etag, this.deps.clock.now()))
      return drafted
    } catch {
      return 0
    }
  }

  private async importEntry(
    actor: Actor,
    source: RssSource,
    entry: RssEntry,
  ): Promise<{ source: RssSource; drafted: number }> {
    if (source.seen(entry.guid) || entry.title.trim() === '') {
      return { source, drafted: 0 }
    }

    try {
      await this.deps.drafts.execute({
        actor,
        locale: source.locale,
        title: entry.title,
        body: entry.body,
        categoryId: source.categoryId,
      })
      return { source: source.remember(entry.guid), drafted: 1 }
    } catch (error) {
      if (error instanceof SlugTaken) return { source: source.remember(entry.guid), drafted: 0 }
      throw error
    }
  }
}
