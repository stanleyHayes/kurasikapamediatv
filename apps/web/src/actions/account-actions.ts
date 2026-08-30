'use server'

import { PasswordChangeRejected } from '@kurasikapa/application'
import { PasswordContainsIdentity, PasswordTooLong, PasswordTooShort } from '@kurasikapa/domain'
import { type ActionResult } from '@kurasikapa/web-kit/actions/result'
import { requireActor } from '@kurasikapa/web-kit/composition/actor'
import { authGraph } from '@kurasikapa/web-kit/composition/auth-graph'

export async function updateProfileAction(name: string): Promise<ActionResult<undefined>> {
  try {
    await authGraph().updateOwnProfile.execute({ actor: await requireActor(), name })
    return { ok: true, data: undefined }
  } catch (error) {
    return { ok: false, error: { code: 'invalid_profile', message: error instanceof Error ? error.message : 'Could not update your profile.' } }
  }
}

export async function changePasswordAction(input: { currentPassword: string; newPassword: string }): Promise<ActionResult<undefined>> {
  try {
    await authGraph().changePassword.execute({ actor: await requireActor(), ...input })
    return { ok: true, data: undefined }
  } catch (error) {
    if (error instanceof PasswordChangeRejected || error instanceof PasswordTooShort || error instanceof PasswordTooLong || error instanceof PasswordContainsIdentity) {
      return { ok: false, error: { code: 'password_rejected', message: error.message } }
    }
    throw error
  }
}
