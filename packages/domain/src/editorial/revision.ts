import type { ArticleId, RevisionId, UserId } from '../shared/ids'
import type { Transition } from './article-status'

/**
 * What caused a revision: an authorial act ('create', 'edit', 'restore') or a
 * workflow transition. PRD §3 — every transition writes a revision, and the
 * entry is only an audit trail if it says which transition it was.
 */
export type RevisionTrigger = 'create' | 'edit' | 'restore' | Transition

export interface RevisionProps {
  readonly id: RevisionId
  readonly articleId: ArticleId
  readonly seq: number
  readonly title: string
  readonly body: string
  readonly authorId: UserId
  readonly createdAt: Date
  /**
   * Optional only because records written before triggers existed have none.
   * Every revision minted today carries one — `append` refuses to go without.
   */
  readonly trigger?: RevisionTrigger
}

/** What `append` takes: everything but the sequence, trigger included. */
export type NewRevision = Omit<RevisionProps, 'seq' | 'trigger'> & {
  readonly trigger: RevisionTrigger
}

export class NonMonotonicSequence extends Error {
  constructor(
    readonly articleId: ArticleId,
    readonly seq: number,
  ) {
    super(`Revision sequence ${String(seq)} is not ahead of the article's history`)
    this.name = 'NonMonotonicSequence'
  }
}

/**
 * One immutable snapshot of an article's text.
 *
 * History is append-only and never rewound: restoring an old revision writes a
 * *new* revision carrying the old body forward. That way the audit trail shows
 * the restore happened, which a rewind would erase.
 */
export class Revision {
  private constructor(private readonly props: RevisionProps) {}

  static reconstitute(props: RevisionProps): Revision {
    return new Revision(props)
  }

  static append(input: NewRevision, previous: Revision | null): Revision {
    const seq = previous === null ? 1 : previous.seq + 1
    return new Revision({ ...input, seq })
  }

  /** Carry an earlier body forward as the newest revision. */
  restoreOnto(id: RevisionId, latest: Revision, actorId: UserId, now: Date): Revision {
    if (latest.seq < this.props.seq) throw new NonMonotonicSequence(this.props.articleId, latest.seq)

    return new Revision({
      id,
      articleId: this.props.articleId,
      seq: latest.seq + 1,
      title: this.props.title,
      body: this.props.body,
      authorId: actorId,
      createdAt: now,
      trigger: 'restore',
    })
  }

  get id(): RevisionId { return this.props.id }
  get articleId(): ArticleId { return this.props.articleId }
  get seq(): number { return this.props.seq }
  get title(): string { return this.props.title }
  get body(): string { return this.props.body }
  get authorId(): UserId { return this.props.authorId }
  get createdAt(): Date { return this.props.createdAt }
  get trigger(): RevisionTrigger | undefined { return this.props.trigger }

  snapshot(): RevisionProps {
    return this.props
  }
}
