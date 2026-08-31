export {
  ExplodingEventBus,
  FakeClock,
  RecordingEventBus,
  SequentialIds,
} from './fakes'
export { FakeAi, type FakeAiCall, type FakeAiScript } from './fake-ai'
export { InMemoryArticleRepository } from './in-memory-article-repository'
export { InMemoryRevisionRepository } from './in-memory-revision-repository'
export { InMemoryRoleRepository } from './in-memory-role-repository'
export { InMemoryUserDirectory } from './in-memory-user-directory'
export { InMemoryBookmarkRepository } from './in-memory-bookmark-repository'
export { InMemoryCommentRepository } from './in-memory-comment-repository'
export { InMemoryLikeRepository } from './in-memory-like-repository'
export { InMemoryReadingRepository } from './in-memory-reading-repository'
export { InMemoryNewsletterRepository } from './in-memory-newsletter-repository'
export { InMemoryInsightRepository } from './in-memory-insight-repository'
export { InMemoryBreakingAlertRepository } from './in-memory-breaking-alert-repository'
export { FailClosedEmail, RecordingEmail } from './fake-email'
export { FailClosedPush, RecordingPush } from './fake-push'
export { InMemoryPushSubscriptionRepository } from './in-memory-push-subscription-repository'
export { FailClosedRssFeed, RecordingRssFeed } from './fake-rss'
export { InMemoryRssSourceRepository } from './in-memory-rss-source-repository'
export { InMemoryNewsletterDigestRepository } from './in-memory-newsletter-digest-repository'
export { FakeSearch } from './fake-search'
export { FailClosedLiveVideo, FakeLiveVideo } from './fake-live-video'
export {
  ExplodingBroadcastRepository,
  InMemoryBroadcastRepository,
  STORE_UNAVAILABLE,
  UnfilteredBroadcastRepository,
} from './in-memory-broadcast-repository'
export { InMemoryCategoryRepository } from './in-memory-category-repository'
export { InMemoryPresenterRepository } from './in-memory-presenter-repository'
export { InMemoryProgrammeRepository } from './in-memory-programme-repository'
export { InMemoryScheduleRepository } from './in-memory-schedule-repository'
export {
  FlakySocial,
  InMemorySocialPostRepository,
  RecordingSocial,
} from './social-fakes'
export {
  AllowingRateLimiter,
  CREDENTIAL_STORE_UNAVAILABLE,
  ExplodingCredentialRepository,
  FakePasswordHasher,
  FakeSecretGenerator,
  FakeTokenSigner,
  FakeTotp,
  InMemoryCredentialRepository,
  InMemoryRefreshTokenRepository,
} from './auth-fakes'
export {
  FakeOAuthProvider,
  RefusingOAuthProvider,
  type ExchangeCall,
} from './oauth-fakes'
