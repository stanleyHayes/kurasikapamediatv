export interface DeviceSubscriptionProps {
  readonly endpoint: string
  readonly p256dh: string
  readonly auth: string
  readonly locale: string
  readonly subscribedAt: Date
}

export class InvalidPushEndpoint extends Error {
  constructor(readonly value: string) {
    super('That is not a push endpoint')
    this.name = 'InvalidPushEndpoint'
  }
}

export class InvalidPushKey extends Error {
  constructor() {
    super('Push subscription keys are missing')
    this.name = 'InvalidPushKey'
  }
}

/**
 * A browser's push subscription. The endpoint is the identity — there is no
 * separate id, and no reader account is required. Locale decides which
 * breaking alerts this device hears.
 */
export class DeviceSubscription {
  private constructor(private readonly props: DeviceSubscriptionProps) {}

  static reconstitute(props: DeviceSubscriptionProps): DeviceSubscription {
    return new DeviceSubscription(props)
  }

  static subscribe(input: {
    readonly endpoint: string
    readonly p256dh: string
    readonly auth: string
    readonly locale: string
    readonly now: Date
  }): DeviceSubscription {
    const endpoint = input.endpoint.trim()
    if (!isPushEndpoint(endpoint)) throw new InvalidPushEndpoint(input.endpoint)
    if (input.p256dh.trim() === '' || input.auth.trim() === '') throw new InvalidPushKey()
    if (input.locale.trim().length < 2) throw new InvalidPushEndpoint(input.locale)

    return new DeviceSubscription({
      endpoint,
      p256dh: input.p256dh.trim(),
      auth: input.auth.trim(),
      locale: input.locale.trim(),
      subscribedAt: input.now,
    })
  }

  get endpoint(): string {
    return this.props.endpoint
  }

  get locale(): string {
    return this.props.locale
  }

  snapshot(): DeviceSubscriptionProps {
    return this.props
  }
}

function isPushEndpoint(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'https:'
  } catch {
    return false
  }
}
