import { createPrivateKey, sign } from 'node:crypto'

export interface VapidKeys {
  readonly publicKey: string
  readonly privateKey: string
  readonly subject: string
}

/**
 * VAPID Authorization header (RFC 8292) for an empty-body Web Push.
 *
 * Payload encryption is a later door. An empty POST still wakes the service
 * worker when the VAPID signature is accepted — enough for breaking alerts
 * until aes128gcm lands.
 */
export function vapidHeader(endpoint: string, keys: VapidKeys, now: Date): string {
  const audience = new URL(endpoint).origin
  const exp = Math.floor(now.getTime() / 1000) + 12 * 3600
  const unsigned = `${b64url({ typ: 'JWT', alg: 'ES256' })}.${b64url({
    aud: audience,
    exp,
    sub: keys.subject,
  })}`
  const sig = sign('SHA256', Buffer.from(unsigned), {
    key: privateKeyOf(keys),
    dsaEncoding: 'ieee-p1363',
  })

  return `vapid t=${unsigned}.${sig.toString('base64url')}, k=${keys.publicKey}`
}

function privateKeyOf(keys: VapidKeys): ReturnType<typeof createPrivateKey> {
  const pub = Buffer.from(keys.publicKey, 'base64url')
  const d = Buffer.from(keys.privateKey, 'base64url')
  return createPrivateKey({
    key: {
      kty: 'EC',
      crv: 'P-256',
      d: d.toString('base64url'),
      x: pub.subarray(1, 33).toString('base64url'),
      y: pub.subarray(33, 65).toString('base64url'),
    },
    format: 'jwk',
  })
}

function b64url(value: object): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url')
}
