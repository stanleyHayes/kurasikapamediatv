import { requireActor } from '@/composition/actor'
import { container } from '@/composition/container'
import { parseInput, rewriteSchema } from '@/actions/schemas'

const STREAMING_TASKS = ['rewrite', 'tone', 'draft'] as const
type StreamingTask = (typeof STREAMING_TASKS)[number]

const isStreamingTask = (value: string): value is StreamingTask =>
  (STREAMING_TASKS as readonly string[]).includes(value)

/**
 * Streaming AI assists.
 *
 * A route handler rather than a Server Action because the editor needs tokens
 * as they arrive — watching a rewrite appear is the difference between the
 * feature feeling instant and feeling broken.
 *
 * The port yields `AsyncIterable<string>`; converting it to a web stream is the
 * adapter work that belongs exactly here, at the edge of the hexagon.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ task: string }> },
): Promise<Response> {
  const { task } = await params
  if (!isStreamingTask(task)) return new Response('Unknown task', { status: 404 })

  // AI tokens cost money. An unauthenticated caller must not be able to spend
  // them, and this endpoint is reachable without a form.
  await requireActor()

  const input = parseInput(rewriteSchema, await request.json())
  const stream = container().ai.rewrite(input)

  return new Response(toWebStream(stream), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      // Proxies that buffer would defeat the point of streaming.
      'Cache-Control': 'no-store',
      'X-Accel-Buffering': 'no',
    },
  })
}

function toWebStream(parts: AsyncIterable<string>): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()

  return new ReadableStream({
    async start(controller) {
      try {
        for await (const part of parts) controller.enqueue(encoder.encode(part))
        controller.close()
      } catch (error) {
        controller.error(error)
      }
    },
  })
}
