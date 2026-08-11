'use client'

import { useState, useTransition } from 'react'
import { callAction } from '../../actions/call'
import { toggleLikeAction } from '../../actions/side-actions'

export function LikeButton({
  articleId,
  initiallyLiked,
  initialCount,
}: {
  articleId: string
  initiallyLiked: boolean
  initialCount: number
}): React.ReactElement {
  const like = useLike(articleId, initiallyLiked, initialCount)

  return (
    <div>
      <button
        type="button"
        onClick={like.toggle}
        disabled={like.pending}
        aria-pressed={like.liked}
        className="border-outline-variant text-label-bold hover:border-secondary rounded border px-3 py-1 uppercase transition-colors disabled:opacity-60"
      >
        {like.liked ? 'Liked' : 'Like'} · {String(like.count)}
      </button>
      {like.error !== null && (
        <p role="status" className="text-error mt-1 text-sm">
          {like.error}
        </p>
      )}
    </div>
  )
}

function useLike(
  articleId: string,
  initiallyLiked: boolean,
  initialCount: number,
): {
  readonly liked: boolean
  readonly count: number
  readonly error: string | null
  readonly pending: boolean
  readonly toggle: () => void
} {
  const [liked, setLiked] = useState(initiallyLiked)
  const [count, setCount] = useState(initialCount)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  return {
    liked,
    count,
    error,
    pending,
    toggle: () => {
      const was = liked
      const previous = count
      setLiked(!was)
      setCount(was ? Math.max(0, previous - 1) : previous + 1)
      setError(null)
      startTransition(async () => {
        const result = await callAction(() => toggleLikeAction({ articleId }, was))
        if (result.ok) {
          setLiked(result.data.liked)
          setCount(result.data.count)
          return
        }
        setLiked(was)
        setCount(previous)
        setError(
          result.error.code === 'not_signed_in' ? 'Sign in to like articles.' : result.error.message,
        )
      })
    },
  }
}
