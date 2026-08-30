'use client'

import { useState } from 'react'

/**
 * Share, degrading in the order the platform allows.
 *
 * The Web Share API opens the native sheet where it exists (every mobile
 * browser the questionnaire's audience uses); desktop falls back to copying
 * the URL and saying so. Both are real actions — nothing here is decorative.
 */
export function ShareButton({ title }: { title: string }): React.ReactElement {
  const [copied, setCopied] = useState(false)

  const share = async (): Promise<void> => {
    const url = window.location.href

    if (typeof navigator.share === 'function') {
      // A dismissed share sheet rejects; that is a cancellation, not a fault.
      await navigator.share({ title, url }).catch(() => undefined)
      return
    }

    await navigator.clipboard.writeText(url)
    setCopied(true)
  }

  return (
    <button
      type="button"
      onClick={() => void share()}
      className="min-w-32 border border-outline-variant border-l-4 border-l-on-surface bg-surface-container-lowest px-4 py-3 text-left text-sm font-bold text-on-surface transition-colors hover:bg-on-surface hover:text-surface"
      aria-label={copied ? 'Link copied' : 'Share this article'}
    >
      <span aria-hidden className="mr-2">{copied ? '✓' : '↗'}</span>{copied ? 'Link copied' : 'Share story'}
    </button>
  )
}
