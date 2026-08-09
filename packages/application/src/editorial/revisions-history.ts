import { type Actor, type ArticleId, type Revision, type RevisionId } from '@kurasikapa/domain'
import type { ClockPort, IdPort } from '../ports/ambient'
import type { ArticleRepository } from '../ports/article-repository'
import type { RevisionRepository } from '../ports/revision-repository'
import type { UseCase } from '../ports/use-case'
import { ArticleNotFound, RevisionNotFound } from './errors'

export interface RevisionHistoryDeps {
  readonly articles: ArticleRepository
  readonly revisions: RevisionRepository
  readonly clock: ClockPort
  readonly ids: IdPort
}

export interface ListRevisionsInput {
  readonly actor: Actor
  readonly articleId: ArticleId
}

/**
 * An article's full history, newest first.
 *
 * Authorised exactly like reading the draft itself. The history of an
 * unpublished article says what the newsroom considered and discarded, which
 * is more sensitive than the current text, not less — "it is only a list of
 * old versions" is not a reason to loosen the guard.
 */
export class ListRevisions implements UseCase<ListRevisionsInput, readonly Revision[]> {
  constructor(private readonly deps: RevisionHistoryDeps) {}

  async execute(input: ListRevisionsInput): Promise<readonly Revision[]> {
    const article = await this.deps.articles.findById(input.articleId)
    if (article === null) throw new ArticleNotFound(input.articleId)

    article.assertReadableBy(input.actor)

    const history = await this.deps.revisions.listFor(article.id)

    // Newest first: an editor opening history is looking for what changed
    // recently, not for the article's first draft.
    return [...history].reverse()
  }
}

export interface RestoreRevisionInput {
  readonly actor: Actor
  readonly articleId: ArticleId
  readonly revisionId: RevisionId
}

/**
 * Brings an older version's text back as the current one.
 *
 * Deliberately NOT a rewind. The domain writes the restored text FORWARD as a
 * new revision, so the history keeps every step — including the mistake and
 * the restoration. A newsroom must be able to answer "what did we publish, and
 * when", and deleting the intervening versions destroys the evidence that a
 * correction ever happened.
 *
 * Guarded as an edit rather than a read, because it is one: restoring changes
 * what the article says.
 */
export class RestoreRevision implements UseCase<RestoreRevisionInput, Revision> {
  constructor(private readonly deps: RevisionHistoryDeps) {}

  async execute(input: RestoreRevisionInput): Promise<Revision> {
    const article = await this.deps.articles.findById(input.articleId)
    if (article === null) throw new ArticleNotFound(input.articleId)

    // Permission, then ownership, then state — so restore can never reach an
    // article the actor may not edit, nor one that is in review and must not
    // move under the reviewer reading it.
    article.assertEditableBy(input.actor)

    // One read of the history, not a findById plus a findLatest. Two reads
    // would leave an impossible branch to defend — if a revision OF THIS
    // ARTICLE exists then the latest cannot be missing — and unreachable code
    // is code nobody can test and everybody must maintain.
    const history = await this.deps.revisions.listFor(article.id)
    const source = history.find((r) => r.id === input.revisionId)
    const latest = history.at(-1)

    // A revision of a different article is simply absent from this list, so it
    // is reported as missing rather than as belonging elsewhere. The second
    // answer would confirm it exists.
    if (source === undefined || latest === undefined) {
      throw new RevisionNotFound(input.revisionId)
    }

    const restored = source.restoreOnto(
      this.deps.ids.next() as RevisionId,
      latest,
      input.actor.id,
      this.deps.clock.now(),
    )

    await this.deps.revisions.append(restored)

    return restored
  }
}
