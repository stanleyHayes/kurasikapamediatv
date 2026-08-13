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
    return (
      <p className="text-on-surface-variant">
        Nothing queued. Compose a post to schedule one.
      </p>
    )
  }

  return (
    <ul className="space-y-3">
      {posts.map((post) => (
        <QueueRow key={post.id} post={post} locale={locale} />
      ))}
    </ul>
  )
}

function QueueRow({
  post,
  locale,
}: {
  post: QueuedPostView
  locale: string
}): React.ReactElement {
  return (
    <li className="border-outline-variant/50 bg-surface-container-low rounded-lg border p-4">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-label-bold text-on-surface uppercase">{post.platform}</span>

        <span
          className={`text-label-bold rounded-full border px-2 py-0.5 text-[10px] uppercase ${
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
    </li>
  )
}
