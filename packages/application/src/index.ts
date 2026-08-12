export type {
  AiPort, ArticleContext, BulletRequest, CaptionRequest, CategoryOption, CategoryRequest,
  CategorySuggestion, DraftRequest, FactCheckNote, Headline, RewriteRequest,
  SeoSuggestion, SocialCaption, Summary, TagSuggestion, Tone, ToneRequest, TranslateRequest,
  TranslatedArticle,
} from './ports/ai'
export type { EmbeddingPort } from './ports/embedding'
export type { ClockPort, DomainEvent, EventBusPort, IdPort } from './ports/ambient'
export type {
  ArticleRepository,
  AuthoredQuery,
  PublishedQuery,
} from './ports/article-repository'
export { clampLimit, type Cursor, type LimitBounds, type Page } from './ports/pagination'
export type { RevisionRepository } from './ports/revision-repository'
export type { CategoryRepository } from './ports/category-repository'
export type { BookmarkRepository } from './ports/bookmark-repository'
export type {
  SocialPostRepository,
  SocialPublishPort,
  SocialResult,
  SocialTarget,
} from './ports/social'
export type { CommentRepository } from './ports/comment-repository'
export type { LikeRepository } from './ports/like-repository'
export {
  LikeArticle,
  type LikeArticleDeps,
  type LikeArticleInput,
} from './audience/like-article'
export { UnlikeArticle, type UnlikeArticleInput } from './audience/unlike-article'
export {
  CountLikes,
  type CountLikesInput,
  type CountLikesResult,
} from './audience/count-likes'
export type { ArticleReadRank, ReadingRepository } from './ports/reading-repository'
export { ListMostRead, type ListMostReadInput } from './audience/list-most-read'
export { ListRelatedArticles, type ListRelatedArticlesInput } from './audience/list-related-articles'
export { RecordReading, type RecordReadingDeps, type RecordReadingInput } from './audience/record-reading'
export { ListReadingHistory, type ListReadingHistoryInput, type ReadArticle } from './audience/list-reading-history'
export { CountReadings } from './audience/count-readings'
export {
  PostComment,
  type PostCommentDeps,
  type PostCommentInput,
} from './audience/post-comment'
export {
  CommentNotFound,
  ModerateComment,
  type ModerateCommentDeps,
  type ModerateCommentInput,
} from './audience/moderate-comment'
export {
  ListPendingComments,
  ListVisibleComments,
  type ListPendingCommentsInput,
  type ListVisibleCommentsInput,
} from './audience/list-comments'
export {
  QueueSocialPost,
  type QueueSocialPostDeps,
  type QueueSocialPostInput,
  type QueueSocialPostResult,
} from './distribution/queue-social-post'
export { CaptionNeedsBody, ProposeSocialCaption, type ProposeSocialCaptionDeps, type ProposeSocialCaptionInput } from './distribution/propose-social-caption'
export { PublishDuePosts, type PublishDuePostsDeps, type PublishDuePostsResult } from './distribution/publish-due-posts'
export type { RoleRepository } from './ports/role-repository'
export {
  SaveArticle,
  type SaveArticleDeps,
  type SaveArticleInput,
} from './audience/save-article'
export {
  ListSavedArticles,
  type SavedArticle,
  RemoveSavedArticle,
  type ListSavedArticlesInput,
  type RemoveSavedArticleInput,
  type SavedArticlesDeps,
} from './audience/manage-saved-articles'
export type { DirectoryUser, UserDirectory } from './ports/user-directory'
export {
  ListUsers,
  type ListUsersDeps,
  type ListUsersInput,
} from './identity/list-users'
export { ResolvePublicByline, publicBylineName, type ResolvePublicBylineInput } from './identity/resolve-public-byline'
export {
  ListSections,
  type ListSectionsDeps,
  type ListSectionsInput,
} from './editorial/list-sections'
export {
  BrowseCategory,
  type BrowseCategoryDeps,
  type BrowseCategoryInput,
  type CategoryPage,
  type ListedArticle,
} from './editorial/browse-category'
export type { SearchHit, SearchPort, SearchQuery } from './ports/search'
export {
  SearchArticles,
  type SearchArticlesDeps,
  type SearchArticlesInput,
} from './audience/search-articles'
export {
  AssignRoles,
  type AssignRolesDeps,
  type AssignRolesInput,
  type AssignRolesResult,
} from './identity/assign-roles'
export { rolesAssigned, type RolesAssigned } from './identity/events'
export {
  ResolveActor,
  type ResolveActorDeps,
  type ResolveActorInput,
} from './identity/resolve-actor'
export type { UseCase } from './ports/use-case'

export {
  ApproveArticle,
  type ApproveArticleDeps,
  type ApproveArticleInput,
} from './editorial/approve-article'
export {
  CreateDraft,
  type CreateDraftDeps,
  type CreateDraftInput,
  type CreateDraftResult,
} from './editorial/create-draft'
export {
  GetPublishedArticle,
  type GetPublishedArticleDeps,
  type GetPublishedArticleInput,
  type PublishedArticle,
} from './editorial/get-published-article'
export {
  ListPublishedArticles,
  type ListPublishedArticlesDeps,
  type ListPublishedArticlesInput,
} from './editorial/list-published-articles'
export {
  GetDraft,
  type DraftForEditing,
  type GetDraftDeps,
  type GetDraftInput,
} from './editorial/get-draft'
export {
  ListAwaitingReview,
  type ListAwaitingReviewDeps,
  type ListAwaitingReviewInput,
} from './editorial/list-awaiting-review'
export {
  ListAuthoredArticles,
  type ListAuthoredArticlesDeps,
  type ListAuthoredArticlesInput,
  type AuthoredArticle,
} from './editorial/list-authored-articles'
export {
  UpdateDraft,
  type UpdateDraftDeps,
  type UpdateDraftInput,
  type UpdateDraftResult,
} from './editorial/update-draft'
export {
  PublishArticle,
  type PublishArticleDeps,
  type PublishArticleInput,
  type PublishArticleResult,
} from './editorial/publish-article'
export {
  PublishDueArticles,
  type PublishDueArticlesInput,
  type PublishDueArticlesResult,
} from './editorial/publish-due-articles'
export {
  RejectArticle,
  type RejectArticleDeps,
  type RejectArticleInput,
} from './editorial/reject-article'
export {
  SchedulePublication,
  type SchedulePublicationDeps,
  type SchedulePublicationInput,
} from './editorial/schedule-publication'
export {
  UnpublishArticle,
  type UnpublishArticleDeps,
  type UnpublishArticleInput,
} from './editorial/unpublish-article'
export {
  SubmitForReview,
  type SubmitForReviewDeps,
  type SubmitForReviewInput,
  type TransitionResult,
} from './editorial/submit-for-review'

export {
  ArticleNotFound,
  RevisionNotFound,
  RevisionNotOfArticle,
  SlugTaken,
} from './editorial/errors'

export {
  articlePublished,
  articleSubmitted,
  articleApproved,
  articleRejected,
  articleScheduled,
  articleUnpublished,
  type ArticlePublished,
} from './editorial/events'

export {
  ListRevisions,
  RestoreRevision,
  type ListRevisionsInput,
  type RestoreRevisionInput,
  type RevisionHistoryDeps,
} from './editorial/revisions-history'

export { excerptFrom } from './editorial/excerpt'

export type { AuditLog } from './ports/audit'
export { auditEntryFor } from './insight/audit-events'
export { ReadAuditLog, type ReadAuditLogInput, type ReadAuditLogDeps } from './insight/read-audit-log'
export type { RateLimiter, RateLimitRule, RateLimitVerdict } from './ports/rate-limit'
export type { EmailMessage, EmailPort } from './ports/email'
export type { NewsletterRepository } from './ports/newsletter-repository'
export { EmailDeliveryFailed, SubscribeNewsletter, type SubscribeNewsletterDeps, type SubscribeNewsletterInput } from './audience/subscribe-newsletter'
export {
  ContactMessageTooLong,
  EmptyContactMessage,
  SubmitContactMessage,
  type SubmitContactMessageDeps,
  type SubmitContactMessageInput,
} from './audience/submit-contact-message'
export { ConfirmNewsletter } from './audience/confirm-newsletter'
export { UnsubscribeNewsletter } from './audience/unsubscribe-newsletter'
export type { BreakingAlertRepository } from './ports/breaking-alert-repository'
export { BreakingAlertAlreadySent, SendBreakingAlert, type SendBreakingAlertDeps, type SendBreakingAlertInput } from './distribution/send-breaking-alert'
export type { PushMessage, PushPort } from './ports/push'
export type { PushSubscriptionRepository } from './ports/push-subscription-repository'
export { SubscribePush, type SubscribePushInput } from './audience/subscribe-push'
export { UnsubscribePush } from './audience/unsubscribe-push'
export type { RssEntry, RssFeedPort, RssPullResult } from './ports/rss-feed'
export type { RssSourceRepository } from './ports/rss-source-repository'
export { RegisterRssSource, type RegisterRssSourceInput } from './distribution/register-rss-source'
export { IngestRssFeeds, type IngestRssFeedsDeps } from './distribution/ingest-rss-feeds'
export type { NewsletterDigestRepository } from './ports/newsletter-digest-repository'
export { DigestAlreadySent, SendNewsletterDigest, type SendNewsletterDigestDeps, type SendNewsletterDigestInput } from './distribution/send-newsletter-digest'
