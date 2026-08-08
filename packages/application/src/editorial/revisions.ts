import { type ArticleId, Revision, type UserId, revisionId } from '@kurasikapa/domain'
import type { ClockPort, IdPort } from '../ports/ambient'

export interface RevisionMinting {
  readonly clock: ClockPort
  readonly ids: IdPort
}

export interface RevisionContent {
  readonly articleId: ArticleId
  readonly title: string
  readonly body: string
  readonly authorId: UserId
}

/**
 * Mints the next revision in an article's history.
 *
 * Shared by CreateDraft and UpdateDraft so the two cannot drift — one of them
 * gaining a field the other lacks would leave the first save of an article
 * shaped differently from every save after it.
 */
export const mintRevision = (
  deps: RevisionMinting,
  content: RevisionContent,
  previous: Revision | null,
): Revision =>
  Revision.append(
    {
      id: revisionId(deps.ids.next()),
      articleId: content.articleId,
      title: content.title,
      body: content.body,
      authorId: content.authorId,
      createdAt: deps.clock.now(),
    },
    previous,
  )
