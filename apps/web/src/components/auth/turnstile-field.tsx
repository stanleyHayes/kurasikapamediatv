'use client'

import { useEffect, useRef } from 'react'

declare global {
  interface Window {
    turnstile?: {
      render: (
        el: HTMLElement,
        opts: { sitekey: string; callback: (token: string) => void },
      ) => string
    }
  }
}

/**
 * Cloudflare Turnstile widget. The token is posted as `x-captcha-response`
 * on the Better Auth request — the plugin reads that header, not a form field.
 */
export function TurnstileField({
  siteKey,
  onToken,
}: {
  siteKey: string
  onToken: (token: string) => void
}): React.ReactElement {
  const host = useRef<HTMLDivElement>(null)
  const onTokenRef = useRef(onToken)
  onTokenRef.current = onToken

  useEffect(() => {
    const script = document.createElement('script')
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
    script.async = true
    script.onload = () => {
      if (host.current === null || window.turnstile === undefined) return
      window.turnstile.render(host.current, {
        sitekey: siteKey,
        callback: (token) => {
          onTokenRef.current(token)
        },
      })
    }
    document.head.appendChild(script)

    return () => {
      script.remove()
    }
  }, [siteKey])

  return <div ref={host} className="mt-2" />
}
