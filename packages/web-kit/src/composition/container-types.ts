import type {
  AiPort,
  ApproveArticle,
  AssignRoles,
  BrowseCategory,
  BuildNewsroomReport,
  ClockPort,
  ConfirmNewsletter,
  CountLikes,
  CountReadings,
  CreateDraft,
  EmailPort,
  EventBusPort,
  GetDraft,
  GetPublishedArticle,
  GetSitePage,
  IdPort,
  IngestRssFeeds,
  LikeArticle,
  ListAuthoredArticles,
  ListAwaitingReview,
  ListMostRead,
  ListPendingComments,
  ListPublishedArticles,
  ListReadingHistory,
  ListRelatedArticles,
  ListRevisions,
  ListSavedArticles,
  ListSections,
  ListUsers,
  ListVisibleComments,
  ListBroadcasts,
  GetCurrentBroadcast,
  StartBroadcast,
  EndBroadcast,
  CreatePresenter,
  PublishPresenter,
  CreateProgramme,
  PublishProgramme,
  ScheduleProgramme,
  ListTelevisionGuide,
  LiveVideoPort,
  ModerateComment,
  ManageSitePages,
  PostComment,
  ProposeSocialCaption,
  PublishArticle,
  PublishDueArticles,
  PublishDuePosts,
  PushPort,
  QueueSocialPost,
  RateLimiter,
  ReadAuditLog,
  RecordReading,
  RecordPageView,
  RegisterRssSource,
  RejectArticle,
  RemoveSavedArticle,
  ResolveActor,
  ResolvePublicByline,
  RestoreRevision,
  RssFeedPort,
  RssSourceRepository,
  SaveArticle,
  SchedulePublication,
  SearchArticles,
  SendBreakingAlert,
  SendNewsletterDigest,
  SocialPostRepository,
  SitePageRepository,
  SocialPublishPort,
  SubscribeNewsletter,
  SubscribePush,
  SubmitContactMessage,
  SubmitForReview,
  UnlikeArticle,
  UnpublishArticle,
  UnsubscribeNewsletter,
  UnsubscribePush,
  UpdateDraft,
} from '@kurasikapa/application'
import type { Db } from 'mongodb'
import type { InProcessEventBus } from './ambient'

export interface Container {
  // Commands
  readonly createDraft: CreateDraft
  readonly updateDraft: UpdateDraft
  readonly submitForReview: SubmitForReview
  readonly approveArticle: ApproveArticle
  readonly rejectArticle: RejectArticle
  readonly schedulePublication: SchedulePublication
  readonly publishArticle: PublishArticle
  readonly unpublishArticle: UnpublishArticle
  readonly publishDueArticles: PublishDueArticles
  readonly assignRoles: AssignRoles
  readonly listUsers: ListUsers
  readonly resolvePublicByline: ResolvePublicByline
  readonly saveArticle: SaveArticle
  readonly queueSocialPost: QueueSocialPost
  readonly proposeSocialCaption: ProposeSocialCaption
  readonly publishDuePosts: PublishDuePosts
  /** Read side for the publishing queue screen. */
  readonly socialPosts: SocialPostRepository
  readonly readAuditLog: ReadAuditLog
  /** Exposed directly: limiting is a transport concern, not a use case. */
  readonly rateLimiter: RateLimiter
  readonly removeSavedArticle: RemoveSavedArticle
  readonly listSavedArticles: ListSavedArticles
  readonly postComment: PostComment
  readonly moderateComment: ModerateComment
  readonly listVisibleComments: ListVisibleComments
  readonly listPendingComments: ListPendingComments
  readonly likeArticle: LikeArticle
  readonly unlikeArticle: UnlikeArticle
  readonly countLikes: CountLikes
  readonly recordReading: RecordReading
  readonly recordPageView: RecordPageView
  readonly buildNewsroomReport: BuildNewsroomReport
  readonly listReadingHistory: ListReadingHistory
  readonly countReadings: CountReadings
  readonly subscribeNewsletter: SubscribeNewsletter
  readonly confirmNewsletter: ConfirmNewsletter
  readonly unsubscribeNewsletter: UnsubscribeNewsletter
  readonly submitContactMessage: SubmitContactMessage
  readonly subscribePush: SubscribePush
  readonly unsubscribePush: UnsubscribePush
  readonly sendBreakingAlert: SendBreakingAlert
  readonly sendNewsletterDigest: SendNewsletterDigest
  readonly registerRssSource: RegisterRssSource
  readonly ingestRssFeeds: IngestRssFeeds
  readonly rssSources: RssSourceRepository
  readonly manageSitePages: ManageSitePages
  readonly sitePages: SitePageRepository
  readonly startBroadcast: StartBroadcast
  readonly endBroadcast: EndBroadcast
  readonly getCurrentBroadcast: GetCurrentBroadcast
  readonly listBroadcasts: ListBroadcasts
  readonly createPresenter: CreatePresenter
  readonly publishPresenter: PublishPresenter
  readonly createProgramme: CreateProgramme
  readonly publishProgramme: PublishProgramme
  readonly scheduleProgramme: ScheduleProgramme
  readonly listTelevisionGuide: ListTelevisionGuide

  // Queries
  readonly getPublishedArticle: GetPublishedArticle
  readonly listPublishedArticles: ListPublishedArticles
  readonly listMostRead: ListMostRead
  readonly listRelatedArticles: ListRelatedArticles
  readonly browseCategory: BrowseCategory
  readonly listSections: ListSections
  readonly listAuthoredArticles: ListAuthoredArticles
  readonly getDraft: GetDraft
  readonly listRevisions: ListRevisions
  readonly restoreRevision: RestoreRevision
  readonly listAwaitingReview: ListAwaitingReview
  readonly searchArticles: SearchArticles
  readonly resolveActor: ResolveActor
  readonly getSitePage: GetSitePage

  // Ports exposed for interactive use (AI streams straight to the editor)
  readonly ai: AiPort
  readonly events: InProcessEventBus
}

export interface Infrastructure {
  readonly db: Db
  readonly clock: ClockPort
  readonly ids: IdPort
  readonly events: EventBusPort & InProcessEventBus
  readonly ai: AiPort
  readonly social?: SocialPublishPort | undefined
  readonly email?: EmailPort | undefined
  readonly push?: PushPort | undefined
  readonly feed?: RssFeedPort | undefined
  readonly siteUrl?: string | undefined
  readonly live?: LiveVideoPort | undefined
}
