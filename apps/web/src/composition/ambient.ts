import type { ClockPort, DomainEvent, EventBusPort, IdPort } from '@kurasikapa/application'

/**
 * The composition root is the one place allowed to read the wall clock and the
 * entropy source. Everything below it takes these as ports, which is why every
 * test in domain, application and the adapters is deterministic.
 *
 * ESLint's determinism rule is disabled for this directory only.
 */
export const systemClock: ClockPort = {
  now: () => new Date(),
}

export const cryptoIds: IdPort = {
  next: () => crypto.randomUUID(),
}

/**
 * R1 event bus: in-process, synchronous, no delivery guarantee.
 *
 * Deliberately minimal. The subscribers that matter in R1 — cache invalidation
 * — run inside the same Server Action as the publish, so a queue would add a
 * hop without adding reliability. Social fan-out and newsletters land in R2 and
 * belong in media-svc, where retries are real.
 */
export class InProcessEventBus implements EventBusPort {
  private readonly handlers: ((event: DomainEvent) => Promise<void>)[] = []

  on(handler: (event: DomainEvent) => Promise<void>): void {
    this.handlers.push(handler)
  }

  async publish(event: DomainEvent): Promise<void> {
    // A failing subscriber must not roll back a publication that already
    // happened. Failures are collected and rethrown together so none is lost.
    const failures: unknown[] = []

    for (const handler of this.handlers) {
      try {
        await handler(event)
      } catch (error) {
        failures.push(error)
      }
    }

    if (failures.length > 0) {
      throw new AggregateError(failures, `${String(failures.length)} subscriber(s) failed`)
    }
  }
}
