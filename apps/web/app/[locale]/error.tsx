'use client'

import { useEffect } from 'react'
import { ErrorPanel } from '@/components/error-panel'
import { reportError } from '@kurasikapa/web-kit/observability/report-error'

export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}): React.ReactElement {
  useEffect(() => {
    reportError(error)
  }, [error])

  return <ErrorPanel digest={error.digest} onRetry={reset} />
}
