import { describe, expect, it } from 'vitest'
import { htmlToMarkdown, markdownToHtml } from './rich-text-markdown'

/** One pass through the surface: markdown → rich HTML → markdown. */
const roundTrip = (source: string): string => htmlToMarkdown(markdownToHtml(source))

describe('markdownToHtml', () => {
  it('renders every block kind the stored format supports', () => {
    const html = markdownToHtml('# Title\n\nA paragraph.\n\n- one\n- two\n\n1. first\n2. second')

    expect(html).toBe(
      '<h1>Title</h1><p>A paragraph.</p><ul><li>one</li><li>two</li></ul><ol><li>first</li><li>second</li></ol>',
    )
  })

  it('escapes contributed markup exactly as MarkdownView does', () => {
    // The public renderer would show this as text; the surface must too.
    expect(markdownToHtml('</p><script>alert(1)</script>')).toBe(
      '<p>&lt;/p&gt;&lt;script&gt;alert(1)&lt;/script&gt;</p>',
    )
  })
})

describe('round-trip', () => {
  it('keeps paragraphs, headings and inline marks intact', () => {
    const source = '## Hearing\n\nThe **council** met *again* to review `budget-2026`.'

    expect(roundTrip(source)).toBe(source)
  })

  it('keeps all three heading levels distinct', () => {
    expect(roundTrip('# One\n\n## Two\n\n### Three')).toBe('# One\n\n## Two\n\n### Three')
  })

  it('keeps lists, unordered and ordered', () => {
    expect(roundTrip('- maize\n- cassava')).toBe('- maize\n- cassava')
    // Ordered items come back numbered from 1 — the tree stores no numbers,
    // and the parser accepts any digit run, so this is a stable form.
    expect(roundTrip('1. first\n2. second')).toBe('1. first\n1. second')
  })

  it('keeps safe links and drops unsafe ones to their label', () => {
    expect(roundTrip('Read the [full report](https://kurasikapa.example/r).')).toBe(
      'Read the [full report](https://kurasikapa.example/r).',
    )
    // takeLink never made this a link; the surface must not invent one.
    expect(roundTrip('a [trap](javascript:alert(1)) here')).toBe('a [trap](javascript:alert(1)) here')
  })

  it('passes markdown it does not understand through as text', () => {
    // None of these are in the parser's vocabulary, so all of them are text —
    // and text crosses the surface untouched.
    const source = '> A blockquote the format does not store\n\n~~struck~~ and **unclosed and ![img](x)'

    expect(roundTrip(source)).toBe(source)
  })

  it('is stable after the first pass normalises whitespace', () => {
    // parseMarkdown collapses blank-line runs and soft line breaks; the first
    // rich edit inherits that normalisation, and from then on nothing moves.
    const once = roundTrip('first line\nsecond line\n\n\n\n#   Spaced heading  ')
    const twice = roundTrip(once)

    expect(twice).toBe(once)
    expect(once).toBe('first line second line\n\n# Spaced heading')
  })
})

describe('htmlToMarkdown on browser-produced markup', () => {
  it('reads the tags execCommand and paste actually emit', () => {
    // <b>/<i> are what document.execCommand('bold'/'italic') produces in
    // several browsers; <div> is what Enter produces in a contenteditable.
    const html = '<div>A <b>bold</b> and <i>italic</i> line</div><div>Next</div>'

    expect(htmlToMarkdown(html)).toBe('A **bold** and *italic* line\n\nNext')
  })

  it('flattens markup the format cannot store to its text', () => {
    const html = '<blockquote><span style="color:red">Quoted</span></blockquote><p>After</p>'

    expect(htmlToMarkdown(html)).toBe('Quoted\n\nAfter')
  })

  it('turns soft breaks into spaces and &nbsp; into plain spaces', () => {
    expect(htmlToMarkdown('<p>one<br>two&nbsp;three</p>')).toBe('one two three')
  })

  it('serialises a pasted unsafe anchor as its label, never as a link', () => {
    expect(htmlToMarkdown('<p><a href="javascript:alert(1)">click</a></p>')).toBe('click')
  })
})
