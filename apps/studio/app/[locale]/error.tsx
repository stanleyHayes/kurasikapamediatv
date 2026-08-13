'use client'

import { useEffect } from 'react'
import { reportError } from '@kurasikapa/web-kit/observability/report-error'
import { ErrorRecovery } from '@/components/error-recovery'

export default function StudioError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}): React.ReactElement {
  useEffect(() => {
    reportError(error)
  }, [error])

  return <ErrorRecovery digest={error.digest} onRetry={reset} />
}
