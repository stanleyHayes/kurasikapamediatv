'use client'

import {
  TRANSITIONS,
  isAllowedFrom,
  permissionsOf,
  ruleFor,
  type ArticleStatus,
  type Permission,
  type Role,
  type Transition,
} from '@kurasikapa/domain'
import { useState, useTransition } from 'react'
import { callAction } from '@kurasikapa/web-kit/actions/call'
import {
  approveArticleAction,
  publishArticleAction,
  rejectArticleAction,
  submitForReviewAction,
  unpublishArticleAction,
} from '../actions/editorial'
import type { ActionResult } from '@kurasikapa/web-kit/actions/result'
import { useRouter } from '@kurasikapa/web-kit/i18n/navigation'
import { ScheduleControl } from './schedule-control'
import { ActionButton, ReasonedAction } from './workflow-buttons'
import { StatusBadge } from './status-badge'

/**
 * The workflow's next steps, rendered where an editor is already looking at
 * the article.
 *
 * Which buttons appear is answered by the domain's own state machine
 * (`TRANSITIONS`, `ruleFor`, `isAllowedFrom`) and the viewer's role set — not
 * by a copy of those rules kept here, which would drift the day the machine
 * changes. The check is still only cosmetic: the Server Action re-runs it
 * against the real Actor, and its refusal is shown verbatim below the buttons.
 *
 * `owned` stands in for the article's authorId, which the studio read model
 * does not carry: anyone reaching this page without `article:edit_any` passed
 * `assertReadableBy`, which only the author can do.
 */
export interface TransitionControlsProps {
  readonly articleId: string
  readonly locale: string
  readonly status: ArticleStatus
  readonly roles: readonly Role[]
  /** True when the viewer is the article's author — see above. */
  readonly owned: boolean
  /** The current revision — the thing an approval approves. Null until one exists. */
  readonly latestRevisionId: string | null
}

function legalTransitions(
  status: ArticleStatus,
  roles: readonly Role[],
  owned: boolean,
): readonly Transition[] {
  const permissions = permissionsOf(roles)

  return TRANSITIONS.filter((transition) => {
    const rule = ruleFor(transition)
    if (!isAllowedFrom(transition, status)) return false
    if (!permissions.has(rule.permission)) return false
    return mayActOn(rule.authorOnly, owned, permissions)
  })
}

/** The ownership clause of TransitionRule, resolved against the role set. */
function mayActOn(
  authorOnly: boolean,
  owned: boolean,
  permissions: ReadonlySet<Permission>,
): boolean {
  if (!authorOnly) return true
  return owned || permissions.has('article:edit_any')
}

type Run = (transition: Transition, action: () => Promise<ActionResult<unknown>>) => void

export function TransitionControls(props: TransitionControlsProps): React.ReactElement | null {
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState(props.status)
  const [pending, start] = useTransition()
  const router = useRouter()

  const run: Run = (transition, action) => {
    setError(null)

    start(async () => {
      const result = await callAction(action)

      if (!result.ok) {
        setError(result.error.message)
        return
      }

      // Server Actions return the committed transition before the refreshed
      // RSC tree arrives. Reflect that truth immediately so the newsroom can
      // continue even when a loaded runner or slow network delays refresh.
      setStatus(ruleFor(transition).to)
      // The transition wrote new state; refresh so the badge, these controls
      // and the revision history all agree on where the article now is.
      router.refresh()
    })
  }

  const available = legalTransitions(status, props.roles, props.owned)

  return (
    <div>
      <div className="mb-[var(--space-md)] flex items-center gap-3">
        <StatusBadge status={status} />
        <span className="text-on-surface-variant text-label-bold uppercase">{props.locale}</span>
      </div>
      {available.length > 0 && (
        <section className="border-outline-variant bg-surface-container-low mb-[var(--space-md)] border-l-4 border-l-primary p-5">
          <h2 className="font-display text-on-surface mb-3 text-lg font-semibold">Workflow</h2>

          <div className="flex flex-wrap items-center gap-3">
            {available.map((transition) => (
              <Control
                key={transition}
                transition={transition}
                props={props}
                pending={pending}
                run={run}
                onSuccess={(completed) => { setStatus(ruleFor(completed).to) }}
              />
            ))}
          </div>

          {error !== null && (
            <p role="alert" className="text-error mt-3 text-sm">
              {error}
            </p>
          )}
        </section>
      )}
    </div>
  )
}

function Control({
  transition,
  props,
  pending,
  run,
  onSuccess,
}: {
  transition: Transition
  props: TransitionControlsProps
  pending: boolean
  run: Run
  onSuccess: (transition: Transition) => void
}): React.ReactElement | null {
  const articleId = props.articleId

  switch (transition) {
    case 'submit':
      return <ActionButton label="Submit for review" pending={pending} onClick={submitting(articleId, run)} />
    case 'approve':
      return approveControl(props, pending, run)
    case 'reject':
      return (
        <ReasonedAction
          label="Send back for changes"
          placeholder="Note for the author"
          pending={pending}
          onConfirm={(note) => {
            run('reject', () => rejectArticleAction({ articleId, note }))
          }}
        />
      )
    case 'schedule':
      return <ScheduleControl articleId={articleId} onSuccess={() => { onSuccess('schedule') }} />
    case 'publish':
      return <ActionButton label="Publish now" pending={pending} onClick={publishing(articleId, run)} />
    case 'unpublish':
      return (
        <ReasonedAction
          label="Unpublish"
          placeholder="Reason for the audit log"
          pending={pending}
          onConfirm={(reason) => {
            run('unpublish', () => unpublishArticleAction({ articleId, reason }))
          }}
        />
      )
  }
}

function submitting(articleId: string, run: Run): () => void {
  return () => {
    run('submit', () => submitForReviewAction({ articleId }))
  }
}

function publishing(articleId: string, run: Run): () => void {
  return () => {
    run('publish', () => publishArticleAction({ articleId }))
  }
}

/** Approving approves a REVISION — with none written, the button can only fail, so it is not shown. */
function approveControl(
  props: TransitionControlsProps,
  pending: boolean,
  run: Run,
): React.ReactElement | null {
  const revisionId = props.latestRevisionId
  if (revisionId === null) return null

  return (
    <ActionButton
      label="Approve"
      pending={pending}
      onClick={() => {
        run('approve', () => approveArticleAction({ articleId: props.articleId, revisionId }))
      }}
    />
  )
}
