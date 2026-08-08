import { type Actor, type ArticleId, type RevisionId, Slug } from '@kurasikapa/domain'
import type { ClockPort, IdPort } from '../ports/ambient'
import type { ArticleRepository } from '../ports/article-repository'
import type { RevisionRepository } from '../ports/revision-repository'
import type { UseCase } from '../ports/use-case'
import { ArticleNotFound, SlugTaken } from './errors'
import { mintRevision } from './revisions'

export interface UpdateDraftDeps {
  readonly articles: ArticleRepository
  readonly revisions: RevisionRepository
  readonly clock: ClockPort
  readonly ids: IdPort
}

export interface UpdateDraftInput {
  readonly actor: Actor
  readonly articleId: ArticleId
  readonly title: string
  readonly body: string
}

export interface UpdateDraftResult {
  readonly revisionId: RevisionId
  readonly seq: number
  readonly slug: string
}

/**
 * Saves editor changes as a new revision.
 *
 * Autosave calls this, so it runs often. It appends rather than overwrites:
 * history is the product feature the questionnaire asked for, and the cost of
 * a row per save is trivial next to an editor losing an afternoon's work.
 *
 * No event is published. A draft save changes nothing a reader can see, and
 * emitting on every keystroke-batch would churn the cache for nobody.
 */
export class UpdateDraft implements UseCase<UpdateDraftInput, UpdateDraftResult> {
  constructor(private readonly deps: UpdateDraftDeps) {}

  async execute(input: UpdateDraftInput): Promise<UpdateDraftResult> {
    const article = await this.deps.articles.findById(input.articleId)
    if (article === null) throw new ArticleNotFound(input.articleId)

    const slug = article.hasBeenPublished() ? article.slug : Slug.fromTitle(input.title)
    await this.guardSlugFree(article.id, slug, article.locale)

    // Throws if the actor may not edit, does not own it, or the article has
    // moved past a state where direct editing is honest.
    const retitled = article.retitle(input.actor, input.title, slug)

    const previous = await this.deps.revisions.findLatest(article.id)
    const revision = mintRevision(
      this.deps,
      { articleId: article.id, title: input.title, body: input.body, authorId: input.actor.id },
      previous,
    )

    await this.deps.articles.save(retitled)
    await this.deps.revisions.append(revision)

    return { revisionId: revision.id, seq: revision.seq, slug: slug.value }
  }

  private async guardSlugFree(self: ArticleId, slug: Slug, locale: string): Promise<void> {
    const clash = await this.deps.articles.findBySlug(slug.value, locale)
    // Renaming a draft to the slug it already has is not a clash.
    if (clash !== null && clash.id !== self) throw new SlugTaken(slug.value, locale)
  }
}
