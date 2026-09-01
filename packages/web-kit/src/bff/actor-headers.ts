const USER_HEADER = 'X-Kurasikapa-User'

/**
 * Assertions accepted by the Go service are server-to-server credentials.
 * The browser session proves the actor to Next; this bearer proves Next to Go.
 */
export function actorHeaders(
  userId: string,
  additional: Readonly<Record<string, string>> = {},
): Record<string, string> {
  const secret = process.env['CRON_SECRET']
  if (secret !== undefined && secret.length < 32) {
    throw new Error('CRON_SECRET must contain at least 32 characters')
  }
  return {
    ...additional,
    [USER_HEADER]: userId,
    ...(secret === undefined ? {} : { Authorization: `Bearer ${secret}` }),
  }
}
