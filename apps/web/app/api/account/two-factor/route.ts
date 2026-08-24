import { EnrolmentRefused } from '@kurasikapa/application'
import {
  TotpAlreadyEnrolled,
  acceptableCounters,
  isWellFormedCode,
  normaliseCode,
} from '@kurasikapa/domain'
import { authGraph } from '@kurasikapa/web-kit/composition/auth-graph'
import { requireActor } from '@kurasikapa/web-kit/composition/actor'
import { systemClock } from '@kurasikapa/web-kit/composition/ambient'

/**
 * Turns on a second factor for the signed-in account.
 *
 * The recovery codes come back in this response and nowhere else — only their
 * hashes are stored — so the client must show them before navigating away.
 * They are the safety net for the enrolment being live immediately.
 */

interface Body {
  readonly password?: unknown
}

export async function POST(request: Request): Promise<Response> {
  const actor = await requireActor()

  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return Response.json({ message: 'Expected a JSON body.' }, { status: 400 })
  }

  try {
    const result = await authGraph().enrolSecondFactor.execute({
      userId: actor.id,
      password: typeof body.password === 'string' ? body.password : '',
    })

    return Response.json(result, { status: 201 })
  } catch (error) {
    if (error instanceof TotpAlreadyEnrolled) {
      return Response.json(
        { message: 'Two-factor authentication is already on for this account.' },
        { status: 409 },
      )
    }
    if (error instanceof EnrolmentRefused) {
      return Response.json({ message: error.message }, { status: 401 })
    }

    throw error
  }
}

/**
 * Confirms the authenticator was set up correctly.
 *
 * NOT a gate: `POST` already enrolled the factor, and the recovery codes it
 * returned are the way back in regardless. This exists so someone can find out
 * they scanned the wrong QR now rather than at their next sign-in — which is
 * why a wrong code here costs a retry and nothing else.
 *
 * Deliberately does not consume the counter. `CompleteSecondFactor` records a
 * use to stop replays inside the drift window; doing it here would burn the
 * code the user is about to type at that first real sign-in.
 */
export async function PUT(request: Request): Promise<Response> {
  const actor = await requireActor()

  let body: { readonly code?: unknown }
  try {
    body = (await request.json()) as { readonly code?: unknown }
  } catch {
    return Response.json({ message: 'Expected a JSON body.' }, { status: 400 })
  }

  const code = normaliseCode(typeof body.code === 'string' ? body.code : '')
  if (!isWellFormedCode(code)) {
    return Response.json({ message: 'That code did not match.' }, { status: 401 })
  }

  const graph = authGraph()
  const credential = await graph.credentials.findByUserId(actor.id)
  const secret = credential?.totp?.secret

  if (secret === undefined) {
    return Response.json({ message: 'Two-factor authentication is not on.' }, { status: 409 })
  }

  const matched = acceptableCounters(systemClock.now()).some((counter) =>
    graph.secrets.equals(graph.totp.codeAt(secret, counter), code),
  )

  return matched
    ? Response.json({ confirmed: true }, { status: 200 })
    : Response.json({ message: 'That code did not match.' }, { status: 401 })
}
