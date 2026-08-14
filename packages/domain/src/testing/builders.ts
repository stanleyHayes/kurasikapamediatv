import { Article, type ArticleProps } from '../editorial/article'
import { Actor } from '../identity/actor'
import type { Role } from '../identity/role'
import { Broadcast, type BroadcastProps } from '../media/broadcast'
import { articleId, broadcastId, categoryId, familyId, revisionId, userId } from '../shared/ids'
import { Slug } from '../shared/slug'

export const AUTHOR = userId('usr_author')
export const OTHER = userId('usr_other')
export const REVISION = revisionId('rev_1')
export const PRODUCER = userId('usr_producer')

export const actorWith = (roles: readonly Role[], id = AUTHOR): Actor => new Actor(id, roles)

export const anArticle = (overrides: Partial<ArticleProps> = {}): Article =>
  Article.reconstitute({
    id: articleId('art_1'),
    familyId: familyId('fam_1'),
    locale: 'en',
    slug: Slug.of('budget-2026'),
    title: 'Budget 2026',
    authorId: AUTHOR,
    categoryId: categoryId('cat_business'),
    tagIds: [],
    status: 'draft',
    approvedRevisionId: null,
    scheduledAt: null,
    publishedAt: null,
    ...overrides,
  })

/** An article that has cleared review and is legal to publish. */
export const anApprovedArticle = (overrides: Partial<ArticleProps> = {}): Article =>
  anArticle({ status: 'approved', approvedRevisionId: REVISION, ...overrides })

export const BROADCAST_STARTED_AT = new Date('2026-08-14T19:02:00Z')

/**
 * A broadcast in whatever state a test needs, built through `reconstitute` so
 * seeding a repository never has to walk the state machine to get there.
 */
export const aBroadcast = (overrides: Partial<BroadcastProps> = {}): Broadcast =>
  Broadcast.reconstitute({
    id: broadcastId('bcast_1'),
    title: 'Journal de 20h',
    locale: 'fr',
    channelArn: 'arn:aws:ivs:eu-west-3:000000000000:channel/abc123',
    playbackUrl: 'https://abc123.eu-west-3.playback.live-video.net/v1/master.m3u8',
    state: 'live',
    scheduledFor: new Date('2026-08-14T19:00:00Z'),
    startedAt: BROADCAST_STARTED_AT,
    endedAt: null,
    createdBy: PRODUCER,
    ...overrides,
  })
