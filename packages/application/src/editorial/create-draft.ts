import {
  Article,
  type Actor,
  type ArticleId,
  type CategoryId,
  type FamilyId,
  type RevisionId,
  Slug,
  type TagId,
  articleId,
  familyId as toFamilyId,
} from '@kurasikapa/domain'
import type { ClockPort, EventBusPort, IdPort } from '../ports/ambient'
import type { ArticleRepository } from '../ports/article-repository'
import type { RevisionRepository } from '../ports/revision-repository'
import type { UseCase } from '../ports/use-case'
import { SlugTaken } from './errors'
import { mintRevision } from './revisions'
import { draftCreated } from './events'

export interface CreateDraftDeps {
  readonly articles: ArticleRepository
  readonly revisions: RevisionRepository
  readonly clock: ClockPort
  readonly ids: IdPort
  readonly events: EventBusPort
}

export interface CreateDraftInput {
  readonly actor: Actor
  readonly locale: string
  readonly title: string
  readonly body: string
  readonly categoryId: CategoryId
  readonly tagIds?: readonly TagId[]
  /** Supply to add a translation to an existing article family. */
  readonly familyId?: FamilyId
}

export interface CreateDraftResult {
  readonly articleId: ArticleId
  readonly familyId: FamilyId
  readonly revisionId: RevisionId
  readonly slug: string
}

/**
 * Creates a draft and its first revision.
 *
 * Passing `familyId` makes this a translation of an existing article rather
 * than a new one — same family, own slug, own workflow state.
 */
export class CreateDraft implements UseCase<CreateDraftInput, CreateDraftResult> {
  constructor(private readonly deps: CreateDraftDeps) {}

  async execute(input: CreateDraftInput): Promise<CreateDraftResult> {
    const slug = Slug.fromTitle(input.title)
    await this.guardSlugFree(slug, input.locale)

    const article = Article.create(input.actor, {
      id: articleId(this.deps.ids.next()),
      familyId: input.familyId ?? toFamilyId(this.deps.ids.next()),
      locale: input.locale,
      slug,
      title: input.title,
      categoryId: input.categoryId,
      ...(input.tagIds ? { tagIds: input.tagIds } : {}),
    })

    const now = this.deps.clock.now()
    const revision = mintRevision(
      this.deps,
      {
        articleId: article.id,
        title: input.title,
        body: input.body,
        authorId: input.actor.id,
        trigger: 'create',
      },
      null,
    )

    await this.deps.articles.save(article)
    await this.deps.revisions.append(revision)
    await this.deps.events.publish(
      draftCreated({ articleId: article.id, actorId: input.actor.id, occurredAt: now }),
    )

    return {
      articleId: article.id,
      familyId: article.familyId,
      revisionId: revision.id,
      slug: slug.value,
    }
  }

  private async guardSlugFree(slug: Slug, locale: string): Promise<void> {
    const clash = await this.deps.articles.findBySlug(slug.value, locale)
    if (clash !== null) throw new SlugTaken(slug.value, locale)
  }
}
