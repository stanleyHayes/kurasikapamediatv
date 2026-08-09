import { describe, expect, it } from 'vitest'
import { excerptFrom } from './excerpt'

describe('excerptFrom', () => {
  it('returns short prose untouched, with no ellipsis', () => {
    expect(excerptFrom('A short standfirst.', 100)).toBe('A short standfirst.')
  })

  it('collapses the whitespace a Markdown body carries', () => {
    // Bodies arrive with paragraph breaks. A listing is one line of prose, so
    // those breaks must not survive into the card.
    expect(excerptFrom('First para.\n\n  Second   para.', 100)).toBe('First para. Second para.')
  })

  it('cuts on a word boundary rather than mid-word', () => {
    const result = excerptFrom('The quick brown fox jumps', 12)

    expect(result).toBe('The quick…')
    expect(result).not.toContain('brow')
  })

  it('hard-cuts when there is no word boundary to respect', () => {
    // A pasted URL has no spaces. Returning the whole thing would blow the
    // card's layout, which is the one thing the limit exists to prevent.
    const url = 'https://example.com/a/very/long/path/with/no/spaces/at/all'

    expect(excerptFrom(url, 20)).toBe(`${url.slice(0, 20)}…`)
  })

  it('does not add an ellipsis when the body is exactly the limit', () => {
    expect(excerptFrom('12345', 5)).toBe('12345')
  })
})
