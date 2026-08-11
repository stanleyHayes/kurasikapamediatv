import { type Actor, type ArticleId, Reading } from '@kurasikapa/domain'
import { ArticleNotFound } from '../editorial/errors'
import type { ClockPort } from '../ports/ambient'
import type { ArticleRepository } from '../ports/article-repository'
import type { ReadingRepository } from '../ports/reading-repository'
import type { UseCase } from '../ports/use-case'

export interface RecordReadingDeps {
  readonly readings: ReadingRepository
  readonly articles: ArticleRepository
  readonly clock: ClockPort
}

export interface RecordReadingInput {
  readonly actor: Actor
  readonly articleId: ArticleId
}

/**
 * Notes that this reader opened a published article.
 *
 * Idempotent per (reader, article): a refresh updates `readAt` rather than
 * growing a second row, so "recently read" means last visited, not first.
 */
export class RecordReading implements UseCase<RecordReadingInput, { recorded: true }> {
  constructor(private readonly deps: RecordReadingDeps) {}

  async execute(input: RecordReadingInput): Promise<{ recorded: true }> {
    const article = await this.deps.articles.findById(input.articleId)
    if (article === null) throw new ArticleNotFound(input.articleId)

    await this.deps.readings.save(Reading.record(input.actor.id, article, this.deps.clock.now()))

    return { recorded: true }
  }
}
