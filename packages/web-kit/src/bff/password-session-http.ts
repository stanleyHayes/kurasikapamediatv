import { SecondFactorThrottled, SignInFailed, TooManyAttempts } from '@kurasikapa/application'
import { authGraph } from '../composition/auth-graph'
import { issuedCookies, withCookies } from '../composition/session-transport'
import { callerKey } from '../security/rate-limit'

interface PasswordBody {
  readonly email?: unknown
  readonly password?: unknown
}

interface SecondFactorBody {
  readonly challengeToken?: unknown
  readonly code?: unknown
}

const json = (body: unknown, status: number): Response => Response.json(body, { status })
const str = (value: unknown): string => (typeof value === 'string' ? value : '')

async function bodyOf<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T
  } catch {
    return null
  }
}

/** Shared HTTP driving adapter for password sign-in on either deployment. */
export async function startPasswordSession(request: Request): Promise<Response> {
  const body = await bodyOf<PasswordBody>(request)
  if (body === null) return json({ message: 'Expected a JSON body.' }, 400)

  try {
    const outcome = await authGraph().signIn.execute({
      email: str(body.email),
      password: str(body.password),
      callerKey: await callerKey(null),
    })
    if (outcome.kind === 'second-factor-required') {
      return json({ secondFactor: true, challengeToken: outcome.challengeToken }, 200)
    }
    return withCookies(json({ secondFactor: false }, 200), issuedCookies(outcome.tokens))
  } catch (error) {
    if (error instanceof TooManyAttempts) return json({ message: error.message }, 429)
    if (error instanceof SignInFailed) return json({ message: error.message }, 401)
    throw error
  }
}

/** Shared HTTP driving adapter for the second half of an MFA sign-in. */
export async function completePasswordSecondFactor(request: Request): Promise<Response> {
  const body = await bodyOf<SecondFactorBody>(request)
  if (body === null) return json({ message: 'Expected a JSON body.' }, 400)

  try {
    const tokens = await authGraph().secondFactor.execute({
      challengeToken: str(body.challengeToken),
      code: str(body.code),
      callerKey: await callerKey(null),
    })
    return withCookies(json({ signedIn: true }, 200), issuedCookies(tokens))
  } catch (error) {
    if (error instanceof SecondFactorThrottled) return json({ message: error.message }, 429)
    return json({ message: 'That code did not match.' }, 401)
  }
}
