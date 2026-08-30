/**
 * Markdown ⇄ HTML serialisation for the studio's rich-text mode.
 *
 * The stored body is Markdown and stays Markdown (ArticleBody renders nothing
 * else), so the WYSIWYG surface is a translation, not a format: it shows the
 * parsed tree as HTML and serialises the edited HTML back through the same
 * tree's vocabulary. Exactly the constructs src/content/markdown.ts parses
 * cross the boundary — paragraphs, ATX headings 1–3, unordered/ordered
 * lists, `code`, **strong**, *em* and http(s) links. Anything richer that a
 * paste or the browser drags in (spans, fonts, blockquotes) is flattened to
 * the text the public renderer would have shown anyway.
 *
 * Fidelity is defined at the tree level, not the byte level. The first rich
 * edit normalises whitespace the way parseMarkdown already does — blank-line
 * runs collapse, line breaks inside a paragraph become spaces, `*` bullets
 * come back as `-`, ordered items as `1.` — and from then on the round-trip
 * is stable: markdown → HTML → markdown → HTML is a fixed point. Markdown the
 * parser does not understand (a `>` quote, `~~strike~~`, an unclosed `**`)
 * is text to it, and text crosses both directions untouched.
 */

import type { BlockNode, InlineNode } from '@kurasikapa/web-kit/content/markdown'
import { parseMarkdown } from '@kurasikapa/web-kit/content/markdown'

/**
 * Renders stored Markdown as the restricted HTML the contenteditable shows.
 * Escaped throughout — a contributed `</p><script>` stays text here exactly
 * as it does in MarkdownView.
 */
export function markdownToHtml(source: string): string {
  return parseMarkdown(source).map(blockToHtml).join('')
}

/**
 * Serialises the contenteditable's HTML back to stored Markdown. Blocks are
 * joined by a blank line, matching the delimiter parseMarkdown splits on.
 */
export function htmlToMarkdown(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const blocks: string[] = []

  for (const node of Array.from(doc.body.childNodes)) {
    const block = topLevelToMarkdown(node)
    if (block !== '') blocks.push(block)
  }

  return blocks.join('\n\n')
}

function blockToHtml(block: BlockNode): string {
  switch (block.kind) {
    case 'p':
      return `<p>${inlinesToHtml(block.children)}</p>`
    case 'h':
      // Editor-native h1–h3, one tag per level; the visual h2/h3/h4 mapping
      // is the public template's business, not the draft format's.
      return `<h${String(block.level)}>${inlinesToHtml(block.children)}</h${String(block.level)}>`
    case 'ul':
      return `<ul>${block.items.map((item) => `<li>${inlinesToHtml(item)}</li>`).join('')}</ul>`
    case 'ol':
      return `<ol>${block.items.map((item) => `<li>${inlinesToHtml(item)}</li>`).join('')}</ol>`
  }
}

function inlinesToHtml(nodes: readonly InlineNode[]): string {
  return nodes.map(inlineToHtml).join('')
}

function inlineToHtml(node: InlineNode): string {
  switch (node.kind) {
    case 'text':
      return escapeHtml(node.value)
    case 'strong':
      return `<strong>${inlinesToHtml(node.children)}</strong>`
    case 'em':
      return `<em>${inlinesToHtml(node.children)}</em>`
    case 'code':
      return `<code>${escapeHtml(node.value)}</code>`
    case 'link':
      return `<a href="${escapeHtml(node.href)}">${inlinesToHtml(node.children)}</a>`
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function topLevelToMarkdown(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return cleanText(node.nodeValue).trim()
  if (!(node instanceof HTMLElement)) return ''

  switch (node.tagName) {
    case 'H1':
      return `# ${inlinesToMarkdown(node)}`
    case 'H2':
      return `## ${inlinesToMarkdown(node)}`
    case 'H3':
      return `### ${inlinesToMarkdown(node)}`
    case 'UL':
      return listToMarkdown(node, '-')
    case 'OL':
      return listToMarkdown(node, '1.')
    case 'CODE':
      return `\`${cleanText(node.textContent)}\``
    default:
      // P, DIV (Enter in a contenteditable), BLOCKQUOTE, and anything a
      // paste smuggled in: the public renderer shows their text, so the text
      // is what we keep.
      return inlinesToMarkdown(node).trim()
  }
}

function listToMarkdown(list: HTMLElement, marker: string): string {
  return Array.from(list.children)
    .filter((item): item is HTMLElement => item instanceof HTMLElement)
    .map((item) => `${marker} ${inlinesToMarkdown(item)}`)
    .join('\n')
}

function inlinesToMarkdown(element: HTMLElement): string {
  return Array.from(element.childNodes).map(inlineToMarkdown).join('')
}

function inlineToMarkdown(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return cleanText(node.nodeValue)
  if (!(node instanceof HTMLElement)) return ''

  switch (node.tagName) {
    case 'STRONG':
    case 'B':
      return `**${inlinesToMarkdown(node)}**`
    case 'EM':
    case 'I':
      return `*${inlinesToMarkdown(node)}*`
    case 'CODE':
      return `\`${cleanText(node.textContent)}\``
    case 'BR':
      // A soft line break is a space to parseMarkdown — mirror it.
      return ' '
    case 'A':
      return anchorToMarkdown(node)
    default:
      // Spans and friends carry no meaning the format can store; their
      // text can.
      return inlinesToMarkdown(node)
  }
}

/**
 * Only an http(s) href survives, the same rule takeLink applies when
 * parsing: a `javascript:` URL was never a link in the stored format, so it
 * does not become one by passing through the rich surface.
 */
function anchorToMarkdown(anchor: HTMLElement): string {
  const label = inlinesToMarkdown(anchor)
  const href = anchor.getAttribute('href') ?? ''

  return /^https?:\/\//iu.test(href) ? `[${label}](${href})` : label
}

/** The `&nbsp;` a contenteditable scatters is a space in the stored format. */
function cleanText(value: string | null): string {
  return (value ?? '').replaceAll('\u00A0', ' ')
}
