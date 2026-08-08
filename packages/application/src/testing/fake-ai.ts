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
} from '../ports/ai'

export interface FakeAiScript {
  readonly stream?: readonly string[]
  readonly headlines?: readonly Headline[]
  readonly seo?: SeoSuggestion
  readonly tags?: readonly TagSuggestion[]
  readonly categories?: readonly CategorySuggestion[]
  readonly summary?: Summary
  readonly translation?: TranslatedArticle
  readonly notes?: readonly FactCheckNote[]
  readonly imagePrompt?: string
}

const DEFAULTS = {
  stream: ['a ', 'proposed ', 'draft'],
  headlines: [{ text: 'A Proposed Headline', rationale: 'Accurate and specific.' }],
  seo: { metaTitle: 'A Title', metaDescription: 'A description.', keywords: ['news'] },
  tags: [{ label: 'budget', confidence: 0.9 }],
  categories: [{ slug: 'business', confidence: 0.8 }],
  summary: { short: 'A summary.', bullets: ['A point'] },
  translation: { locale: 'fr', title: 'Un Titre', body: 'Un corps.' },
  notes: [{ claim: 'A claim', concern: 'Unsourced', suggestedSource: 'Official release' }],
  imagePrompt: 'A wide editorial photograph.',
} as const satisfies Required<FakeAiScript>

async function* emit(parts: readonly string[]): AsyncIterable<string> {
  for (const part of parts) yield await Promise.resolve(part)
}

export interface FakeAiCall {
  readonly method: string
  readonly input: unknown
}

/**
 * Records every call, so a test can assert what the CMS asked for as well as
 * what it got back. Hand-written rather than auto-mocked: a mock configured to
 * agree with the caller proves only that it was configured.
 */
export class FakeAi implements AiPort {
  readonly calls: FakeAiCall[] = []
  private readonly script: Required<FakeAiScript>

  constructor(script: FakeAiScript = {}) {
    this.script = { ...DEFAULTS, ...script }
  }

  /** Method names in call order — the common assertion. */
  methods(): string[] {
    return this.calls.map((c) => c.method)
  }

  private record<T>(method: string, input: unknown, value: T): T {
    this.calls.push({ method, input })
    return value
  }

  draftFromPrompt(input: DraftRequest): AsyncIterable<string> {
    return this.record('draftFromPrompt', input, emit(this.script.stream))
  }

  draftFromBullets(input: BulletRequest): AsyncIterable<string> {
    return this.record('draftFromBullets', input, emit(this.script.stream))
  }

  rewrite(input: RewriteRequest): AsyncIterable<string> {
    return this.record('rewrite', input, emit(this.script.stream))
  }

  adjustTone(input: ToneRequest): AsyncIterable<string> {
    return this.record('adjustTone', input, emit(this.script.stream))
  }

  suggestHeadlines(input: ArticleContext): Promise<readonly Headline[]> {
    return Promise.resolve(this.record('suggestHeadlines', input, this.script.headlines))
  }

  suggestSeo(input: ArticleContext): Promise<SeoSuggestion> {
    return Promise.resolve(this.record('suggestSeo', input, this.script.seo))
  }

  suggestTags(input: ArticleContext): Promise<readonly TagSuggestion[]> {
    return Promise.resolve(this.record('suggestTags', input, this.script.tags))
  }

  detectCategory(input: CategoryRequest): Promise<readonly CategorySuggestion[]> {
    return Promise.resolve(this.record('detectCategory', input, this.script.categories))
  }

  summarise(input: ArticleContext): Promise<Summary> {
    return Promise.resolve(this.record('summarise', input, this.script.summary))
  }

  translate(input: TranslateRequest): Promise<TranslatedArticle> {
    const translated = { ...this.script.translation, locale: input.targetLocale }
    return Promise.resolve(this.record('translate', input, translated))
  }

  factCheck(input: ArticleContext): Promise<readonly FactCheckNote[]> {
    return Promise.resolve(this.record('factCheck', input, this.script.notes))
  }

  imagePrompt(input: ArticleContext): Promise<string> {
    return Promise.resolve(this.record('imagePrompt', input, this.script.imagePrompt))
  }
}
