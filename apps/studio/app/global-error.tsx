'use client'

import { useEffect } from 'react'
import { reportError } from '@kurasikapa/web-kit/observability/report-error'
import { ErrorRecovery } from '@/components/error-recovery'
import './globals.css'

/**
 * Replaces the root layout, so it must provide html/body itself.
 * Fonts from the locale layout are gone; tokens in globals.css still apply.
 */
export default function StudioGlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}): React.ReactElement {
  useEffect(() => {
    reportError(error)
  }, [error])

  return (
    <html lang="en">
      <body className="bg-surface text-on-surface min-h-screen">
        <ErrorRecovery digest={error.digest} onRetry={reset} />
      </body>
    </html>
  )
}
