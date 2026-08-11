import { requireActor } from '@/composition/actor'
import { container } from '@/composition/container'
import { isStreamingTask, streamForTask } from '@/ai/streaming-task'
import { InvalidInput } from '@/actions/schemas'
import { callerKey, limit } from '@/security/rate-limit'

/**
 * Streaming AI assists.
 *
 * A route handler rather than a Server Action because the editor needs tokens
 * as they arrive — watching a draft appear is the difference between the
 * feature feeling instant and feeling broken.
 *
 * The port yields `AsyncIterable<string>`; converting it to a web stream is the
 * adapter work that belongs exactly here, at the edge of the hexagon.
 *
 * Task → method dispatch lives in `streaming-task.ts` so it can be unit-tested
 * without auth. This file owns only the HTTP concerns.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ task: string }> },
): Promise<Response> {
  const { task } = await params
  if (!isStreamingTask(task)) return new Response('Unknown task', { status: 404 })

  // AI tokens cost money. An unauthenticated caller must not be able to spend
  // them, and this endpoint is reachable without a form.
  const actor = await requireActor()

  // Signed in is not the same as unlimited. A compromised editor account, or
  // an honest script in a loop, spends real money — and this endpoint streams,
  // so a caller can hold many open at once.
  //
  // Fails CLOSED: if the counter is unreachable we cannot count, and an
  // uncounted AI endpoint is an unbounded bill. A refusal is recoverable.
  const verdict = await limit(container().rateLimiter, await callerKey(actor.id), 'ai', 'closed')
  if (!verdict.allowed) {
    return new Response('Too many requests', {
      status: 429,
      headers: { 'Retry-After': String(verdict.retryAfterSeconds) },
    })
  }

  let stream: AsyncIterable<string>
  try {
    stream = streamForTask(container().ai, task, await request.json())
  } catch (error) {
    // Bad input is a client mistake, not a server fault — and must not look
    // like a model failure, or editors will retry a request that can never work.
    if (error instanceof InvalidInput) {
      return new Response(error.message, { status: 400 })
    }
    throw error
  }

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
