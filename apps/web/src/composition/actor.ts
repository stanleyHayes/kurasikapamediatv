import { type Actor, userId } from '@kurasikapa/domain'
import { headers } from 'next/headers'
import { auth } from './auth'
import { container } from './container'

/**
 * The bridge between authentication and authorisation.
 *
 * Every mutating Server Action calls this and hands the result to a use case.
 * A role check in a component is cosmetic; this is the control.
 */
export async function currentActor(): Promise<Actor | null> {
  const session = await auth().api.getSession({ headers: await headers() })
  const id = session?.user.id

  return container().resolveActor.execute({
    userId: id === undefined ? null : userId(id),
  })
}

export class NotSignedIn extends Error {
  constructor() {
    super('This action requires a signed-in user')
    this.name = 'NotSignedIn'
  }
}

/**
 * For Server Actions that cannot proceed anonymously. Throws rather than
 * returning null, so a caller cannot forget the check and pass `null` onward.
 */
export async function requireActor(): Promise<Actor> {
  const actor = await currentActor()
  if (actor === null) throw new NotSignedIn()

  return actor
}
