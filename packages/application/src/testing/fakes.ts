import type { ClockPort, DomainEvent, EventBusPort, IdPort } from '../ports/ambient'

/** Time you control. Nothing in a test should depend on the wall clock. */
export class FakeClock implements ClockPort {
  constructor(private current: Date) {}

  now(): Date {
    return this.current
  }

  set(at: Date): void {
    this.current = at
  }

  advance(ms: number): void {
    this.current = new Date(this.current.getTime() + ms)
  }
}

/** Predictable ids, so assertions can name them. */
export class SequentialIds implements IdPort {
  private n = 0

  constructor(private readonly prefix = 'id') {}

  next(): string {
    this.n += 1
    return `${this.prefix}_${String(this.n)}`
  }
}

export class RecordingEventBus implements EventBusPort {
  readonly published: DomainEvent[] = []

  publish(event: DomainEvent): Promise<void> {
    this.published.push(event)
    return Promise.resolve()
  }

  names(): string[] {
    return this.published.map((e) => e.name)
  }

  last(): DomainEvent | undefined {
    return this.published.at(-1)
  }
}

/** For asserting that a failure path does not leave a half-written aggregate. */
export class ExplodingEventBus implements EventBusPort {
  constructor(private readonly message = 'bus unavailable') {}

  publish(): Promise<void> {
    return Promise.reject(new Error(this.message))
  }
}
