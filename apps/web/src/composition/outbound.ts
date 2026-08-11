import { ResendMailer } from '@kurasikapa/adapter-email'
import { WebPushSender } from '@kurasikapa/adapter-push'
import { MetaSocialPublisher } from '@kurasikapa/adapter-social'

/**
 * Vendor adapters that fail closed when credentials are unset.
 *
 * Kept out of `container.ts` so the composition root stays a wiring list,
 * not a catalogue of provider constructors.
 */
export function metaSocial(): MetaSocialPublisher {
  return new MetaSocialPublisher({
    pageAccessToken: present(process.env['META_PAGE_ACCESS_TOKEN']),
    pageId: present(process.env['META_PAGE_ID']),
    igUserId: present(process.env['META_IG_USER_ID']),
    post: globalThis.fetch.bind(globalThis),
  })
}

export function failClosedSocial(): MetaSocialPublisher {
  return new MetaSocialPublisher({
    pageAccessToken: undefined,
    pageId: undefined,
    igUserId: undefined,
    post: globalThis.fetch.bind(globalThis),
  })
}

export function resendMailer(): ResendMailer {
  return new ResendMailer({
    apiKey: present(process.env['RESEND_API_KEY']),
    from: 'Kurasikapa Media <news@kurasikapa.tv>',
    post: globalThis.fetch.bind(globalThis),
  })
}

export function failClosedEmail(): ResendMailer {
  return new ResendMailer({
    apiKey: undefined,
    from: 'Kurasikapa Media <news@kurasikapa.tv>',
    post: globalThis.fetch.bind(globalThis),
  })
}

export function webPush(): WebPushSender {
  return new WebPushSender({
    publicKey: present(process.env['VAPID_PUBLIC_KEY']),
    privateKey: present(process.env['VAPID_PRIVATE_KEY']),
    subject: 'mailto:news@kurasikapa.tv',
    post: globalThis.fetch.bind(globalThis),
  })
}

export function failClosedPush(): WebPushSender {
  return new WebPushSender({
    publicKey: undefined,
    privateKey: undefined,
    subject: 'mailto:news@kurasikapa.tv',
    post: globalThis.fetch.bind(globalThis),
  })
}

export function vapidPublicKey(): string | undefined {
  return present(process.env['VAPID_PUBLIC_KEY'])
}

function present(value: string | undefined): string | undefined {
  return value !== undefined && value !== '' ? value : undefined
}
