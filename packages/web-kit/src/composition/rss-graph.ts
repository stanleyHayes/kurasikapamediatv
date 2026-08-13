import {
  IngestRssFeeds,
  RegisterRssSource,
  type CreateDraft,
  type ClockPort,
  type IdPort,
  type RssFeedPort,
  type RssSourceRepository,
} from '@kurasikapa/application'

export function rssCommands(input: {
  readonly sources: RssSourceRepository
  readonly feed: RssFeedPort
  readonly drafts: CreateDraft
  readonly ids: IdPort
  readonly clock: ClockPort
}): {
  readonly registerRssSource: RegisterRssSource
  readonly ingestRssFeeds: IngestRssFeeds
  readonly rssSources: RssSourceRepository
} {
  return {
    registerRssSource: new RegisterRssSource(input.sources, input.ids),
    ingestRssFeeds: new IngestRssFeeds({
      sources: input.sources,
      feed: input.feed,
      drafts: input.drafts,
      clock: input.clock,
    }),
    rssSources: input.sources,
  }
}
