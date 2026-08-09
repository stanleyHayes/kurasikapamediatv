/**
 * The standfirst a listing shows under a headline.
 *
 * Articles carry no separate excerpt field, and adding one would mean asking
 * editors to write the same sentence twice. Taking the opening of the approved
 * revision is what a newsroom would do by hand, and it can never drift from
 * the published text because it IS the published text.
 *
 * Cuts on a word boundary so a listing never ends mid-word.
 */
export function excerptFrom(body: string, limit: number): string {
  const flat = body.replace(/\s+/gu, ' ').trim()
  if (flat.length <= limit) return flat

  const cut = flat.slice(0, limit)
  const lastSpace = cut.lastIndexOf(' ')

  // A body with no spaces inside the limit (a URL, say) has no word boundary
  // to respect; a hard cut beats returning the whole thing.
  return `${lastSpace > 0 ? cut.slice(0, lastSpace) : cut}\u2026`
}
