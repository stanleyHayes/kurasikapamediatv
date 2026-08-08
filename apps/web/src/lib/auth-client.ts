'use client'

import { createAuthClient } from 'better-auth/react'

/**
 * Browser-side auth client.
 *
 * Deliberately NOT in src/composition — that directory is the server-side
 * wiring and pulls in MongoDB and the adapters. A client component importing
 * from it would drag all of that into the browser bundle.
 *
 * No baseURL: same-origin is correct, and hardcoding one breaks preview
 * deployments, which live on a different host every time.
 */
export const authClient = createAuthClient()

export const { signIn, signUp, signOut, useSession } = authClient
