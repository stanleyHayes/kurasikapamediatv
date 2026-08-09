import { Actor, userId } from '@kurasikapa/domain'

/**
 * The identity the scheduled-publication cron acts as.
 *
 * The cron does NOT bypass authorisation. It is given an Actor like anything
 * else, and the same domain rules decide what it may do — a scheduled publish
 * and an editor's publish go through identical guards. Giving the cron a
 * back door would mean the one code path nobody watches is also the one path
 * with no rules.
 *
 * `administrator` rather than `super_admin`: the cron publishes, it never
 * assigns roles, and the least privilege that does the job is the right one.
 */
export const SYSTEM_ACTOR_ID = 'system:scheduler'

export function systemActor(): Actor {
  return new Actor(userId(SYSTEM_ACTOR_ID), ['administrator'])
}
