'use client'

import { useState, useTransition } from 'react'
import { subscribePushAction } from '../actions/push'
import { callAction } from '@kurasikapa/web-kit/actions/call'
import { shouldRegisterServiceWorker } from './offline-policy'

export function PushOptIn({
  locale,
  vapidPublicKey,
}: {
  locale: string
  vapidPublicKey: string | undefined
}): React.ReactElement | null {
  const [pending, start] = useTransition()
  const [note, setNote] = useState<string | null>(null)

  if (vapidPublicKey === undefined || vapidPublicKey === '') return null
  if (!shouldRegisterServiceWorker(process.env.NODE_ENV)) return null

  return (
    <div className="mt-6">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          start(async () => {
            setNote(await enablePush(locale, vapidPublicKey))
          })
        }}
        className="text-label-bold text-secondary-ink uppercase underline disabled:opacity-50"
      >
        {pending ? 'Enabling…' : 'Enable breaking-news alerts'}
      </button>
      {note !== null && <p className="text-on-surface-variant mt-2 text-sm">{note}</p>}
    </div>
  )
}

async function enablePush(locale: string, vapidPublicKey: string): Promise<string> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return 'This browser cannot receive push alerts.'
  }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return 'Notifications were not allowed.'

  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
  })
  const json = subscription.toJSON()
  const result = await callAction(() =>
    subscribePushAction({
      endpoint: json.endpoint ?? '',
      p256dh: json.keys?.['p256dh'] ?? '',
      auth: json.keys?.['auth'] ?? '',
      locale,
    }),
  )

  return result.ok ? 'This device will hear breaking alerts.' : result.error.message
}

function urlBase64ToUint8Array(value: string): Uint8Array {
  const padded = value.replace(/-/gu, '+').replace(/_/gu, '/')
  const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4))
  const raw = atob(`${padded}${pad}`)
  return Uint8Array.from(raw, (char) => char.charCodeAt(0))
}
