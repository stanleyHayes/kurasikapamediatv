import { type Actor, type ArticleId, requirePermission } from '@kurasikapa/domain'
import { ArticleNotFound } from '../editorial/errors'
import type { GetPublishedArticle } from '../editorial/get-published-article'
import type { AiPort, Summary } from '../ports/ai'
import type { UseCase } from '../ports/use-case'
import { CaptionNeedsBody } from './propose-social-caption'

export interface ProposeSocialSummaryDeps {
  readonly published: GetPublishedArticle
  readonly ai: AiPort
}

export interface ProposeSocialSummaryInput {
  readonly actor: Actor
  readonly articleId: ArticleId
  readonly slug: string
  readonly locale: string
}

/**
 * AI short-summary proposal for the social composer.
 *
 * Summarises the APPROVED body — the text readers will actually get — through
 * the same GetPublishedArticle lookup the public site uses, so the
 * approved-revision rule lives in one place rather than being copied here.
 * Returns a proposal only: accepting it into a caption stays with the editor
 * (ADR-0005), exactly like the caption proposal.
 */
export class ProposeSocialSummary implements UseCase<ProposeSocialSummaryInput, Summary> {
  constructor(private readonly deps: ProposeSocialSummaryDeps) {}

  async execute(input: ProposeSocialSummaryInput): Promise<Summary> {
    requirePermission(input.actor, 'social:publish')

    const published = await this.deps.published.execute({
      slug: input.slug,
      locale: input.locale,
    })
    if (published === null) throw new ArticleNotFound(input.articleId)

    const body = published.body
    if (body === null || body.trim() === '') throw new CaptionNeedsBody(input.articleId)

    return this.deps.ai.summarise({
      title: published.article.snapshot().title,
      body,
      locale: input.locale,
    })
  }
}
