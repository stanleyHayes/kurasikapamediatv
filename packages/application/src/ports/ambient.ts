/**
 * Ambient ports.
 *
 * Time and identity are dependencies, not facts of the runtime. Injecting them
 * is why every test below the composition root is deterministic — and why
 * ESLint bans `Date.now()` and `crypto.randomUUID()` outside `composition/`.
 */
export interface ClockPort {
  now(): Date
}

export interface IdPort {
  next(): string
}

export interface DomainEvent {
  readonly name: string
  readonly occurredAt: Date
}

export interface EventBusPort {
  publish(event: DomainEvent): Promise<void>
}
