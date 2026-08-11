import { FakeAi } from '@kurasikapa/application/testing'
import { describe, expect, it } from 'vitest'
import { InvalidInput } from '../actions/schemas'
import { isStreamingTask, streamForTask } from './streaming-task'

async function drain(parts: AsyncIterable<string>): Promise<string> {
  let out = ''
  for await (const part of parts) out += part
  return out
}

describe('isStreamingTask', () => {
  it('recognises the four streaming tasks the route exposes', () => {
    expect(isStreamingTask('draft')).toBe(true)
    expect(isStreamingTask('bullets')).toBe(true)
    expect(isStreamingTask('rewrite')).toBe(true)
    expect(isStreamingTask('tone')).toBe(true)
  })

  it('rejects anything else — unknown tasks must 404, not spend tokens', () => {
    expect(isStreamingTask('headline')).toBe(false)
    expect(isStreamingTask('')).toBe(false)
  })
})

describe('streamForTask', () => {
  it('routes draft to draftFromPrompt, not rewrite', async () => {
    const ai = new FakeAi({ stream: ['draft ', 'text'] })

    const text = await drain(
      streamForTask(ai, 'draft', { prompt: 'Cedi rally', locale: 'en' }),
    )

    expect(text).toBe('draft text')
    expect(ai.methods()).toEqual(['draftFromPrompt'])
    expect(ai.calls[0]?.input).toEqual({ prompt: 'Cedi rally', locale: 'en' })
  })

  it('routes bullets to draftFromBullets', async () => {
    const ai = new FakeAi({ stream: ['from ', 'notes'] })

    await drain(
      streamForTask(ai, 'bullets', { bullets: ['rate cut', 'inflation'], locale: 'fr' }),
    )

    expect(ai.methods()).toEqual(['draftFromBullets'])
    expect(ai.calls[0]?.input).toEqual({
      bullets: ['rate cut', 'inflation'],
      locale: 'fr',
    })
  })

  it('routes rewrite with an instruction', async () => {
    const ai = new FakeAi()

    await drain(
      streamForTask(ai, 'rewrite', {
        title: 'Budget',
        body: 'The minister…',
        locale: 'en',
        instruction: 'Tighten the lede',
      }),
    )

    expect(ai.methods()).toEqual(['rewrite'])
  })

  it('routes tone to adjustTone', async () => {
    const ai = new FakeAi()

    await drain(
      streamForTask(ai, 'tone', {
        title: 'Budget',
        body: 'The minister…',
        locale: 'en',
        tone: 'formal',
      }),
    )

    expect(ai.methods()).toEqual(['adjustTone'])
  })

  it('refuses a draft body that looks like a rewrite — wrong schema, wrong spend', () => {
    const ai = new FakeAi()

    expect(() =>
      streamForTask(ai, 'draft', {
        title: 'Budget',
        body: 'The minister…',
        locale: 'en',
        instruction: 'oops',
      }),
    ).toThrow(InvalidInput)

    expect(ai.methods()).toEqual([])
  })
})
