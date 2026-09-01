export type {
  AiPort, ArticleContext, BulletRequest, CaptionRequest, CategoryOption, CategoryRequest,
  CategorySuggestion, DraftRequest, FactCheckNote, GrammarIssue, Headline, RewriteRequest,
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
export type { SitePageRepository } from './ports/site-page-repository'
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
export type { ArticleReadRank, ReadingRepository } from './ports/reading-repository'
export {
  QueueSocialPost,
  type QueueSocialPostDeps,
  type QueueSocialPostInput,
  type QueueSocialPostResult,
} from './distribution/queue-social-post'
export { CaptionNeedsBody, ProposeSocialCaption, type ProposeSocialCaptionDeps, type ProposeSocialCaptionInput } from './distribution/propose-social-caption'
export { ProposeSocialSummary, type ProposeSocialSummaryDeps, type ProposeSocialSummaryInput } from './distribution/propose-social-summary'
export { PublishDuePosts, type PublishDuePostsDeps, type PublishDuePostsResult } from './distribution/publish-due-posts'
export type { RoleRepository } from './ports/role-repository'
export type { DirectoryUser, UserDirectory } from './ports/user-directory'
export { PendingInvitationExists, type InvitationRecord, type InvitationRepository, type InvitationState } from './ports/invitation-repository'
export { InviteUser, type InviteUserInput, type InviteUserResult } from './identity/invite-user'
export { AcceptInvitation, InvitationUnusable } from './identity/accept-invitation'
export { RevokeInvitation } from './identity/revoke-invitation'
export { ResendInvitation } from './identity/resend-invitation'
export {
  ListUsers,
  type ListUsersDeps,
  type ListUsersInput,
} from './identity/list-users'
export { ResolvePublicByline, publicBylineName, type ResolvePublicBylineInput } from './identity/resolve-public-byline'
export { UpdateOwnProfile, type UpdateOwnProfileInput } from './identity/update-own-profile'
export { ChangePassword, PasswordChangeRejected, type ChangePasswordInput } from './identity/change-password'
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
  RevisionHistoryMissing,
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
export { GetSitePage } from './editorial/get-site-page'
export { ManageSitePages, type ManageSitePageInput } from './editorial/manage-site-pages'

export type { AuditLog } from './ports/audit'
export { auditEntryFor } from './insight/audit-events'
export { ReadAuditLog, type ReadAuditLogInput, type ReadAuditLogDeps } from './insight/read-audit-log'
export type { InsightRepository, NewsroomReport, RankedMetric, ReadingDepthMetric, StoryMetric, TrendPoint } from './ports/insight-repository'
export { RecordPageView, type RecordPageViewInput } from './insight/record-page-view'
export { RecordArticleEngagement, type RecordArticleEngagementInput } from './insight/record-article-engagement'
export { BuildNewsroomReport, type BuildNewsroomReportInput } from './insight/build-newsroom-report'
export type { RateLimiter, RateLimitRule, RateLimitVerdict } from './ports/rate-limit'
export type { EmailMessage, EmailPort } from './ports/email'
export type { NewsletterRepository } from './ports/newsletter-repository'
export type { BreakingAlertRepository } from './ports/breaking-alert-repository'
export { BreakingAlertAlreadySent, SendBreakingAlert, type SendBreakingAlertDeps, type SendBreakingAlertInput } from './distribution/send-breaking-alert'
export type { PushMessage, PushPort } from './ports/push'
export type { PushSubscriptionRepository } from './ports/push-subscription-repository'
export type { RssEntry, RssFeedPort, RssPullResult } from './ports/rss-feed'
export type { RssSourceRepository } from './ports/rss-source-repository'
export { RegisterRssSource, type RegisterRssSourceInput } from './distribution/register-rss-source'
export { IngestRssFeeds, type IngestRssFeedsDeps } from './distribution/ingest-rss-feeds'
export type { NewsletterDigestRepository } from './ports/newsletter-digest-repository'
export { DigestAlreadySent, SendNewsletterDigest, type SendNewsletterDigestDeps, type SendNewsletterDigestInput } from './distribution/send-newsletter-digest'

export * from './identity'
export * from './media'
export * from './audience'
