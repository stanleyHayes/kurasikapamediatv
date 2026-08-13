import type {
  ArticleContext,
  BulletRequest,
  CategoryRequest,
  DraftRequest,
  RewriteRequest,
  ToneRequest,
  TranslateRequest,
} from '@kurasikapa/application'

/**
 * Every system prompt carries the same standing instruction: produce a
 * proposal for an editor, never a finished publication. Kurasikapa's stated
 * values are integrity and excellence, and the newsroom — not the model — is
 * accountable for what goes out.
 */
const HOUSE = [
  'You assist journalists at Kurasikapa Media TV, a television and online news house.',
  'Your output is always a PROPOSAL for a human editor to accept, edit or discard.',
  'Never invent facts, quotes, statistics, names or sources.',
  'If the source text does not support a claim, say so rather than filling the gap.',
  'Match the register of serious broadsheet journalism: clear, specific, unhurried.',
].join(' ')

export const SYSTEM = {
  draft: `${HOUSE} Draft in the requested language. Mark anything you could not verify with [UNVERIFIED].`,
  rewrite: `${HOUSE} Preserve every fact and quote exactly. Change only what the instruction asks for.`,
  tone: `${HOUSE} Change register only. Facts, quotes, structure and length stay as they are.`,
  headline: `${HOUSE} Headlines must be accurate before they are compelling. Never overstate what the article supports.`,
  seo: `${HOUSE} Write metadata that describes the article honestly. Clickbait is a brand liability.`,
  classify: `${HOUSE} Choose only from the options given. Never invent a category or tag.`,
  summarise: `${HOUSE} Summarise only what the article states.`,
  translate: `${HOUSE} Translate faithfully. Keep proper nouns, quotes and numbers exact. Localise idiom, never meaning.`,
  factcheck: `${HOUSE} Identify claims that need a second source. Flag concerns; do not assert what is true.`,
  grammar: `${HOUSE} Flag grammar, spelling and punctuation only. Quote the exact words at fault and propose a fix for each. Never change meaning, register or facts.`,
  image: `${HOUSE} Describe a photograph or illustration that could accompany the article without depicting real identifiable people or fabricated events.`,
  social: `${HOUSE} Write a social post for the named platform. Stay faithful to the article. Hashtags must be topics the article actually covers.`,
} as const

const context = (input: ArticleContext): string =>
  `Locale: ${input.locale}\n\nTitle: ${input.title}\n\nBody:\n${input.body}`

export const PROMPT = {
  draft: (i: DraftRequest): string => `Write a news article in locale ${i.locale}.\n\nBrief:\n${i.prompt}`,

  bullets: (i: BulletRequest): string =>
    `Write a news article in locale ${i.locale} from these points.\n\n${i.bullets.map((b) => `- ${b}`).join('\n')}`,

  rewrite: (i: RewriteRequest): string => `${context(i)}\n\nInstruction: ${i.instruction}`,

  tone: (i: ToneRequest): string => `${context(i)}\n\nRewrite in a ${i.tone} tone.`,

  headline: (i: ArticleContext): string =>
    `${context(i)}\n\nPropose 5 headlines. For each, give a one-line rationale.`,

  seo: (i: ArticleContext): string => `${context(i)}\n\nPropose SEO metadata.`,

  tags: (i: ArticleContext): string =>
    `${context(i)}\n\nPropose up to 8 topic tags with a confidence between 0 and 1.`,

  category: (i: CategoryRequest): string =>
    `${context(i)}\n\nPick the best-fitting categories from this list only:\n${i.options
      .map((o) => `- ${o.slug}: ${o.label}`)
      .join('\n')}`,

  summarise: (i: ArticleContext): string =>
    `${context(i)}\n\nWrite a short summary and up to 5 bullet points.`,

  translate: (i: TranslateRequest): string =>
    `${context(i)}\n\nTranslate the title and body into locale ${i.targetLocale}.`,

  factcheck: (i: ArticleContext): string =>
    `${context(i)}\n\nList claims that a second source should confirm before publication.`,

  grammar: (i: ArticleContext): string =>
    `${context(i)}\n\nList grammar, spelling and punctuation issues in the body. For each, quote the exact excerpt and give a fix. Return an empty list when the text is clean.`,

  image: (i: ArticleContext): string =>
    `${context(i)}\n\nWrite one image-generation prompt for a featured image.`,

  social: (i: ArticleContext & { platform: string }): string =>
    `${context(i)}\n\nPropose a ${i.platform} caption and up to 5 hashtags (labels only, no #).`,
} as const
