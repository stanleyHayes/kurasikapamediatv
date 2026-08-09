import type { UserId } from '../shared/ids'

/**
 * One line in the record of what the newsroom did.
 *
 * Product rule 4: audit collections are append-only. No updates, no deletes.
 * That is not a storage preference — an audit log an administrator can edit
 * answers no question worth asking, and the whole reason to keep one is that
 * it can be trusted when someone disputes what was published and when.
 *
 * There is deliberately no constructor that mutates and no method that
 * changes a field. An entry is made once, from an event that already
 * happened, and thereafter only read.
 */
export interface AuditEntryProps {
  readonly id: string
  /** The domain event's name, e.g. `article.published`. */
  readonly action: string
  /** Who caused it. `system:scheduler` for the cron — see systemActor. */
  readonly actorId: UserId
  /** What it happened to. Empty for events with no single subject. */
  readonly subjectId: string
  readonly occurredAt: Date
  /**
   * Event-specific context: a rejection note, an unpublish reason, the roles
   * assigned. Flattened to strings so the record stays readable years later
   * without the code that wrote it.
   */
  readonly detail: Readonly<Record<string, string>>
}

export class AuditEntry {
  private constructor(private readonly props: AuditEntryProps) {}

  static record(props: AuditEntryProps): AuditEntry {
    return new AuditEntry(props)
  }

  get id(): string { return this.props.id }
  get action(): string { return this.props.action }
  get actorId(): UserId { return this.props.actorId }
  get subjectId(): string { return this.props.subjectId }
  get occurredAt(): Date { return this.props.occurredAt }

  get detail(): Readonly<Record<string, string>> {
    // A copy. Handing out the internal map would let a caller edit an audit
    // entry in memory, which is the same lie as editing it on disk.
    return { ...this.props.detail }
  }

  snapshot(): AuditEntryProps {
    return { ...this.props, detail: this.detail }
  }
}
