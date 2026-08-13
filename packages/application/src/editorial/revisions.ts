import {
  type ArticleId,
  Revision,
  type RevisionTrigger,
  type UserId,
  revisionId,
} from '@kurasikapa/domain'
import type { ClockPort, IdPort } from '../ports/ambient'
import type { RevisionRepository } from '../ports/revision-repository'
import { RevisionHistoryMissing } from './errors'

export interface RevisionMinting {
  readonly clock: ClockPort
  readonly ids: IdPort
}

export interface TransitionMinting extends RevisionMinting {
  readonly revisions: RevisionRepository
}

export interface RevisionContent {
  readonly articleId: ArticleId
  readonly title: string
  readonly body: string
  readonly authorId: UserId
  readonly trigger: RevisionTrigger
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
      trigger: content.trigger,
    },
    previous,
  )

/**
 * Records a workflow transition as a revision, then appends it.
 *
 * The PRD (§3) wants a revision on every transition, but a transition changes
 * no text — so the snapshot carries the article's CURRENT title and body
 * forward from its latest revision, and `trigger` says what actually happened.
 * History then reads as the state of the article at each step, not as a run
 * of identical saves nobody can explain.
 *
 * All six transition use cases mint through here for the same reason
 * CreateDraft and UpdateDraft share mintRevision: history entries that differ
 * in shape depending on which door they entered through are a drift bug
 * waiting to be filed.
 */
export const mintTransitionRevision = async (
  deps: TransitionMinting,
  articleId: ArticleId,
  actorId: UserId,
  trigger: RevisionTrigger,
): Promise<Revision> => {
  const latest = await deps.revisions.findLatest(articleId)
  if (latest === null) throw new RevisionHistoryMissing(articleId)

  const revision = mintRevision(
    deps,
    { articleId, title: latest.title, body: latest.body, authorId: actorId, trigger },
    latest,
  )

  await deps.revisions.append(revision)
  return revision
}
