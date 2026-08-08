import type {
  AiPort,
  ArticleContext,
  BulletRequest,
  CategoryRequest,
  CategorySuggestion,
  DraftRequest,
  FactCheckNote,
  Headline,
  RewriteRequest,
  SeoSuggestion,
  Summary,
  TagSuggestion,
  ToneRequest,
  TranslateRequest,
  TranslatedArticle,
} from '@kurasikapa/application'
import { objectOf, streamOf } from './generate.js'
import type { ModelResolver } from './models.js'
import { PROMPT, SYSTEM } from './prompts.js'
import {
  categorySchema,
  factCheckSchema,
  headlinesSchema,
  imagePromptSchema,
  seoSchema,
  summarySchema,
  tagsSchema,
  translationSchema,
} from './schemas.js'

/**
 * The only place that knows Claude exists.
 *
 * Provider-specific concerns — prompt shape, model routing, retries, refusals,
 * token accounting — stop here. Swapping to AI Gateway or another provider is
 * a change inside this package plus one wiring line. See ADR-0005.
 */
export class AnthropicAiAdapter implements AiPort {
  constructor(private readonly models: ModelResolver) {}

  draftFromPrompt(input: DraftRequest): AsyncIterable<string> {
    return streamOf({
      model: this.models.for('draft'),
      system: SYSTEM.draft,
      prompt: PROMPT.draft(input),
    })
  }

  draftFromBullets(input: BulletRequest): AsyncIterable<string> {
    return streamOf({
      model: this.models.for('draft'),
      system: SYSTEM.draft,
      prompt: PROMPT.bullets(input),
    })
  }

  rewrite(input: RewriteRequest): AsyncIterable<string> {
    return streamOf({
      model: this.models.for('rewrite'),
      system: SYSTEM.rewrite,
      prompt: PROMPT.rewrite(input),
    })
  }

  adjustTone(input: ToneRequest): AsyncIterable<string> {
    return streamOf({
      model: this.models.for('rewrite'),
      system: SYSTEM.tone,
      prompt: PROMPT.tone(input),
    })
  }

  async suggestHeadlines(input: ArticleContext): Promise<readonly Headline[]> {
    const { headlines } = await objectOf({
      model: this.models.for('headline'),
      system: SYSTEM.headline,
      prompt: PROMPT.headline(input),
      schema: headlinesSchema,
    })

    return headlines
  }

  suggestSeo(input: ArticleContext): Promise<SeoSuggestion> {
    return objectOf({
      model: this.models.for('seo'),
      system: SYSTEM.seo,
      prompt: PROMPT.seo(input),
      schema: seoSchema,
    })
  }

  async suggestTags(input: ArticleContext): Promise<readonly TagSuggestion[]> {
    const { tags } = await objectOf({
      model: this.models.for('classify'),
      system: SYSTEM.classify,
      prompt: PROMPT.tags(input),
      schema: tagsSchema,
    })

    return tags
  }

  async detectCategory(input: CategoryRequest): Promise<readonly CategorySuggestion[]> {
    const { categories } = await objectOf({
      model: this.models.for('classify'),
      system: SYSTEM.classify,
      prompt: PROMPT.category(input),
      schema: categorySchema,
    })

    // The model is told to pick from the options, but a hallucinated slug would
    // otherwise reach the CMS as a category that does not exist.
    const allowed = new Set(input.options.map((o) => o.slug))
    return categories.filter((c) => allowed.has(c.slug))
  }

  summarise(input: ArticleContext): Promise<Summary> {
    return objectOf({
      model: this.models.for('summarise'),
      system: SYSTEM.summarise,
      prompt: PROMPT.summarise(input),
      schema: summarySchema,
    })
  }

  async translate(input: TranslateRequest): Promise<TranslatedArticle> {
    const translated = await objectOf({
      model: this.models.for('translate'),
      system: SYSTEM.translate,
      prompt: PROMPT.translate(input),
      schema: translationSchema,
    })

    return { ...translated, locale: input.targetLocale }
  }

  async factCheck(input: ArticleContext): Promise<readonly FactCheckNote[]> {
    const { notes } = await objectOf({
      model: this.models.for('factcheck'),
      system: SYSTEM.factcheck,
      prompt: PROMPT.factcheck(input),
      schema: factCheckSchema,
    })

    return notes
  }

  async imagePrompt(input: ArticleContext): Promise<string> {
    const { prompt } = await objectOf({
      model: this.models.for('image'),
      system: SYSTEM.image,
      prompt: PROMPT.image(input),
      schema: imagePromptSchema,
    })

    return prompt
  }
}
