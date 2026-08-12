import type { ArticleContext } from '@kurasikapa/application'
import { describe, expect, it } from 'vitest'
import { AnthropicAiAdapter } from './anthropic-ai-adapter'
import { singleModel } from './models'
import { drain, mockObjectModel, mockStreamModel, promptText } from './testing/mock-model'

const article: ArticleContext = {
  title: 'Budget 2026 Explained',
  body: 'The finance minister presented the 2026 budget to parliament on Tuesday.',
  locale: 'en',
}

const adapterReturning = (json: unknown): AnthropicAiAdapter =>
  new AnthropicAiAdapter(singleModel(mockObjectModel(json).model))

describe('streaming methods', () => {
  it('rewrite streams text through without a framework type', async () => {
    const { model } = mockStreamModel(['The finance ', 'minister ', 'presented…'])
    const adapter = new AnthropicAiAdapter(singleModel(model))

    const text = await drain(adapter.rewrite({ ...article, instruction: 'Tighten the lead.' }))

    expect(text).toBe('The finance minister presented…')
  })

  it('passes the editor instruction to the model', async () => {
    const { model, captured } = mockStreamModel(['ok'])
    const adapter = new AnthropicAiAdapter(singleModel(model))

    await drain(adapter.rewrite({ ...article, instruction: 'Cut the third paragraph.' }))

    expect(promptText(captured)).toContain('Cut the third paragraph.')
  })

  it('drafts from a prompt', async () => {
    const { model, captured } = mockStreamModel(['draft'])
    const adapter = new AnthropicAiAdapter(singleModel(model))

    await drain(adapter.draftFromPrompt({ prompt: 'Ghana cedi rally', locale: 'en' }))

    expect(promptText(captured)).toContain('Ghana cedi rally')
  })

  it('drafts from bullet points', async () => {
    const { model, captured } = mockStreamModel(['draft'])
    const adapter = new AnthropicAiAdapter(singleModel(model))

    await drain(adapter.draftFromBullets({ bullets: ['rate cut', 'inflation'], locale: 'fr' }))

    const sent = promptText(captured)
    expect(sent).toContain('rate cut')
    expect(sent).toContain('inflation')
  })

  it('adjusts tone', async () => {
    const { model, captured } = mockStreamModel(['calmer'])
    const adapter = new AnthropicAiAdapter(singleModel(model))

    await drain(adapter.adjustTone({ ...article, tone: 'analytical' }))

    expect(promptText(captured)).toContain('analytical')
  })
})

describe('structured methods', () => {
  it('returns headline proposals with rationales', async () => {
    const adapter = adapterReturning({
      headlines: [{ text: 'Budget 2026: What Changes', rationale: 'Concrete and accurate.' }],
    })

    const headlines = await adapter.suggestHeadlines(article)

    expect(headlines).toEqual([
      { text: 'Budget 2026: What Changes', rationale: 'Concrete and accurate.' },
    ])
  })

  it('returns SEO metadata', async () => {
    const adapter = adapterReturning({
      metaTitle: 'Budget 2026 Explained',
      metaDescription: 'What the 2026 budget changes for households.',
      keywords: ['budget', 'ghana'],
    })

    expect((await adapter.suggestSeo(article)).metaTitle).toBe('Budget 2026 Explained')
  })

  it('returns tag proposals with confidence', async () => {
    const adapter = adapterReturning({ tags: [{ label: 'budget', confidence: 0.9 }] })
    expect(await adapter.suggestTags(article)).toEqual([{ label: 'budget', confidence: 0.9 }])
  })

  it('returns a summary', async () => {
    const adapter = adapterReturning({ short: 'A budget summary.', bullets: ['Tax up'] })
    expect((await adapter.summarise(article)).bullets).toEqual(['Tax up'])
  })

  it('returns fact-check notes rather than verdicts', async () => {
    const adapter = adapterReturning({
      notes: [{ claim: 'Inflation fell 4%', concern: 'No source given', suggestedSource: 'GSS' }],
    })

    const notes = await adapter.factCheck(article)

    expect(notes[0]?.concern).toBe('No source given')
  })

  it('returns an image prompt string', async () => {
    const adapter = adapterReturning({ prompt: 'A wide shot of parliament at dusk.' })
    expect(await adapter.imagePrompt(article)).toBe('A wide shot of parliament at dusk.')
  })

  it('returns a social caption proposal', async () => {
    const adapter = adapterReturning({
      caption: 'Budget clears parliament overnight.',
      hashtags: ['budget', 'ghana'],
    })

    expect(await adapter.socialCaption({ ...article, platform: 'facebook' })).toEqual({
      caption: 'Budget clears parliament overnight.',
      hashtags: ['budget', 'ghana'],
    })
  })

  it('stamps the target locale on a translation', async () => {
    // The model returns title and body; the locale is ours to assert, not its
    // to claim — a model that echoed the wrong locale would misfile the article.
    const adapter = adapterReturning({ title: 'Le Budget 2026', body: 'Le ministre…' })

    const translated = await adapter.translate({ ...article, targetLocale: 'fr' })

    expect(translated).toEqual({ locale: 'fr', title: 'Le Budget 2026', body: 'Le ministre…' })
  })
})

describe('category detection', () => {
  const options = [
    { slug: 'business', label: 'Business' },
    { slug: 'politics', label: 'Politics' },
  ]

  it('returns categories that exist', async () => {
    const adapter = adapterReturning({ categories: [{ slug: 'business', confidence: 0.8 }] })

    const detected = await adapter.detectCategory({ ...article, options })

    expect(detected).toEqual([{ slug: 'business', confidence: 0.8 }])
  })

  it('drops a category the model invented', async () => {
    // The prompt forbids it, but a prompt is not a guarantee. An invented slug
    // would otherwise reach the CMS as a category that does not exist.
    const adapter = adapterReturning({
      categories: [
        { slug: 'business', confidence: 0.8 },
        { slug: 'cryptocurrency', confidence: 0.7 },
      ],
    })

    const detected = await adapter.detectCategory({ ...article, options })

    expect(detected.map((c) => c.slug)).toEqual(['business'])
  })

  it('sends only the real categories to the model', async () => {
    const { model, captured } = mockObjectModel({ categories: [] })
    const adapter = new AnthropicAiAdapter(singleModel(model))

    await adapter.detectCategory({ ...article, options })

    const sent = promptText(captured)
    expect(sent).toContain('business')
    expect(sent).toContain('politics')
  })
})

describe('schema validation', () => {
  it('rejects a response that does not match the schema', async () => {
    // A malformed response must fail here, not arrive in the CMS as undefined.
    const adapter = adapterReturning({ headlines: [{ text: 'Missing its rationale' }] })

    await expect(adapter.suggestHeadlines(article)).rejects.toThrow()
  })

  it('rejects a confidence outside 0..1', async () => {
    const adapter = adapterReturning({ tags: [{ label: 'budget', confidence: 4 }] })

    await expect(adapter.suggestTags(article)).rejects.toThrow()
  })
})
