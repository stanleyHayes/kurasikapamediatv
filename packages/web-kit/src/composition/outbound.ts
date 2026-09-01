import { ResendMailer } from '@kurasikapa/adapter-email'
import { WebPushSender } from '@kurasikapa/adapter-push'
import { RssFetcher } from '@kurasikapa/adapter-rss'
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
    from: emailFromAddress(),
    post: globalThis.fetch.bind(globalThis),
  })
}

export function failClosedEmail(): ResendMailer {
  return new ResendMailer({
    apiKey: undefined,
    from: emailFromAddress(),
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

/** Newsroom inbox for the contact form. Override via CONTACT_TO_EMAIL. */
export function newsroomAddress(): string {
  return present(process.env['CONTACT_TO_EMAIL']) ?? 'kurasikapamediatv@yahoo.com'
}

/** Verified Resend sender identity. The legacy brand address remains the default. */
export function emailFromAddress(): string {
  return present(process.env['EMAIL_FROM']) ?? 'Kurasikapa Media <news@kurasikapa.tv>'
}

export function rssFetcher(): RssFetcher {
  return new RssFetcher({ get: globalThis.fetch.bind(globalThis) })
}

function present(value: string | undefined): string | undefined {
  return value !== undefined && value !== '' ? value : undefined
}
