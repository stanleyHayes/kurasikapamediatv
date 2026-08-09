import { type Actor, type AuditEntry, requirePermission } from '@kurasikapa/domain'
import type { AuditLog } from '../ports/audit'
import { type Page, clampLimit } from '../ports/pagination'
import type { UseCase } from '../ports/use-case'

export interface ReadAuditLogDeps {
  readonly audit: AuditLog
}

export interface ReadAuditLogInput {
  readonly actor: Actor
  readonly after?: string | undefined
  readonly limit?: number | undefined
}

const LIMITS = { fallback: 50, max: 200 }

/**
 * Reads the audit log.
 *
 * Requires `audit:read`, which only administrators and the super admin hold.
 * The log records who rejected whose work and why, which is exactly the sort
 * of thing a newsroom keeps and does not circulate.
 */
export class ReadAuditLog implements UseCase<ReadAuditLogInput, Page<AuditEntry>> {
  constructor(private readonly deps: ReadAuditLogDeps) {}

  async execute(input: ReadAuditLogInput): Promise<Page<AuditEntry>> {
    requirePermission(input.actor, 'audit:read')

    return this.deps.audit.list({
      ...(input.after === undefined ? {} : { after: input.after }),
      limit: clampLimit(input.limit, LIMITS),
    })
  }
}
