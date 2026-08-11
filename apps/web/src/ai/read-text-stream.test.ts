import { describe, expect, it, vi } from 'vitest'
import { readTextStream } from './read-text-stream'

function streamOf(parts: readonly string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  let i = 0

  return new ReadableStream({
    pull(controller) {
      if (i >= parts.length) {
        controller.close()
        return
      }

      controller.enqueue(encoder.encode(parts[i]))
      i += 1
    },
  })
}

describe('readTextStream', () => {
  it('concatenates chunks and reports each one', async () => {
    const seen: string[] = []

    const text = await readTextStream(streamOf(['Hel', 'lo ', 'world']), (chunk) => {
      seen.push(chunk)
    })

    expect(text).toBe('Hello world')
    expect(seen).toEqual(['Hel', 'lo ', 'world'])
  })

  it('returns empty when the body has nothing — a silent model is still a proposal', async () => {
    const onChunk = vi.fn()

    const text = await readTextStream(streamOf([]), onChunk)

    expect(text).toBe('')
    expect(onChunk).not.toHaveBeenCalled()
  })
})
