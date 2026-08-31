import type { EncoderCredentials } from '@/actions/live'

export interface ActiveBroadcast {
  readonly id: string
  readonly title: string
  readonly startedAt: string
}

export function activeAfterStart(
  title: FormDataEntryValue | null,
  credentials: EncoderCredentials,
  startedAt: string,
): ActiveBroadcast {
  return {
    id: credentials.broadcastId,
    title: typeof title === 'string' ? title : '',
    startedAt,
  }
}

export function endControlLabel(pending: boolean, error: string | null): string {
  if (pending) return 'Ending…'
  return error === null ? 'End broadcast' : 'Retry channel cleanup'
}
