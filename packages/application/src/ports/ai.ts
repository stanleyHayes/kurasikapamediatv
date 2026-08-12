/**
 * The AI port.
 *
 * Every method returns a **proposal**. Nothing here returns an Article, a
 * Revision, or anything the system could persist without an editor accepting
 * it first. That is a product rule, not a style preference: for a media house
 * whose stated values are integrity and excellence, auto-publishing generated
 * text is an existential risk. The type system is where we make it impossible
 * to do by accident.
 *
 * Streaming methods return `AsyncIterable<string>` rather than a framework
 * stream type, so neither Next.js nor the Go service leaks inward.
 */

export interface Headline {
  readonly text: string
  /** Why the model proposed it — editors reject faster when they can see the reasoning. */
  readonly rationale: string
}

export interface SeoSuggestion {
  readonly metaTitle: string
  readonly metaDescription: string
  readonly keywords: readonly string[]
}

export interface TagSuggestion {
  readonly label: string
  readonly confidence: number
}

export interface CategorySuggestion {
  readonly slug: string
  readonly confidence: number
}

export interface Summary {
  readonly short: string
  readonly bullets: readonly string[]
}

export interface FactCheckNote {
  readonly claim: string
  readonly concern: string
  readonly suggestedSource: string
}

export interface SocialCaption {
  readonly caption: string
  /** Topic tags without the leading # — the UI formats them for the platform. */
  readonly hashtags: readonly string[]
}

export interface CaptionRequest extends ArticleContext {
  readonly platform: 'facebook' | 'instagram'
}

export interface TranslatedArticle {
  readonly locale: string
  readonly title: string
  readonly body: string
}

export interface ArticleContext {
  readonly title: string
  readonly body: string
  readonly locale: string
}

export interface DraftRequest {
  readonly prompt: string
  readonly locale: string
}

export interface BulletRequest {
  readonly bullets: readonly string[]
  readonly locale: string
}

export interface RewriteRequest extends ArticleContext {
  readonly instruction: string
}

export type Tone = 'neutral' | 'formal' | 'conversational' | 'urgent' | 'analytical'

export interface ToneRequest extends ArticleContext {
  readonly tone: Tone
}

export interface TranslateRequest extends ArticleContext {
  readonly targetLocale: string
}

export interface CategoryOption {
  readonly slug: string
  readonly label: string
}

export interface CategoryRequest extends ArticleContext {
  /** The site's real categories. The model picks from these, never invents one. */
  readonly options: readonly CategoryOption[]
}

export interface AiPort {
  draftFromPrompt(input: DraftRequest): AsyncIterable<string>
  draftFromBullets(input: BulletRequest): AsyncIterable<string>
  rewrite(input: RewriteRequest): AsyncIterable<string>
  adjustTone(input: ToneRequest): AsyncIterable<string>

  suggestHeadlines(input: ArticleContext): Promise<readonly Headline[]>
  suggestSeo(input: ArticleContext): Promise<SeoSuggestion>
  suggestTags(input: ArticleContext): Promise<readonly TagSuggestion[]>
  detectCategory(input: CategoryRequest): Promise<readonly CategorySuggestion[]>
  summarise(input: ArticleContext): Promise<Summary>
  translate(input: TranslateRequest): Promise<TranslatedArticle>
  factCheck(input: ArticleContext): Promise<readonly FactCheckNote[]>
  imagePrompt(input: ArticleContext): Promise<string>
  socialCaption(input: CaptionRequest): Promise<SocialCaption>
}
