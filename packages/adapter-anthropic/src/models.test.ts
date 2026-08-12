import { describe, expect, it } from 'vitest'
import { MODELS, anthropicModels, singleModel } from './models'
import { SYSTEM } from './prompts'
import { mockObjectModel } from './testing/mock-model'

const idOf = (model: ReturnType<ReturnType<typeof anthropicModels>['for']>): string =>
  typeof model === 'string' ? model : model.modelId

describe('model routing', () => {
  const models = anthropicModels()

  it('sends fact-checking to the strongest model', () => {
    // A missed fact-check is a correction, not an annoyance.
    expect(idOf(models.for('factcheck'))).toBe(MODELS.best)
  })

  it('sends editor-facing writing to the balanced model', () => {
    expect(idOf(models.for('rewrite'))).toBe(MODELS.balanced)
    expect(idOf(models.for('headline'))).toBe(MODELS.balanced)
    expect(idOf(models.for('translate'))).toBe(MODELS.balanced)
  })

  it('sends mechanical work to the cheap model', () => {
    // Auto-tagging every wire story on a frontier model is how AI quietly
    // becomes the largest line item on the platform.
    expect(idOf(models.for('classify'))).toBe(MODELS.cheap)
    expect(idOf(models.for('seo'))).toBe(MODELS.cheap)
    expect(idOf(models.for('summarise'))).toBe(MODELS.cheap)
    expect(idOf(models.for('social'))).toBe(MODELS.cheap)
  })

  it('honours a per-task override, so cost can be tuned without a deploy', () => {
    const tuned = anthropicModels({ classify: MODELS.balanced })
    expect(idOf(tuned.for('classify'))).toBe(MODELS.balanced)
    expect(idOf(tuned.for('seo'))).toBe(MODELS.cheap)
  })
})

describe('singleModel', () => {
  it('routes every task to the one model', () => {
    const { model } = mockObjectModel({})
    const resolver = singleModel(model)

    expect(resolver.for('draft')).toBe(model)
    expect(resolver.for('factcheck')).toBe(model)
  })
})

describe('house rules in every system prompt', () => {
  const prompts = Object.values(SYSTEM)

  it('always states the output is a proposal for a human editor', () => {
    // This is the product rule from ADR-0005, not a stylistic preference.
    for (const prompt of prompts) {
      expect(prompt).toContain('PROPOSAL for a human editor')
    }
  })

  it('always forbids inventing facts, quotes and sources', () => {
    for (const prompt of prompts) {
      expect(prompt).toContain('Never invent facts, quotes, statistics, names or sources.')
    }
  })

  it('tells the rewrite path to preserve facts and quotes exactly', () => {
    expect(SYSTEM.rewrite).toContain('Preserve every fact and quote exactly')
  })

  it('tells the fact-check path to flag concerns rather than assert truth', () => {
    expect(SYSTEM.factcheck).toContain('do not assert what is true')
  })

  it('forbids depicting real identifiable people in generated imagery', () => {
    expect(SYSTEM.image).toContain('without depicting real identifiable people')
  })
})
