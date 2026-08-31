export interface SitePageEntry {
  readonly id: string
  readonly title: string
  readonly summary: string
  readonly body: string
}

interface EntryDocument {
  readonly version: 1
  readonly entries: readonly SitePageEntry[]
}

export function encodeSitePageEntries(entries: readonly SitePageEntry[]): string {
  return JSON.stringify({ version: 1, entries } satisfies EntryDocument)
}

export function decodeSitePageEntries(source: string): readonly SitePageEntry[] {
  try {
    const parsed: unknown = JSON.parse(source)
    if (!isDocument(parsed)) return []
    return parsed.entries
  } catch {
    return []
  }
}

function isDocument(value: unknown): value is EntryDocument {
  if (!isRecord(value) || value['version'] !== 1 || !Array.isArray(value['entries'])) return false
  return value['entries'].every(isEntry)
}

function isEntry(value: unknown): value is SitePageEntry {
  return isRecord(value)
    && nonEmpty(value['id'])
    && nonEmpty(value['title'])
    && typeof value['summary'] === 'string'
    && nonEmpty(value['body'])
}

function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== ''
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
