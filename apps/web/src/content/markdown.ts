/**
 * A deliberately small Markdown subset, rendered as React children.
 *
 * Stored bodies are Markdown text, never HTML. Parsing into a tree and
 * emitting elements means a contributed `</p><script>` stays text. There is
 * no sanitiser dependency because nothing is ever interpreted as markup.
 *
 * Supported: paragraphs, ATX headings 1–3, unordered/ordered lists,
 * `code`, **strong**, *em*, and http(s) links. Everything else is text.
 */

export type InlineNode =
  | { readonly kind: 'text'; readonly value: string }
  | { readonly kind: 'strong'; readonly children: readonly InlineNode[] }
  | { readonly kind: 'em'; readonly children: readonly InlineNode[] }
  | { readonly kind: 'code'; readonly value: string }
  | { readonly kind: 'link'; readonly href: string; readonly children: readonly InlineNode[] }

export type BlockNode =
  | { readonly kind: 'p'; readonly children: readonly InlineNode[] }
  | { readonly kind: 'h'; readonly level: 1 | 2 | 3; readonly children: readonly InlineNode[] }
  | { readonly kind: 'ul'; readonly items: readonly (readonly InlineNode[])[] }
  | { readonly kind: 'ol'; readonly items: readonly (readonly InlineNode[])[] }

export function parseMarkdown(source: string): readonly BlockNode[] {
  return source
    .split(/\n\s*\n/u)
    .map((block) => block.trim())
    .filter((block) => block !== '')
    .map(parseBlock)
}

function parseBlock(block: string): BlockNode {
  const heading = asHeading(block)
  if (heading !== null) return heading

  const bullets = asList(block, /^[-*]\s+/u)
  if (bullets !== null) return { kind: 'ul', items: bullets }

  const numbered = asList(block, /^\d+\.\s+/u)
  if (numbered !== null) return { kind: 'ol', items: numbered }

  return { kind: 'p', children: parseInline(block.replace(/\n/gu, ' ')) }
}

function asHeading(block: string): BlockNode | null {
  const match = /^(#{1,3})\s+(.+)$/u.exec(block)
  if (match === null) return null

  const marks = match[1] ?? ''
  const text = match[2] ?? ''
  const level = marks.length as 1 | 2 | 3

  return { kind: 'h', level, children: parseInline(text) }
}

function asList(block: string, marker: RegExp): readonly (readonly InlineNode[])[] | null {
  const lines = block.split('\n')
  if (lines.length === 0 || lines.some((line) => !marker.test(line))) return null

  return lines.map((line) => parseInline(line.replace(marker, '')))
}

export function parseInline(source: string): readonly InlineNode[] {
  const nodes: InlineNode[] = []
  let rest = source

  while (rest !== '') {
    const next = takeInline(rest)
    nodes.push(next.node)
    rest = next.rest
  }

  return nodes
}

function takeInline(source: string): { node: InlineNode; rest: string } {
  const code = takeDelimited(source, '`', '`')
  if (code !== null) return { node: { kind: 'code', value: code.inner }, rest: code.rest }

  const strong = takeWrapped(source, '**')
  if (strong !== null) return { node: { kind: 'strong', children: parseInline(strong.inner) }, rest: strong.rest }

  const em = takeWrapped(source, '*')
  if (em !== null) return { node: { kind: 'em', children: parseInline(em.inner) }, rest: em.rest }

  const link = takeLink(source)
  if (link !== null) return link

  return takeText(source)
}

function takeWrapped(
  source: string,
  mark: string,
): { inner: string; rest: string } | null {
  if (!source.startsWith(mark)) return null

  const close = source.indexOf(mark, mark.length)
  if (close < mark.length + 1) return null

  return {
    inner: source.slice(mark.length, close),
    rest: source.slice(close + mark.length),
  }
}

function takeDelimited(
  source: string,
  open: string,
  close: string,
): { inner: string; rest: string } | null {
  if (!source.startsWith(open)) return null

  const end = source.indexOf(close, open.length)
  if (end < open.length) return null

  return {
    inner: source.slice(open.length, end),
    rest: source.slice(end + close.length),
  }
}

function takeLink(source: string): { node: InlineNode; rest: string } | null {
  const match = /^\[([^\]]+)\]\(([^)]+)\)/u.exec(source)
  if (match === null) return null

  const label = match[1] ?? ''
  const href = match[2] ?? ''
  const rest = source.slice(match[0].length)

  if (!isSafeHref(href)) {
    return { node: { kind: 'text', value: match[0] }, rest }
  }

  return { node: { kind: 'link', href, children: parseInline(label) }, rest }
}

function isSafeHref(href: string): boolean {
  return /^https?:\/\//iu.test(href)
}

function takeText(source: string): { node: InlineNode; rest: string } {
  const special = source.search(/[`*[]/u)
  if (special === -1) {
    return { node: { kind: 'text', value: source }, rest: '' }
  }

  if (special === 0) {
    return { node: { kind: 'text', value: source[0] ?? '' }, rest: source.slice(1) }
  }

  return { node: { kind: 'text', value: source.slice(0, special) }, rest: source.slice(special) }
}
