'use client'

/**
 * Browser-side auth, against this app's own session routes.
 *
 * No library. Since KUR-66 the session is our own JWT in our own cookies, and
 * the routes under `/api/session` are the only things that issue them — a
 * client that talked to Better Auth would authenticate against a store nothing
 * reads, which is precisely the split that made `currentActor()` return null
 * for everybody.
 *
 * Deliberately NOT in src/composition — that directory is the server wiring
 * and pulls in MongoDB and the adapters. A client component importing from it
 * would drag all of that into the browser bundle.
 *
 * Relative URLs throughout: same-origin is correct, and hardcoding a base
 * breaks preview deployments, which live on a different host every time.
 */

export interface SignInResult {
  readonly ok: boolean
  /** Set when the password was right and a second factor is owed. */
  readonly challengeToken?: string | undefined
  readonly message?: string | undefined
}

interface Payload {
  readonly secondFactor?: unknown
  readonly challengeToken?: unknown
  readonly message?: unknown
}

const text = (value: unknown): string | undefined =>
  typeof value === 'string' && value !== '' ? value : undefined

async function payload(response: Response): Promise<Payload> {
  try {
    return (await response.json()) as Payload
  } catch {
    return {}
  }
}

async function post(path: string, body: unknown): Promise<Response> {
  return fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // The session cookies are httpOnly; this is what sends them back.
    credentials: 'same-origin',
    body: JSON.stringify(body),
  })
}

export async function signInWithPassword(
  email: string,
  password: string,
  captcha: string | null,
): Promise<SignInResult> {
  try {
    const response = await fetch('/api/session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(captcha === null ? {} : { 'x-captcha-response': captcha }),
      },
      credentials: 'same-origin',
      body: JSON.stringify({ email, password }),
    })

    const body = await payload(response)
    if (!response.ok) return { ok: false, message: text(body.message) }

    // A challenge is not a session. The caller must send it to the
    // second-factor route; nothing is signed in until that succeeds.
    return body.secondFactor === true
      ? { ok: false, challengeToken: text(body.challengeToken) }
      : { ok: true }
  } catch {
    return { ok: false }
  }
}

export async function completeSecondFactor(
  challengeToken: string,
  code: string,
): Promise<boolean> {
  try {
    return (await post('/api/session/second-factor', { challengeToken, code })).ok
  } catch {
    return false
  }
}

export async function register(email: string, password: string): Promise<boolean> {
  try {
    return (await post('/api/session/register', { email, password })).ok
  } catch {
    return false
  }
}

export async function signOut(): Promise<void> {
  try {
    await fetch('/api/session', { method: 'DELETE', credentials: 'same-origin' })
  } catch {
    // Nothing useful to say. The cookies are cleared by the response when it
    // arrives, and a failed sign-out must not leave the user staring at an
    // error on a page they are trying to leave.
  }
}

/**
 * Where the challenge waits between the sign-in form and the code page.
 *
 * sessionStorage, not a cookie: it is bound to this tab, dies with it, and is
 * never attached to a request the user did not make. A challenge that rode
 * along with every request would be a second factor the browser can be
 * tricked into presenting.
 */
const CHALLENGE_KEY = 'kurasikapa.challenge'

export function rememberChallenge(token: string): void {
  try {
    window.sessionStorage.setItem(CHALLENGE_KEY, token)
  } catch {
    // Private mode, or storage disabled. The code page will find nothing and
    // send them back to sign in, which is correct.
  }
}

export function takeChallenge(): string | null {
  try {
    const token = window.sessionStorage.getItem(CHALLENGE_KEY)
    window.sessionStorage.removeItem(CHALLENGE_KEY)

    return token
  } catch {
    return null
  }
}

export async function enrolSecondFactor(
  password: string,
): Promise<{ provisioningUri: string; recoveryCodes: readonly string[] } | null> {
  try {
    const response = await post('/api/account/two-factor', { password })
    if (!response.ok) return null

    const body = (await response.json()) as {
      provisioningUri?: unknown
      recoveryCodes?: unknown
    }

    const uri = text(body.provisioningUri)
    if (uri === undefined || !Array.isArray(body.recoveryCodes)) return null

    return { provisioningUri: uri, recoveryCodes: body.recoveryCodes as readonly string[] }
  } catch {
    return null
  }
}
