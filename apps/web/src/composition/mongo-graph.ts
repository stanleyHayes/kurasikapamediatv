import {
  MongoArticleRepository,
  MongoAuditLog,
  MongoBookmarkRepository,
  MongoCategoryRepository,
  MongoCommentRepository,
  MongoLikeRepository,
  MongoBreakingAlertRepository,
  MongoNewsletterDigestRepository,
  MongoNewsletterRepository,
  MongoPushSubscriptionRepository,
  MongoRssSourceRepository,
  MongoReadingRepository,
  MongoRevisionRepository,
  MongoRoleRepository,
  MongoSocialPostRepository,
  MongoTextSearch,
  MongoUserDirectory,
} from '@kurasikapa/adapter-mongo'
import {
  ConfirmNewsletter,
  CountLikes,
  CountReadings,
  LikeArticle,
  ListMostRead,
  ListReadingHistory,
  ListRelatedArticles,
  RecordReading,
  SendBreakingAlert,
  SendNewsletterDigest,
  SubscribeNewsletter,
  SubscribePush,
  UnsubscribeNewsletter,
  UnsubscribePush,
  ListPendingComments,
  ListSavedArticles,
  ListVisibleComments,
  ModerateComment,
  PostComment,
  RemoveSavedArticle,
  SaveArticle,
  UnlikeArticle,
  type ArticleRepository,
  type AuditLog,
  type BookmarkRepository,
  type CategoryRepository,
  type ClockPort,
  type CommentRepository,
  type EmailPort,
  type LikeRepository,
  type BreakingAlertRepository,
  type NewsletterRepository,
  type NewsletterDigestRepository,
  type PushPort,
  type PushSubscriptionRepository,
  type RssSourceRepository,
  type ReadingRepository,
  type IdPort,
  type RevisionRepository,
  type RoleRepository,
  type SearchPort,
  type SocialPostRepository,
  type UserDirectory,
} from '@kurasikapa/application'
import type { Db } from 'mongodb'

export interface MongoGraph {
  readonly articles: ArticleRepository
  readonly revisions: RevisionRepository
  readonly roles: RoleRepository
  readonly search: SearchPort
  readonly users: UserDirectory
  readonly bookmarks: BookmarkRepository
  readonly comments: CommentRepository
  readonly likes: LikeRepository
  readonly readings: ReadingRepository
  readonly subscriptions: NewsletterRepository
  readonly alerts: BreakingAlertRepository
  readonly digests: NewsletterDigestRepository
  readonly devices: PushSubscriptionRepository
  readonly rssSources: RssSourceRepository
  readonly socialPosts: SocialPostRepository,
  readonly audit: AuditLog
  readonly categories: CategoryRepository
}

/**
 * Pure wiring, given infrastructure. Separated from `container()` so a test
 * can build the whole graph over fakes without touching env or the network.
 */
export function mongoGraph(db: Db, clock: ClockPort): MongoGraph {
  return {
    articles: new MongoArticleRepository({ db, clock }),
    revisions: new MongoRevisionRepository(db),
    roles: new MongoRoleRepository(db),
    search: new MongoTextSearch(db),
    users: new MongoUserDirectory(db),
    bookmarks: new MongoBookmarkRepository(db),
    comments: new MongoCommentRepository(db),
    likes: new MongoLikeRepository(db),
    readings: new MongoReadingRepository(db),
    subscriptions: new MongoNewsletterRepository(db),
    alerts: new MongoBreakingAlertRepository(db),
    digests: new MongoNewsletterDigestRepository(db),
    devices: new MongoPushSubscriptionRepository(db),
    rssSources: new MongoRssSourceRepository(db),
    socialPosts: new MongoSocialPostRepository(db),
    audit: new MongoAuditLog(db),
    categories: new MongoCategoryRepository(db),
  }
}

export function commentCommands(
  comments: CommentRepository,
  articles: ArticleRepository,
  clock: ClockPort,
  ids: IdPort,
): {
  readonly postComment: PostComment
  readonly moderateComment: ModerateComment
  readonly listVisibleComments: ListVisibleComments
  readonly listPendingComments: ListPendingComments
} {
  return {
    postComment: new PostComment({ comments, articles, clock, ids }),
    moderateComment: new ModerateComment({ comments }),
    listVisibleComments: new ListVisibleComments(comments),
    listPendingComments: new ListPendingComments(comments),
  }
}

export function audienceCommands(
  graph: MongoGraph,
  clock: ClockPort,
  ids: IdPort,
): {
  readonly saveArticle: SaveArticle
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
  readonly listReadingHistory: ListReadingHistory
  readonly countReadings: CountReadings
  readonly listMostRead: ListMostRead
  readonly listRelatedArticles: ListRelatedArticles
} {
  return {
    saveArticle: new SaveArticle({ bookmarks: graph.bookmarks, articles: graph.articles, clock }),
    removeSavedArticle: new RemoveSavedArticle({
      bookmarks: graph.bookmarks,
      articles: graph.articles,
    }),
    listSavedArticles: new ListSavedArticles({
      bookmarks: graph.bookmarks,
      articles: graph.articles,
    }),
    ...commentCommands(graph.comments, graph.articles, clock, ids),
    likeArticle: new LikeArticle({ likes: graph.likes, articles: graph.articles, clock }),
    unlikeArticle: new UnlikeArticle(graph.likes),
    countLikes: new CountLikes(graph.likes),
    recordReading: new RecordReading({
      readings: graph.readings,
      articles: graph.articles,
      clock,
    }),
    listReadingHistory: new ListReadingHistory(graph.readings, graph.articles),
    countReadings: new CountReadings(graph.readings),
    listMostRead: new ListMostRead(graph.readings, graph.articles),
    listRelatedArticles: new ListRelatedArticles(graph.articles),
  }
}

export function newsletterCommands(input: {
  readonly graph: MongoGraph
  readonly email: EmailPort
  readonly push: PushPort
  readonly ids: IdPort
  readonly clock: ClockPort
  readonly siteUrl: string
}): {
  readonly subscribeNewsletter: SubscribeNewsletter
  readonly confirmNewsletter: ConfirmNewsletter
  readonly unsubscribeNewsletter: UnsubscribeNewsletter
  readonly sendBreakingAlert: SendBreakingAlert
  readonly sendNewsletterDigest: SendNewsletterDigest
  readonly subscribePush: SubscribePush
  readonly unsubscribePush: UnsubscribePush
} {
  const { subscriptions, articles, alerts, devices, digests } = input.graph
  return {
    subscribeNewsletter: new SubscribeNewsletter({
      subscriptions,
      email: input.email,
      ids: input.ids,
      siteUrl: input.siteUrl,
    }),
    confirmNewsletter: new ConfirmNewsletter(subscriptions, input.clock),
    unsubscribeNewsletter: new UnsubscribeNewsletter(subscriptions),
    sendBreakingAlert: new SendBreakingAlert({
      articles,
      subscriptions,
      alerts,
      email: input.email,
      devices,
      push: input.push,
      clock: input.clock,
      siteUrl: input.siteUrl,
    }),
    sendNewsletterDigest: new SendNewsletterDigest({
      articles,
      subscriptions,
      digests,
      email: input.email,
      clock: input.clock,
      siteUrl: input.siteUrl,
    }),
    subscribePush: new SubscribePush(devices, input.clock),
    unsubscribePush: new UnsubscribePush(devices),
  }
}
