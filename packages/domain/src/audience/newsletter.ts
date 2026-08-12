export const NEWSLETTER_STATES = ['pending', 'confirmed', 'unsubscribed'] as const
export type NewsletterState = (typeof NEWSLETTER_STATES)[number]

export const CADENCES = ['daily', 'weekly'] as const
export type Cadence = (typeof CADENCES)[number]

export interface NewsletterProps {
  readonly id: string
  readonly email: string
  readonly locales: readonly string[]
  readonly cadence: Cadence
  readonly state: NewsletterState
  readonly token: string | null
  readonly confirmedAt: Date | null
}

export class InvalidEmail extends Error {
  constructor(readonly value: string) {
    super('That does not look like an email address')
    this.name = 'InvalidEmail'
  }
}

export class InvalidConfirmation extends Error {
  constructor() {
    super('This confirmation link is not valid')
    this.name = 'InvalidConfirmation'
  }
}

export class EmptyLocales extends Error {
  constructor() {
    super('A subscription needs at least one locale')
    this.name = 'EmptyLocales'
  }
}

/**
 * A digest subscription. Nothing is mailed until the address is confirmed —
 * the same integrity rule as comments and AI proposals: no unsolicited send.
 */
export class NewsletterSubscription {
  private constructor(private readonly props: NewsletterProps) {}

  static reconstitute(props: NewsletterProps): NewsletterSubscription {
    return new NewsletterSubscription(props)
  }

  static request(input: {
    readonly id: string
    readonly email: string
    readonly locales: readonly string[]
    readonly cadence: Cadence
    readonly token: string
  }): NewsletterSubscription {
    const email = normaliseEmail(input.email)
    if (input.locales.length === 0) throw new EmptyLocales()

    return new NewsletterSubscription({
      id: input.id,
      email,
      locales: input.locales,
      cadence: input.cadence,
      state: 'pending',
      token: input.token,
      confirmedAt: null,
    })
  }

  retoken(token: string): NewsletterSubscription {
    return new NewsletterSubscription({ ...this.props, state: 'pending', token, confirmedAt: null })
  }

  confirm(token: string, now: Date): NewsletterSubscription {
    if (this.props.state !== 'pending' || this.props.token !== token) {
      throw new InvalidConfirmation()
    }

    return new NewsletterSubscription({
      ...this.props,
      state: 'confirmed',
      token: null,
      confirmedAt: now,
    })
  }

  unsubscribe(): NewsletterSubscription {
    return new NewsletterSubscription({
      ...this.props,
      state: 'unsubscribed',
      token: null,
    })
  }

  get id(): string {
    return this.props.id
  }

  get email(): string {
    return this.props.email
  }

  get state(): NewsletterState {
    return this.props.state
  }

  get token(): string | null {
    return this.props.token
  }

  get locales(): readonly string[] {
    return this.props.locales
  }

  get cadence(): Cadence {
    return this.props.cadence
  }

  snapshot(): NewsletterProps {
    return this.props
  }
}

export function normaliseEmail(value: string): string {
  const email = value.trim().toLowerCase()
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) {
    throw new InvalidEmail(value)
  }

  return email
}
