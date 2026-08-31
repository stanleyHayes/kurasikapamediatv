import { CollectionView } from './collection-view'

export interface QueuedPostView {
  readonly id: string
  readonly platform: string
  readonly caption: string
  readonly scheduledAt: string
  readonly state: string
  readonly attempts: number
  readonly lastError: string | null
}

const STATE_STYLES: Readonly<Record<string, string>> = {
  queued: 'border-outline-variant text-on-surface-variant',
  sent: 'border-secondary text-secondary',
  failed: 'border-error text-error',
}

/**
 * The queue, carrying the fields the design's calendar cells carry.
 *
 * `lastError` and `attempts` are shown rather than hidden. A post that has
 * failed four times is on its last attempt before the domain abandons it, and
 * an editor who cannot see that will not know to rewrite the caption or
 * re-authorise the account until the post silently stops existing.
 */
export function SocialQueue({
  posts,
  locale,
}: {
  posts: readonly QueuedPostView[]
  locale: string
}): React.ReactElement {
  if (posts.length === 0) {
    return <StudioEmptyState eyebrow="Distribution clear" icon="social" title="Nothing is scheduled." description="Choose a published article in the composer to prepare its next Facebook or Instagram post. Every caption stays a proposal until you queue it." compact />
  }

  return <CollectionView noun="posts" filters={[...new Set(posts.map((post) => post.state))]} entries={posts.map((post) => ({ id: post.id, search: `${post.caption} ${post.platform} ${post.state}`, filter: post.state, content: <QueueRow post={post} locale={locale} /> }))} />
}

function QueueRow({
  post,
  locale,
}: {
  post: QueuedPostView
  locale: string
}): React.ReactElement {
  return (
    <div className="border-b border-outline-variant bg-surface-container-lowest p-5">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-label-bold text-on-surface uppercase">{post.platform}</span>

        <span
          className={`text-label-bold border px-2 py-0.5 text-[10px] uppercase ${
            STATE_STYLES[post.state] ?? STATE_STYLES['queued'] ?? ''
          }`}
        >
          {post.state}
        </span>

        <time dateTime={post.scheduledAt} className="text-on-surface-variant text-sm">
          {new Intl.DateTimeFormat(locale, {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'UTC',
          }).format(new Date(post.scheduledAt))}
        </time>

        {post.attempts > 0 && (
          <span className="text-on-surface-variant text-label-bold text-[10px] uppercase">
            {post.attempts} of 5 attempts
          </span>
        )}
      </div>

      <p className="text-on-surface line-clamp-2 text-sm">{post.caption}</p>

      {post.lastError !== null && <p className="text-error mt-2 text-sm">{post.lastError}</p>}
    </div>
  )
}
import { StudioEmptyState } from './empty-state'
