import { describe, expect, it, vi } from 'vitest'
import { ResendMailer } from './resend-mailer'

const message = { to: 'a@b.co', subject: 'Confirm', text: 'Click' }

describe('ResendMailer', () => {
  it('fails closed when the API key is unset', async () => {
    const mailer = new ResendMailer({
      apiKey: undefined,
      from: 'news@kurasikapa.tv',
      post: vi.fn(),
    })

    await expect(mailer.send(message)).rejects.toThrow(/RESEND_API_KEY/u)
  })

  it('posts a transactional message', async () => {
    const post = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }))
    const mailer = new ResendMailer({
      apiKey: 're_test',
      from: 'news@kurasikapa.tv',
      post,
    })

    await mailer.send(message)

    expect(post).toHaveBeenCalledOnce()
  })

  it('fails closed on an empty key the same as an unset one', async () => {
    const mailer = new ResendMailer({
      apiKey: '',
      from: 'news@kurasikapa.tv',
      post: vi.fn(),
    })

    await expect(mailer.send(message)).rejects.toThrow(/RESEND_API_KEY/u)
  })

  it('refuses a non-OK Resend response', async () => {
    const post = vi.fn().mockResolvedValue(new Response('nope', { status: 401 }))
    const mailer = new ResendMailer({
      apiKey: 're_test',
      from: 'news@kurasikapa.tv',
      post,
    })

    await expect(mailer.send(message)).rejects.toThrow(/401/u)
  })

  it('sends a batch in order', async () => {
    const post = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }))
    const mailer = new ResendMailer({
      apiKey: 're_test',
      from: 'news@kurasikapa.tv',
      post,
    })

    await mailer.sendBatch([message, { ...message, to: 'c@d.co' }])

    expect(post).toHaveBeenCalledTimes(2)
  })
})
