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
      className="border-outline-variant text-on-surface-variant hover:border-secondary hover:text-secondary flex h-10 w-10 items-center justify-center rounded-full border transition-colors"
      aria-label={copied ? 'Link copied' : 'Share this article'}
    >
      <span aria-hidden>{copied ? '✓' : '↗'}</span>
    </button>
  )
}
