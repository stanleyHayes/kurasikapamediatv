import type { RssEntry } from '@kurasikapa/application'

/** A small RSS 2.0 / Atom subset. No extra parser dependency. */
export function parseRss(xml: string): readonly RssEntry[] {
  const blocks = [
    ...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/giu),
    ...xml.matchAll(/<entry\b[^>]*>([\s\S]*?)<\/entry>/giu),
  ]

  return blocks
    .map((match) => entryOf(match[1] ?? ''))
    .filter((row) => row.title !== '')
}

function entryOf(block: string): RssEntry {
  const title = textOf(block, 'title')
  const guid = textOf(block, 'guid') || textOf(block, 'id') || textOf(block, 'link') || title
  const body = textOf(block, 'description') || textOf(block, 'summary') || textOf(block, 'content')

  return { guid, title, body }
}

function textOf(block: string, tag: string): string {
  const tagged = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, 'iu').exec(block)
  if (tagged?.[1] !== undefined) return decode(tagged[1])

  const href = new RegExp(`<${tag}\\b[^>]*href="([^"]+)"`, 'iu').exec(block)
  return href?.[1] !== undefined ? decode(href[1]) : ''
}

function decode(raw: string): string {
  const withoutCdata = raw.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gu, '$1')
  const withoutTags = withoutCdata.replace(/<[^>]+>/gu, ' ')
  return withoutTags
    .replace(/&amp;/gu, '&')
    .replace(/&lt;/gu, '<')
    .replace(/&gt;/gu, '>')
    .replace(/&quot;/gu, '"')
    .replace(/&#39;/gu, "'")
    .replace(/\s+/gu, ' ')
    .trim()
}
