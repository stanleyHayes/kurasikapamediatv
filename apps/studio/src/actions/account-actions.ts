'use server'

import { attempt, type ActionResult } from '@kurasikapa/web-kit/actions/result'
import { requireActor } from '@kurasikapa/web-kit/composition/actor'
import { authGraph } from '@kurasikapa/web-kit/composition/auth-graph'

/**
 * Changing your own Studio password.
 *
 * A Server Action rather than a route handler, for the same reason sign-out is
 * one: the studio's `basePath` prefixes everything it serves, so it cannot
 * reach the site's account endpoints, and an editor should not have to leave
 * the newsroom to rotate a credential.
 *
 * `requireActor()` is the control, not a role check in the page. The use case
 * re-verifies the CURRENT password before it accepts a new one, so a borrowed
 * unlocked laptop cannot silently lock out its owner, and it revokes every
 * refresh token afterwards — which is why the caller tells the editor that
 * other sessions have ended.
 *
 * `attempt` rather than a local try/catch: the four password rejections are
 * registered in `toActionError`, so they arrive as readable messages, and
 * anything NOT registered is rethrown. That last part is the point — a
 * password that silently fails to change is worse than an error page.
 */
export async function changeStudioPasswordAction(
  input: { currentPassword: string; newPassword: string },
): Promise<ActionResult<undefined>> {
  return attempt(async () => {
    await authGraph().changePassword.execute({ actor: await requireActor(), ...input })

    // Explicit, so the result is ActionResult<undefined> rather than
    // ActionResult<void> — `void` does not satisfy the declared payload.
    return undefined
  })
}
