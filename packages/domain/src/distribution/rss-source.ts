import type { CategoryId } from '../shared/ids'

const MAX_SEEN = 200

export interface RssSourceProps {
  readonly id: string
  readonly url: string
  readonly locale: string
  readonly categoryId: CategoryId
  readonly etag: string | null
  readonly lastFetchedAt: Date | null
  readonly seenGuids: readonly string[]
}

export class InvalidRssUrl extends Error {
  constructor(readonly value: string) {
    super('That is not an HTTPS feed URL')
    this.name = 'InvalidRssUrl'
  }
}

/**
 * An inbound syndication source. Items become drafts — never published copy.
 * The newsroom still has to approve anything that reaches readers.
 */
export class RssSource {
  private constructor(private readonly props: RssSourceProps) {}

  static reconstitute(props: RssSourceProps): RssSource {
    return new RssSource(props)
  }

  static register(input: {
    readonly id: string
    readonly url: string
    readonly locale: string
    readonly categoryId: CategoryId
  }): RssSource {
    const url = input.url.trim()
    if (!isHttpsUrl(url)) throw new InvalidRssUrl(input.url)
    if (input.locale.trim().length < 2) throw new InvalidRssUrl(input.locale)

    return new RssSource({
      id: input.id,
      url,
      locale: input.locale.trim(),
      categoryId: input.categoryId,
      etag: null,
      lastFetchedAt: null,
      seenGuids: [],
    })
  }

  get id(): string {
    return this.props.id
  }

  get url(): string {
    return this.props.url
  }

  get locale(): string {
    return this.props.locale
  }

  get categoryId(): CategoryId {
    return this.props.categoryId
  }

  get etag(): string | null {
    return this.props.etag
  }

  seen(guid: string): boolean {
    return this.props.seenGuids.includes(guid)
  }

  remember(guid: string): RssSource {
    if (this.seen(guid)) return this
    const seenGuids = [...this.props.seenGuids, guid].slice(-MAX_SEEN)
    return new RssSource({ ...this.props, seenGuids })
  }

  fetched(etag: string | null, now: Date): RssSource {
    return new RssSource({ ...this.props, etag, lastFetchedAt: now })
  }

  snapshot(): RssSourceProps {
    return this.props
  }
}

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:'
  } catch {
    return false
  }
}
