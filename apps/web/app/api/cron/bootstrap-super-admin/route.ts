import { Actor, EmailAddress, userId } from '@kurasikapa/domain'
import { authGraph } from '@kurasikapa/web-kit/composition/auth-graph'
import { container } from '@kurasikapa/web-kit/composition/container'
import { isAuthorisedCron } from '@kurasikapa/web-kit/composition/cron-auth'
import { env } from '@kurasikapa/web-kit/composition/env'
import { callerKey } from '@kurasikapa/web-kit/security/rate-limit'

interface Body {
  readonly email?: unknown
  readonly password?: unknown
}

/**
 * One-deployment bootstrap route. It is removed immediately after use.
 *
 * The shared cron secret keeps the temporary endpoint private. Registration
 * still travels through the application use case, so password policy, hashing,
 * normalisation and duplicate handling remain exactly the production rules.
 */
export async function POST(request: Request): Promise<Response> {
  if (!isAuthorisedCron(request, env().CRON_SECRET)) {
    return new Response(null, { status: 404 })
  }

  const body = (await request.json()) as Body
  const email = typeof body.email === 'string' ? body.email : ''
  const password = typeof body.password === 'string' ? body.password : ''

  await authGraph().register.execute({
    email,
    password,
    callerKey: await callerKey(null),
  })

  const credential = await authGraph().credentials.findByEmail(EmailAddress.of(email))
  if (credential === null) {
    return Response.json({ message: 'Account was not available after registration.' }, { status: 409 })
  }

  const bootstrap = new Actor(userId('system:bootstrap'), ['super_admin'])
  await container().assignRoles.execute({
    actor: bootstrap,
    targetUserId: credential.userId,
    roles: ['super_admin'],
  })

  return Response.json({ seeded: true, role: 'super_admin' })
}
