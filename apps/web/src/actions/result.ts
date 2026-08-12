import {
  AlreadyDecided,
  CannotAssignOwnRoles,
  CannotCommentUnpublished,
  CannotAlertUnpublished,
  InvalidPushEndpoint,
  InvalidPushKey,
  InvalidRssUrl,
  CannotLikeUnpublished,
  CommentTooLong,
  EmptyComment,
  EmptyLocales,
  IllegalTransition,
  InvalidConfirmation,
  InvalidEmail,
  InvalidSlug,
  MissingApprovedRevision,
  NotOwnArticle,
  NotPermitted,
  ScheduleInPast,
  UnknownRole,
} from '@kurasikapa/domain'
import { RateLimited } from '../security/rate-limit'
import {
  ArticleNotFound,
  BreakingAlertAlreadySent,
  CaptionNeedsBody,
  CommentNotFound,
  ContactMessageTooLong,
  EmailDeliveryFailed,
  EmptyContactMessage,
  RevisionNotFound,
  RevisionNotOfArticle,
  SlugTaken,
} from '@kurasikapa/application'
import { NotSignedIn } from '../composition/actor'
import { ApiProblem } from '../bff/problem'
import { InvalidInput } from './schemas'

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: ActionError }

export interface ActionError {
  /** Stable across locales — the UI maps it to a translated message. */
  readonly code: string
  readonly message: string
}

/**
 * Domain and application errors are the *expected* outcomes of an editorial
 * action, not exceptions: an editor really will try to publish something that
 * lost its approval. They become a typed result the form can render.
 *
 * Anything unrecognised is a bug. It is rethrown so it reaches the error
 * boundary and the logs, rather than being flattened into a shrug for the user.
 */
const KNOWN: readonly [new (...args: never[]) => Error, string][] = [
  [InvalidInput, 'invalid_input'],
  [NotSignedIn, 'not_signed_in'],
  [NotPermitted, 'not_permitted'],
  [NotOwnArticle, 'not_own_article'],
  [IllegalTransition, 'illegal_transition'],
  [MissingApprovedRevision, 'missing_approved_revision'],
  [ScheduleInPast, 'schedule_in_past'],
  [ArticleNotFound, 'article_not_found'],
  [CaptionNeedsBody, 'caption_needs_body'],
  [RevisionNotFound, 'revision_not_found'],
  [RevisionNotOfArticle, 'revision_not_of_article'],
  [SlugTaken, 'slug_taken'],
  [InvalidSlug, 'invalid_slug'],
  [CannotAssignOwnRoles, 'cannot_assign_own_roles'],
  [UnknownRole, 'unknown_role'],
  [RateLimited, 'rate_limited'],
  [CannotCommentUnpublished, 'cannot_comment_unpublished'],
  [CannotLikeUnpublished, 'cannot_like_unpublished'],
  [EmptyComment, 'empty_comment'],
  [CommentTooLong, 'comment_too_long'],
  [AlreadyDecided, 'already_decided'],
  [CommentNotFound, 'comment_not_found'],
  [InvalidEmail, 'invalid_email'],
  [EmptyLocales, 'empty_locales'],
  [InvalidConfirmation, 'invalid_confirmation'],
  [EmptyContactMessage, 'empty_contact_message'],
  [ContactMessageTooLong, 'contact_message_too_long'],
  [EmailDeliveryFailed, 'email_delivery_failed'],
  [CannotAlertUnpublished, 'cannot_alert_unpublished'],
  [BreakingAlertAlreadySent, 'breaking_alert_already_sent'],
  [InvalidPushEndpoint, 'invalid_push_endpoint'],
  [InvalidPushKey, 'invalid_push_key'],
  [InvalidRssUrl, 'invalid_rss_url'],
]

export function toActionError(error: unknown): ActionError {
  if (error instanceof ApiProblem) {
    return { code: error.type, message: error.message }
  }

  for (const [type, code] of KNOWN) {
    if (error instanceof type) return { code, message: error.message }
  }

  throw error
}

export async function attempt<T>(run: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await run() }
  } catch (error) {
    return { ok: false, error: toActionError(error) }
  }
}
