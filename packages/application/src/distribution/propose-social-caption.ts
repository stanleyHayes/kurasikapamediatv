import {
  type Actor,
  type ArticleId,
  type Platform,
  isPubliclyVisible,
  requirePermission,
} from '@kurasikapa/domain'
import { ArticleNotFound } from '../editorial/errors'
import type { AiPort, SocialCaption } from '../ports/ai'
import type { ArticleRepository } from '../ports/article-repository'
import type { RevisionRepository } from '../ports/revision-repository'
import type { UseCase } from '../ports/use-case'

export interface ProposeSocialCaptionDeps {
  readonly articles: ArticleRepository
  readonly revisions: RevisionRepository
  readonly ai: AiPort
}

export interface ProposeSocialCaptionInput {
  readonly actor: Actor
  readonly articleId: ArticleId
  readonly platform: Platform
}

export class CaptionNeedsBody extends Error {
  constructor(articleId: ArticleId) {
    super(`Article ${articleId} has no approved body to caption from`)
    this.name = 'CaptionNeedsBody'
  }
}

/**
 * AI caption proposal for the social queue.
 *
 * Loads the APPROVED body — not a draft correction — so the caption matches
 * what readers will see when they click through. Returns a proposal only;
 * queueing still requires the editor to paste and schedule.
 */
export class ProposeSocialCaption
  implements UseCase<ProposeSocialCaptionInput, SocialCaption>
{
  constructor(private readonly deps: ProposeSocialCaptionDeps) {}

  async execute(input: ProposeSocialCaptionInput): Promise<SocialCaption> {
    requirePermission(input.actor, 'social:publish')

    const article = await this.deps.articles.findById(input.articleId)
    if (article === null) throw new ArticleNotFound(input.articleId)
    if (!isPubliclyVisible(article.status)) throw new ArticleNotFound(input.articleId)

    const approvedId = article.snapshot().approvedRevisionId
    const revision =
      approvedId === null ? null : await this.deps.revisions.findById(approvedId)
    const body = revision?.body ?? null
    if (body === null || body.trim() === '') throw new CaptionNeedsBody(input.articleId)

    return this.deps.ai.socialCaption({
      title: article.snapshot().title,
      body,
      locale: article.locale,
      platform: input.platform,
    })
  }
}
