# 05 — Port Contracts

Ports live in `packages/application/src/ports/`. They are **interfaces only** — no imports beyond `packages/domain`.

Two kinds:

- **Driving (inbound)** — use cases. Called by route handlers, server actions, cron, webhooks.
- **Driven (outbound)** — everything the application needs from the outside world. Implemented by `adapter-*`.

---

## 1. Driven ports

### Persistence

One repository per aggregate root. Repositories speak domain types, never documents.

```ts
export interface ArticleRepository {
  findById(id: ArticleId): Promise<Article | null>
  findBySlug(slug: Slug, locale: Locale): Promise<Article | null>
  listPublished(q: PublishedQuery): Promise<Page<ArticleSummary>>
  save(article: Article): Promise<void>
  delete(id: ArticleId): Promise<void>
}
```

Same shape for `RevisionRepository`, `CategoryRepository`, `TagRepository`, `UserRepository`,
`AssetRepository`, `SubscriptionRepository`, `AdCampaignRepository`, `CommentRepository`.

`Page<T>` is cursor-based, never offset — offset pagination on a growing news archive degrades.

### Ambient ports

These exist so the domain stays pure and every test is deterministic.

```ts
export interface ClockPort { now(): Date }
export interface IdPort { next(): string }
export interface EventBusPort { publish(event: DomainEvent): Promise<void> }
```

No `new Date()` and no `crypto.randomUUID()` anywhere below the composition root. A domain test that cannot control time is not a test.

### AI

One port, one adapter (`@ai-sdk/anthropic`). Every method returns a *proposal*, never a mutation — the editor always approves.

```ts
export interface AiPort {
  draftFromPrompt(input: DraftRequest): AsyncIterable<string>
  draftFromBullets(input: BulletRequest): AsyncIterable<string>
  rewrite(input: RewriteRequest): AsyncIterable<string>
  adjustTone(input: ToneRequest): AsyncIterable<string>
  suggestHeadlines(input: HeadlineRequest): Promise<Headline[]>
  suggestSeo(input: SeoRequest): Promise<SeoSuggestion>
  suggestTags(input: TagRequest): Promise<TagSuggestion[]>
  detectCategory(input: CategoryRequest): Promise<CategorySuggestion[]>
  summarise(input: SummaryRequest): Promise<Summary>
  translate(input: TranslateRequest): Promise<TranslatedArticle>
  factCheck(input: FactCheckRequest): Promise<FactCheckNote[]>
  imagePrompt(input: ImagePromptRequest): Promise<string>
  socialCaption(input: CaptionRequest): Promise<SocialCaption>
  embed(text: string): Promise<number[]>
}
```

Streaming methods return `AsyncIterable<string>` rather than a framework-specific stream type. `apps/web` converts to a UI stream at the edge of the hexagon; `media-svc` drains it to a buffer. Neither concern reaches the use case.

### Search

Split deliberately — lexical and semantic have different failure modes and different costs.

```ts
export interface SearchPort       { query(q: SearchQuery): Promise<Page<ArticleSummary>> }
export interface VectorSearchPort {
  index(id: ArticleId, embedding: number[]): Promise<void>
  similar(embedding: number[], limit: number): Promise<ArticleId[]>
}
```

### Media, distribution, revenue

```ts
export interface AssetStoragePort  { put(a: AssetUpload): Promise<AssetLocation>; signedUrl(k: string): Promise<string> }
export interface StreamPort        { createLive(i: LiveInput): Promise<LiveStream>; endLive(id: StreamId): Promise<void>
                                     uploadVod(i: VodInput): Promise<Asset>; playbackUrl(id: AssetId): Promise<string> }
export interface SocialPublishPort { publish(p: SocialPost): Promise<SocialResult>; schedule(p: SocialPost, at: Date): Promise<SocialResult> }
export interface PaymentPort       { checkout(i: CheckoutIntent): Promise<CheckoutSession>; cancel(id: SubscriptionId): Promise<void> }
export interface EmailPort         { send(m: EmailMessage): Promise<void>; sendBatch(m: EmailMessage[]): Promise<BatchResult> }
export interface MediaJobPort      { enqueue(j: MediaJob): Promise<JobId>; status(id: JobId): Promise<JobStatus> }
export interface AnalyticsPort     { record(e: AnalyticsEvent): Promise<void> }
```

`PaymentPort` has **two** adapters — Stripe (EUR, France/EU) and Paystack (GHS, Ghana). Selection is a composition-root concern based on reader region, never a use-case concern.

---

## 2. Driving ports (use cases)

One file, one use case, one public method. This is what keeps files small.

```ts
export interface UseCase<In, Out> { execute(input: In): Promise<Out> }
```

**editorial** — `CreateDraft` · `UpdateDraft` · `SubmitForReview` · `ApproveArticle` · `RejectArticle` ·
`SchedulePublication` · `PublishArticle` · `UnpublishArticle` · `RestoreRevision` · `TranslateArticle`

**identity** — `RegisterReader` · `SignInWithProvider` · `AssignRole` · `EnableTwoFactor` · `AuthorizeAction`

**media** — `UploadAsset` · `StartLiveStream` · `EndLiveStream` · `PublishEpisode` · `TranscodeVod`

**distribution** — `QueueSocialPost` · `PublishToSocial` · `SendNewsletter` · `SendBreakingAlert` · `IngestRssSource`

**audience** — `BookmarkArticle` · `RecordRead` · `PostComment` · `ModerateComment`

**revenue** — `StartSubscription` · `CancelSubscription` · `RecordDonation` · `CheckEntitlement` · `ServePlacement`

**insight** — `RecordPageView` · `BuildSeoReport` · `BuildRevenueSnapshot`

### Shape of a use case

Dependencies arrive as **one `Deps` object**, not as positional constructor parameters. Two reasons: the `max-params: 4` gate is real and several use cases legitimately need five collaborators, and a named object makes the composition root readable at the call site.

```ts
export interface PublishArticleDeps {
  readonly articles: ArticleRepository
  readonly clock: ClockPort
  readonly events: EventBusPort
}

export class PublishArticle implements UseCase<PublishArticleInput, PublishArticleResult> {
  constructor(private readonly deps: PublishArticleDeps) {}

  async execute(input: PublishArticleInput): Promise<PublishArticleResult> {
    const article = await this.deps.articles.findById(input.articleId)
    if (article === null) throw new ArticleNotFound(input.articleId)

    const published = article.publish(input.actor, this.deps.clock.now()) // ← the rule lives in the entity

    await this.deps.articles.save(published)
    await this.deps.events.publish(
      articlePublished(
        { articleId: published.id, actorId: input.actor.id, occurredAt: now },
        published.slug.value,
        published.locale,
      ),
    )

    return { articleId: published.id, status: published.status, slug: published.slug.value, ... }
  }
}
```

The workflow rule — *may this actor publish this article in this state?* — is inside `article.publish()`, in `packages/domain`, tested with no database, no mocks and no framework.

### Events carry what the subscriber needs

`article.published` carries `slug` and `locale` so the cache-invalidation subscriber can call `updateTag` without re-reading the article. `article.rejected` carries the editor's `note`; `article.unpublished` carries the `reason`. An event that forces a round trip to be useful is an incomplete event.

### Built in R1

`CreateDraft` · `SubmitForReview` · `ApproveArticle` · `RejectArticle` · `SchedulePublication` · `PublishArticle` · `UnpublishArticle` · `PublishDueArticles`

`PublishDueArticles` is the scheduled-publication cron. It collects per-article failures rather than throwing, because one bad article must not strand the newsroom's queue — and it returns them rather than logging, because a scheduled article that silently never publishes is the worst outcome available.

---

## 3. Rules

1. A port never leaks its technology. No `Db`, no `Collection`, no `ObjectId`, no `Response`, no `Stripe.Event` in a signature.
2. A use case depends on ports only. If it needs a second aggregate, it takes a second repository.
3. Adapters never call each other. Orchestration is the use case's job.
4. Every port gets a hand-written in-memory fake in `packages/application/src/testing/`. Unit tests use fakes; integration tests use testcontainers. We do not auto-mock.
