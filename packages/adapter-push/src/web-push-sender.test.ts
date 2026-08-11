import { DeviceSubscription } from '@kurasikapa/domain'
import { generateKeyPairSync } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import { WebPushSender } from './web-push-sender'

const NOW = new Date('2026-08-11T18:00:00Z')
const device = DeviceSubscription.subscribe({
  endpoint: 'https://push.example/send/abc',
  p256dh: 'k',
  auth: 'a',
  locale: 'en',
  now: NOW,
})

const pair = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
const jwk = pair.privateKey.export({ format: 'jwk' })
const pub = Buffer.concat([
  Buffer.from([0x04]),
  Buffer.from(jwk.x ?? '', 'base64url'),
  Buffer.from(jwk.y ?? '', 'base64url'),
])
const keys = {
  publicKey: pub.toString('base64url'),
  privateKey: Buffer.from(jwk.d ?? '', 'base64url').toString('base64url'),
  subject: 'mailto:news@kurasikapa.tv',
}

describe('WebPushSender', () => {
  it('fails closed when VAPID keys are unset', async () => {
    const sender = new WebPushSender({
      publicKey: undefined,
      privateKey: undefined,
      subject: keys.subject,
      post: vi.fn(),
    })

    await expect(sender.send(device, { title: 't', body: 'b', url: '/' })).rejects.toThrow(/VAPID/u)
  })

  it('fails closed on an empty key the same as an unset one', async () => {
    const sender = new WebPushSender({
      publicKey: '',
      privateKey: keys.privateKey,
      subject: keys.subject,
      post: vi.fn(),
    })

    await expect(sender.send(device, { title: 't', body: 'b', url: '/' })).rejects.toThrow(/VAPID/u)
  })

  it('posts a signed empty-body push when keys are set', async () => {
    const post = vi.fn().mockResolvedValue(new Response('', { status: 201 }))
    const sender = new WebPushSender({ ...keys, post })

    await sender.send(device, { title: 't', body: 'b', url: '/en/articles/x' })

    expect(post).toHaveBeenCalledOnce()
    const init = post.mock.calls[0]?.[1] as RequestInit
    expect(String((init.headers as Record<string, string>)['Authorization'])).toMatch(/^vapid /u)
  })

  it('refuses a non-OK push service response', async () => {
    const post = vi.fn().mockResolvedValue(new Response('nope', { status: 400 }))
    const sender = new WebPushSender({ ...keys, post })

    await expect(sender.send(device, { title: 't', body: 'b', url: '/' })).rejects.toThrow(/400/u)
  })
})
