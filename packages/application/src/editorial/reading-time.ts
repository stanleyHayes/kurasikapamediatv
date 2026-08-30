/** A conservative newsroom estimate at 200 words per minute. */
export function readingTimeMinutes(body: string): number {
  const words = body.trim() === '' ? 0 : body.trim().split(/\s+/u).length
  return Math.max(1, Math.ceil(words / 200))
}
