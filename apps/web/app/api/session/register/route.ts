import { RegistrationThrottled } from '@kurasikapa/application'
import { authGraph } from '@kurasikapa/web-kit/composition/auth-graph'
import { callerKey } from '@kurasikapa/web-kit/security/rate-limit'

/**
 * Creates an account — and deliberately does not sign anyone in.
 *
 * `RegisterUser` returns `{ accepted: true }` whether or not the address was
 * new, because answering otherwise is an account-existence oracle, and on a
 * news site the account list overlaps the source list. Issuing a session here
 * would leak the same fact through the presence of a cookie.
 */

interface Body {
  readonly email?: unknown
  readonly password?: unknown
}

const str = (value: unknown): string => (typeof value === 'string' ? value : '')

export async function POST(request: Request): Promise<Response> {
  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return Response.json({ message: 'Expected a JSON body.' }, { status: 400 })
  }

  try {
    await authGraph().register.execute({
      email: str(body.email),
      password: str(body.password),
      callerKey: await callerKey(null),
    })

    return Response.json({ accepted: true }, { status: 202 })
  } catch (error) {
    if (error instanceof RegistrationThrottled) {
      return Response.json({ message: error.message }, { status: 429 })
    }

    throw error
  }
}
